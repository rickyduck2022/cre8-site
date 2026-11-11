import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { open } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { httpError } from "../stage-a/store.mjs";
import { loadPack, packItems } from "./policy.mjs";

export async function claimJob(database) {
  return database.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(794821005)");
    await client.query(`
      UPDATE media_assets SET state = 'failed' WHERE id IN
        (SELECT asset_id FROM media_jobs WHERE state = 'running' AND lease_until < now() AND attempts >= 3)
      AND state = 'uploaded'
    `);
    await client.query("UPDATE media_jobs SET state = 'failed', error_code = 'ATTEMPTS_EXHAUSTED' WHERE state = 'running' AND lease_until < now() AND attempts >= 3");
    const active = await client.query("SELECT count(*) AS count FROM media_jobs WHERE state = 'running' AND lease_until > now()");
    if (Number(active.rows[0].count) >= 2) return null;
    const { rows } = await client.query(`
      SELECT * FROM media_jobs WHERE attempts < 3 AND
        ((state = 'queued' AND available_at <= now()) OR (state = 'running' AND lease_until < now()))
      ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1
    `);
    if (!rows.length) return null;
    const job = rows[0];
    const token = randomUUID();
    await client.query(`
      UPDATE media_jobs SET state = 'running', attempts = attempts + 1, lease_token = $2,
        lease_until = now() + interval '120 seconds', result_key = $3 WHERE id = $1
    `, [job.id, token, `${token}.${job.kind === "validate" ? "wav" : "zip"}`]);
    return { ...job, lease_token: token, result_key: `${token}.${job.kind === "validate" ? "wav" : "zip"}`, attempts: job.attempts + 1 };
  });
}

async function processor(message, signal) {
  const child = fork(fileURLToPath(new URL("./processor.mjs", import.meta.url)), [], {
    execArgv: ["--max-old-space-size=128"], stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  let outcome;
  const abort = () => { if (child.connected) child.send({ cancel: true }); };
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 65000);
  const forceTimer = setTimeout(() => child.kill(), 70000);
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.on("message", (result) => { outcome = result; });
      child.once("exit", (code) => {
        if (code === 0 && outcome?.ok && !signal?.aborted) resolve();
        else reject(Object.assign(new Error("Media subprocess did not complete."), { code: outcome?.code ?? "WORKER_EXIT" }));
      });
      child.send(message);
    });
  } finally {
    clearTimeout(timer);
    clearTimeout(forceTimer);
    signal?.removeEventListener("abort", abort);
  }
}

export async function processClaim(database, disk, job, { signal } = {}) {
  let files;
  if (job.kind === "validate") {
    const { rows } = await database.pool.query("SELECT * FROM media_assets WHERE id = $1 AND state = 'uploaded'", [job.asset_id]);
    if (!rows.length) throw httpError(409, "Upload is no longer available.");
    const asset = rows[0];
    files = [{ path: await disk.verify(asset.stored_key, asset.expected_bytes, asset.checksum) }];
  } else {
    const pack = await loadPack(database.pool, job.pack_id);
    if (pack.revision !== job.revision || pack.status !== "published") throw httpError(409, "Pack revision changed.");
    files = [];
    for (const [index, item] of (await packItems(database.pool, pack.id)).entries()) {
      if (item.asset_state !== "ready") throw httpError(409, "Pack media is not ready.");
      files.push({ name: `${String(index + 1).padStart(2, "0")}-${item.file_name}`,
        path: await disk.verify(item.stored_key, item.expected_bytes, item.checksum),
        key: item.stored_key, bytes: item.expected_bytes, checksum: item.checksum });
    }
    if (pack.licence) files.push({ name: "LICENCE.txt", content: pack.licence });
  }
  const maximumOutput = job.kind === "validate" ? 30 * 32000 + 44
    : files.reduce((total, file) => total + Number(file.bytes ?? Buffer.byteLength(file.content)) + 1024, 1024);
  await disk.capacity(maximumOutput * 2);
  await processor({ kind: job.kind, root: disk.root, outputKey: job.result_key, files }, signal);
  const output = await open(await disk.checkedPath(job.result_key), "r+");
  try { await output.sync(); } finally { await output.close(); }
  const result = await disk.inspect(job.result_key);
  if (job.kind === "validate") {
    const { rows } = await database.pool.query("SELECT * FROM media_assets WHERE id = $1", [job.asset_id]);
    await disk.verify(rows[0].stored_key, rows[0].expected_bytes, rows[0].checksum);
  } else {
    for (const file of files) {
      if (file.key) await disk.verify(file.key, file.bytes, file.checksum);
    }
  }
  return result;
}

export async function completeJob(database, job, result) {
  await database.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(794821004)");
    const lease = await client.query(`
      SELECT id FROM media_jobs WHERE id = $1 AND state = 'running' AND lease_token = $2
        AND lease_until > clock_timestamp() FOR UPDATE
    `, [job.id, job.lease_token]);
    if (!lease.rowCount) throw httpError(409, "Media job lease was lost.");
    if (job.kind === "validate") {
      const updated = await client.query(`
        UPDATE media_assets SET state = 'ready', preview_key = $2, preview_bytes = $3, preview_checksum = $4
        WHERE id = $1 AND state = 'uploaded'
      `, [job.asset_id, job.result_key, result.bytes, result.checksum]);
      if (!updated.rowCount) throw httpError(409, "Upload is no longer publishable.");
      await client.query(`
        INSERT INTO outbox(user_id, event_type, aggregate_id)
        SELECT owner_id, 'media.ready', id FROM media_assets WHERE id = $1
      `, [job.asset_id]);
    } else {
      const pack = await loadPack(client, job.pack_id, { lock: true });
      if (pack.revision !== job.revision || pack.status !== "published") throw httpError(409, "Pack revision changed.");
    }
    await client.query(`
      UPDATE media_jobs SET state = 'done', result_bytes = $3, result_checksum = $4,
        lease_until = NULL WHERE id = $1 AND lease_token = $2
    `, [job.id, job.lease_token, result.bytes, result.checksum]);
  });
}

export function createMediaRunner(database, disk, { logger = console } = {}) {
  let active = false;
  return {
    async runOnce({ signal } = {}) {
      if (active) throw httpError(409, "This media runner is already busy.");
      active = true;
      let job;
      try {
        job = await claimJob(database);
        if (!job) return false;
        const result = await processClaim(database, disk, job, { signal });
        await completeJob(database, job, result);
        return true;
      } catch (error) {
        logger.error("Spike media job failed.", { jobId: job?.id, code: error.code ?? error.status ?? error.name });
        if (job) {
          const terminal = error.status === 409 || job.attempts >= 3;
          const released = await database.transaction(async (client) => {
            const updated = await client.query(`
              UPDATE media_jobs SET state = $3, error_code = $4, available_at = now() + interval '2 seconds'
              WHERE id = $1 AND lease_token = $2 AND state = 'running' AND lease_until > clock_timestamp()
              RETURNING id
            `, [job.id, job.lease_token, terminal ? "failed" : "queued", String(error.code ?? "PROCESSING_FAILED")]);
            if (updated.rowCount && terminal && job.asset_id) {
              await client.query("UPDATE media_assets SET state = 'failed' WHERE id = $1 AND state = 'uploaded'", [job.asset_id]);
            }
            return updated.rowCount > 0;
          });
          if (released) await disk.remove(job.result_key);
        }
        throw error;
      } finally {
        active = false;
      }
    },
  };
}
