import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import { httpError } from "../stage-a/store.mjs";
import { audioFormats, maxAudioBytes } from "./disk.mjs";
import { mediaLock } from "./domain.mjs";

export async function reserveUpload(client, user, input, disk) {
  await mediaLock(client);
  if (typeof input.fileName !== "string" || input.fileName.length > 200 || basename(input.fileName) !== input.fileName
    || /[\\/\x00-\x1f]/.test(input.fileName) || !audioFormats[extname(input.fileName).toLowerCase()]) {
    throw httpError(400, "Choose a supported audio filename.");
  }
  if (!Number.isSafeInteger(input.bytes) || input.bytes < 1 || input.bytes > maxAudioBytes) throw httpError(400, "Reserve 1-100 MiB of audio.");
  await disk.capacity();
  const { rows } = await client.query(`
    SELECT COALESCE(sum(expected_bytes), 0) AS bytes,
      count(*) FILTER (WHERE state IN ('receiving','uploading','uploaded')) AS pending
    FROM media_assets WHERE owner_id = $1 AND state <> 'deleted'
  `, [user.id]);
  if (Number(rows[0].bytes) + input.bytes > 1024 * 1024 * 1024 || Number(rows[0].pending) >= 10) {
    throw httpError(429, "Synthetic account storage or pending-upload quota reached.");
  }
  const id = randomUUID();
  await client.query(`
    INSERT INTO media_assets(id, owner_id, file_name, stored_key, expected_bytes, state)
    VALUES ($1, $2, $3, $4, $5, 'receiving')
  `, [id, user.id, input.fileName, disk.newKey(extname(input.fileName).toLowerCase()), input.bytes]);
  return { status: 201, body: { id, state: "receiving" }, eventType: "upload.reserved" };
}

export async function receiveUpload(database, disk, user, id, request, logger) {
  const asset = await database.transaction(async (client) => {
    await mediaLock(client);
    const { rows } = await client.query(`
      UPDATE media_assets SET state = 'uploading', expires_at = now() + interval '1 hour'
      WHERE id = $1 AND owner_id = $2 AND state = 'receiving' AND expires_at > now() RETURNING *
    `, [id, user.id]);
    if (!rows.length) throw httpError(409, "Upload is missing, expired or already received.");
    return rows[0];
  });
  let received;
  try {
    received = await disk.receive(asset.stored_key, request, Number(asset.expected_bytes));
  } catch (error) {
    logger.error("Spike upload failed.", { assetId: id, code: error.code ?? error.status ?? error.name });
    await database.pool.query("UPDATE media_assets SET state = 'failed' WHERE id = $1 AND state = 'uploading'", [id]);
    throw error;
  }
  await database.transaction(async (client) => {
    await mediaLock(client);
    const updated = await client.query(`
      UPDATE media_assets SET state = 'uploaded', checksum = $3
      WHERE id = $1 AND owner_id = $2 AND state = 'uploading' RETURNING id
    `, [id, user.id, received.checksum]);
    if (!updated.rowCount) throw httpError(409, "Upload reservation is no longer active.");
    await client.query("INSERT INTO media_jobs(id, kind, asset_id) VALUES ($1, 'validate', $2)", [randomUUID(), id]);
  });
  return { id, state: "uploaded" };
}

export async function reconcile(database, disk, { orphanAgeMs = 3600000, logger = console } = {}) {
  if (!Number.isFinite(orphanAgeMs) || orphanAgeMs < 3600000) throw new Error("Orphan grace must be at least one hour.");
  try {
    return await database.transaction(async (client) => {
      await mediaLock(client);
      let damaged = 0;
      const ready = await client.query("SELECT * FROM media_assets WHERE state = 'ready' FOR UPDATE");
      for (const asset of ready.rows) {
        try {
          await disk.verify(asset.stored_key, asset.expected_bytes, asset.checksum);
          await disk.verify(asset.preview_key, asset.preview_bytes, asset.preview_checksum);
        } catch (error) {
          if (error.code !== "ENOENT" && error.status !== 503) throw error;
          logger.error("Spike ready media failed reconciliation.", { assetId: asset.id, code: error.code ?? "CHECKSUM_MISMATCH" });
          await client.query("UPDATE media_assets SET state = 'failed' WHERE id = $1", [asset.id]);
          damaged++;
        }
      }
      await client.query(`
        UPDATE media_assets a SET state = 'deleting'
        WHERE (state = 'failed' OR expires_at < now()) AND state NOT IN ('deleting', 'deleted')
          AND NOT EXISTS (SELECT 1 FROM media_dubs d WHERE d.asset_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM media_jobs j WHERE j.asset_id = a.id AND j.state = 'running' AND j.lease_until > now())
      `);
      await client.query(`
        UPDATE media_jobs SET state = 'failed', error_code = 'ASSET_DELETED' WHERE state IN ('queued','running')
          AND asset_id IN (SELECT id FROM media_assets WHERE state = 'deleting')
      `);
      const { rows } = await client.query("SELECT * FROM media_assets WHERE state = 'deleting' FOR UPDATE");
      for (const asset of rows) {
        await disk.remove(asset.stored_key);
        if (asset.preview_key) await disk.remove(asset.preview_key);
        await client.query("UPDATE media_assets SET state = 'deleted', preview_key = NULL WHERE id = $1", [asset.id]);
      }
      const activeKeys = new Set((await client.query(`
        SELECT stored_key AS key FROM media_assets WHERE state <> 'deleted'
        UNION SELECT preview_key FROM media_assets WHERE state <> 'deleted' AND preview_key IS NOT NULL
        UNION SELECT result_key FROM media_jobs WHERE result_key IS NOT NULL
          AND (state = 'done' OR (state = 'running' AND lease_until > now()))
      `)).rows.map((row) => row.key));
      let orphans = 0;
      for (const file of await disk.files()) {
        if (!activeKeys.has(file.key) && file.mtimeMs < Date.now() - orphanAgeMs) {
          await disk.remove(file.key);
          orphans++;
        }
      }
      const expiredArchives = await client.query(`
        SELECT j.id, j.result_key FROM media_jobs j JOIN media_packs p ON p.id = j.pack_id
        WHERE j.kind = 'archive' AND j.state = 'done' AND j.revision <> p.revision
      `);
      for (const job of expiredArchives.rows) {
        await disk.remove(job.result_key);
        await client.query("UPDATE media_jobs SET state = 'failed', result_key = NULL, error_code = 'STALE_REVISION' WHERE id = $1", [job.id]);
      }
      return { deletedAssets: rows.length, orphans, staleArchives: expiredArchives.rowCount, damagedAssets: damaged };
    });
  } catch (error) {
    logger.error("Spike media reconciliation failed.", { code: error.code ?? error.name });
    throw error;
  }
}
