import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, utimes, writeFile } from "node:fs/promises";
import http from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createSpikeDatabase, migrate, readSpikeConfig } from "../stage-a/database.mjs";
import { fixtureAccounts } from "../stage-a/fixtures.mjs";
import { createStageBServer } from "./routes.mjs";
import { seedMediaFixtures } from "./fixtures.mjs";
import { claimJob, completeJob, createMediaRunner, processClaim } from "./jobs.mjs";
import { reconcile } from "./media.mjs";

const config = readSpikeConfig();

function wave(seconds = 35) {
  const pcm = Buffer.alloc(seconds * 32000);
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(pcm.length + 36, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

test("Stage B real PostgreSQL and private media", async (t) => {
  const logs = [];
  const logger = { error: (...args) => logs.push(args) };
  const database = createSpikeDatabase(config, { logger });
  let server;
  let disk;
  let base;
  let runner;
  let alice;
  let bob;
  let charlie;
  let dana;
  let original;
  let publicDub;
  let privateDub;
  let privatePack;
  let privateArchive;
  const key = () => randomUUID();
  async function send(path, { method = "GET", cookie, input, bytes, headers = {}, retryKey } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(input !== undefined ? { "content-type": "application/json" } : {}),
        ...(["POST", "PATCH", "DELETE"].includes(method) ? { "idempotency-key": retryKey ?? key() } : {}),
        ...headers,
      },
      ...(input !== undefined ? { body: JSON.stringify(input) } : bytes !== undefined ? { body: bytes } : {}),
    });
    const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : Buffer.from(await response.arrayBuffer());
    return { status: response.status, headers: response.headers, body };
  }
  async function login(username, password) {
    const result = await send("/api/login", { method: "POST", input: { username, password } });
    assert.equal(result.status, 200);
    return result.headers.get("set-cookie").split(";")[0];
  }
  async function reserve(bytes = wave(), cookie = alice, name = "fixture.wav") {
    const result = await send("/api/uploads", { method: "POST", cookie, input: { fileName: name, bytes: bytes.length } });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body.id;
  }
  async function upload(bytes = wave(), cookie = alice) {
    const id = await reserve(bytes, cookie);
    const result = await send(`/api/uploads/${id}`, { method: "PUT", cookie, bytes });
    assert.equal(result.status, 202, JSON.stringify(result.body));
    return id;
  }
  async function ready(bytes = wave()) {
    const id = await upload(bytes);
    assert.equal(await runner.runOnce(), true);
    assert.equal((await send(`/api/uploads/${id}`, { cookie: alice })).body.state, "ready");
    return id;
  }
  async function dub(distribution = "worldwide", extra = {}, bytes = wave()) {
    const uploadId = await ready(bytes);
    const result = await send("/api/dubs", { method: "POST", cookie: alice,
      input: { uploadId, title: `Synthetic ${distribution}`, distribution, ...extra } });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body;
  }
  async function pack(distribution, ids, extra = {}) {
    const result = await send("/api/packs", { method: "POST", cookie: alice,
      input: { title: `Pack ${key()}`, distribution, dubIds: ids, ...extra } });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body;
  }
  async function publish(id, expected = 200) {
    const result = await send(`/api/packs/${id}/publish`, { method: "POST", cookie: alice, input: {} });
    assert.equal(result.status, expected, JSON.stringify(result.body));
    return result.body;
  }
  const count = async (table) => Number((await database.pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
  try {
    await t.test("isolated migrations and personas initialize without community data", async () => {
      await migrate(database);
      await seedMediaFixtures(database);
      const harness = await createStageBServer({ database, directory: process.env.SPIKE_MEDIA_DIRECTORY, runId: config.runId, logger });
      server = harness.server;
      disk = harness.disk;
      runner = createMediaRunner(database, disk, { logger });
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      base = `http://127.0.0.1:${server.address().port}`;
      alice = await login(fixtureAccounts[0].username, fixtureAccounts[0].password);
      bob = await login(fixtureAccounts[1].username, fixtureAccounts[1].password);
      charlie = await login("spike.charlie", fixtureAccounts[1].password);
      dana = await login("spike.dana", fixtureAccounts[0].password);
    });
    await t.test("upload reservations enforce authentication, ownership, sizes and file paths", async () => {
      const foreignHost = await new Promise((resolve, reject) => {
        const request = http.get(base + "/api/health", { headers: { host: "untrusted.example" } }, (response) => {
          response.resume();
          response.once("end", () => resolve(response.statusCode));
        });
        request.once("error", reject);
      });
      assert.equal(foreignHost, 403);
      assert.equal((await send("/api/uploads", { method: "POST", cookie: alice, input: { fileName: "bad.wav", bytes: 100 },
        headers: { origin: "https://untrusted.example" } })).status, 403);
      assert.equal((await send("/api/uploads", { method: "POST", input: { fileName: "bad.wav", bytes: 100 } })).status, 401);
      for (const fileName of ["../evil.wav", "bad\\evil.wav", "bad.html", "bad\r\n.wav"]) {
        assert.equal((await send("/api/uploads", { method: "POST", cookie: alice, input: { fileName, bytes: 100 } })).status, 400);
      }
      for (const bytes of [0, -1, 104857601, "10"]) {
        assert.equal((await send("/api/uploads", { method: "POST", cookie: alice, input: { fileName: "bad.wav", bytes } })).status, 400);
      }
      const id = await reserve();
      assert.equal((await send(`/api/uploads/${id}`, { cookie: bob })).status, 404);
      assert.equal((await send(`/api/uploads/${id}`, { method: "PUT", cookie: bob, bytes: wave() })).status, 409);
      assert.equal((await send("/api/dubs", { method: "POST", cookie: alice, input: { title: "Not ready", uploadId: id } })).status, 409);
      assert.equal((await send(`/api/uploads/${id}`, { method: "DELETE", cookie: alice })).status, 200);
      await reconcile(database, disk, { logger });
    });
    await t.test("aborted uploads remove partial bytes and never become ready", async () => {
      const id = await reserve();
      await new Promise((resolve, reject) => {
        const request = http.request(`${base}/api/uploads/${id}`, { method: "PUT", headers: { cookie: alice } });
        request.on("error", (error) => error.code === "ECONNRESET" ? resolve() : reject(error));
        request.write(wave().subarray(0, 1000));
        setTimeout(() => request.destroy(), 100);
      });
      for (let attempt = 0; attempt < 30; attempt++) {
        const state = (await send(`/api/uploads/${id}`, { cookie: alice })).body.state;
        if (state === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const asset = (await database.pool.query("SELECT * FROM media_assets WHERE id = $1", [id])).rows[0];
      assert.equal(asset.state, "failed");
      assert.ok(!existsSync(disk.path(asset.stored_key)));
      await reconcile(database, disk, { logger });
    });
    await t.test("invalid content fails bounded retries without a ready preview", async () => {
      const id = await upload(Buffer.from("not actually a wave"));
      for (let attempt = 1; attempt <= 3; attempt++) {
        await assert.rejects(runner.runOnce());
        await database.pool.query("UPDATE media_jobs SET available_at = now() WHERE asset_id = $1", [id]);
      }
      const asset = (await database.pool.query("SELECT * FROM media_assets WHERE id = $1", [id])).rows[0];
      const job = (await database.pool.query("SELECT * FROM media_jobs WHERE asset_id = $1", [id])).rows[0];
      assert.equal(asset.state, "failed");
      assert.equal(asset.preview_key, null);
      assert.equal(job.state, "failed");
      assert.equal(job.attempts, 3);
      await reconcile(database, disk, { logger });
    });
    await t.test("a killed claimant is reclaimed; its stale completion is fenced", async () => {
      const id = await upload();
      const child = fork(fileURLToPath(new URL("./lease-crash-fixture.mjs", import.meta.url)), [], {
        execArgv: [], stdio: ["ignore", "ignore", "ignore", "ipc"],
      });
      let claimed;
      try {
        claimed = await new Promise((resolve, reject) => {
          child.once("error", reject);
          child.once("message", resolve);
          child.once("exit", () => reject(new Error("Claim fixture exited before sending its lease.")));
        });
        assert.equal(claimed.asset_id, id);
      } finally {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill();
        await exited;
      }
      await database.pool.query("UPDATE media_jobs SET lease_until = now() - interval '1 second' WHERE id = $1", [claimed.id]);
      const replacement = await claimJob(database);
      assert.equal(replacement.id, claimed.id);
      assert.notEqual(replacement.lease_token, claimed.lease_token);
      const output = await processClaim(database, disk, replacement);
      await assert.rejects(completeJob(database, claimed, output), { status: 409 });
      assert.equal((await send(`/api/uploads/${id}`, { cookie: alice })).body.state, "uploaded");
      await completeJob(database, replacement, output);
      assert.equal((await send(`/api/uploads/${id}`, { cookie: alice })).body.state, "ready");
      original = { id, bytes: wave() };
    });
    await t.test("public originals are authenticated; guests receive real clipped WAV bytes", async () => {
      const result = await send("/api/dubs", { method: "POST", cookie: alice,
        input: { uploadId: original.id, title: "Public fixture", distribution: "worldwide" } });
      assert.equal(result.status, 201);
      publicDub = result.body;
      const full = await send(`/api/dubs/${publicDub.id}/audio`, { cookie: bob });
      assert.equal(full.status, 200);
      assert.deepEqual(full.body, original.bytes);
      assert.match(full.headers.get("cache-control"), /no-store/);
      const guest = await send(`/api/dubs/${publicDub.id}/audio`);
      assert.equal(guest.status, 200);
      assert.equal(guest.body.length, 44 + 30 * 32000);
      assert.equal(guest.body.readUInt32LE(40) / guest.body.readUInt32LE(28), 30);
      assert.ok(guest.body.length < full.body.length);
      assert.equal((await send(`/api/dubs/${publicDub.id}/audio?download=1`)).status, 401);
      assert.equal((await send(`/api/dubs/${publicDub.id}/audio`, { cookie: "cre8_session=invalid" })).status, 401);
      const range = await send(`/api/dubs/${publicDub.id}/audio`, { cookie: bob, headers: { range: "bytes=4-10" } });
      assert.equal(range.status, 206);
      assert.deepEqual(range.body, original.bytes.subarray(4, 11));
      const suffix = await send(`/api/dubs/${publicDub.id}/audio`, { cookie: bob, headers: { range: "bytes=-12" } });
      assert.deepEqual(suffix.body, original.bytes.subarray(-12));
      for (const range of ["bytes=-0", "bytes=-", "bytes=999999999-", "bytes=1-0", "bytes=0-1,4-5"]) {
        assert.equal((await send(`/api/dubs/${publicDub.id}/audio`, { cookie: bob, headers: { range } })).status, 416);
      }
      const head = await fetch(`${base}/api/dubs/${publicDub.id}/audio`, { method: "HEAD", headers: { cookie: bob } });
      assert.equal(head.status, 200);
      assert.equal(Number(head.headers.get("content-length")), original.bytes.length);
      assert.equal((await head.arrayBuffer()).byteLength, 0);
    });
    await t.test("draft membership never classifies/exposes unpublished tracks; sample terms gate publish", async () => {
      const sample = await pack("worldwide", [publicDub.id], { kind: "sample" });
      assert.equal((await send(`/api/dubs/${publicDub.id}`, { cookie: bob })).body.mediaKind, "dub");
      await publish(sample.id, 400);
      const changed = await send(`/api/packs/${sample.id}`, { method: "PATCH", cookie: alice, input: { licence: "Synthetic test usage terms" } });
      assert.equal(changed.status, 200);
      await publish(sample.id);
      assert.equal((await send(`/api/dubs/${publicDub.id}`, { cookie: bob })).body.mediaKind, "sample");
      const draft = await pack("worldwide", []);
      const added = await send(`/api/packs/${draft.id}/tracks`, { method: "POST", cookie: alice, input: { uploadId: await ready(wave(2)), title: "Draft-only" } });
      assert.equal(added.status, 200);
      const draftId = added.body.dubs[0].id;
      assert.equal((await send(`/api/dubs/${draftId}`, { cookie: bob })).status, 404);
      assert.equal((await send(`/api/dubs/${draftId}/audio`)).status, 404);
      assert.ok(!(await send("/api/community", { cookie: bob })).body.dubs.some((dub) => dub.id === draftId));
      await publish(draft.id);
      assert.equal((await send(`/api/dubs/${draftId}/audio`)).body.length, 44 + 2 * 32000);
    });
    await t.test("private pack message, grant and outbox roll back atomically at commit", async () => {
      privateDub = await dub("private");
      privatePack = await pack("private", [privateDub.id]);
      await publish(privatePack.id);
      assert.equal((await send(`/api/packs/${privatePack.id}`, { method: "PATCH", cookie: bob, input: { title: "Not the owner" } })).status, 404);
      assert.equal((await send(`/api/dubs/${privateDub.id}/grants`, { method: "POST", cookie: bob, input: { userId: "spike-charlie" } })).status, 404);
      for (const path of [`/api/packs/${privatePack.id}`, `/api/dubs/${privateDub.id}/audio`]) {
        assert.equal((await send(path, { cookie: bob })).status, 404);
        assert.equal((await send(path)).status, 404);
      }
      const route = `/api/packs/${privatePack.id}/messages`;
      assert.equal((await send(route, { method: "POST", cookie: alice, input: { recipientId: "spike-bob", text: "Confirm required" } })).status, 409);
      assert.equal((await send(route, { method: "POST", cookie: alice, input: { recipientId: "spike-charlie", text: "Not friends", confirmPackAccess: true } })).status, 404);
      await database.pool.query(`
        CREATE FUNCTION stage_b_fail_message() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic message failure' USING ERRCODE = '23514'; END $$;
        CREATE CONSTRAINT TRIGGER stage_b_fail_message AFTER INSERT ON media_messages
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stage_b_fail_message();
      `);
      const before = { messages: await count("media_messages"), grants: await count("media_pack_grants"), events: await count("outbox") };
      const retryKey = key();
      const input = { recipientId: "spike-bob", text: "Synthetic shared pack", confirmPackAccess: true };
      try {
        assert.equal((await send(route, { method: "POST", cookie: alice, input, retryKey })).status, 503);
        assert.equal(await count("media_messages"), before.messages);
        assert.equal(await count("media_pack_grants"), before.grants);
        assert.equal(await count("outbox"), before.events);
      } finally {
        await database.pool.query("DROP TRIGGER stage_b_fail_message ON media_messages; DROP FUNCTION stage_b_fail_message()");
      }
      const sent = await send(route, { method: "POST", cookie: alice, input, retryKey });
      assert.equal(sent.status, 201);
      assert.deepEqual((await send(route, { method: "POST", cookie: alice, input, retryKey })).body, sent.body);
      assert.equal((await send("/api/messages", { cookie: bob })).body.messages.length, 1);
      assert.equal((await send("/api/messages", { cookie: charlie })).body.messages.length, 0);
      assert.equal((await send(`/api/dubs/${privateDub.id}/audio`, { cookie: bob })).status, 200);
      assert.equal((await send(`/api/dubs/${privateDub.id}/audio`, { cookie: charlie })).status, 404);
      const search = await send("/api/dubs/search?q=synthetic", { cookie: bob });
      assert.ok(search.body.dubs.some((dub) => dub.id === privateDub.id));
      const newTrack = await dub("private", {}, wave(2));
      const inputEdit = { dubIds: [privateDub.id, newTrack.id] };
      assert.equal((await send(`/api/packs/${privatePack.id}`, { method: "PATCH", cookie: alice, input: inputEdit })).status, 409);
      assert.equal((await send(`/api/packs/${privatePack.id}`, { method: "PATCH", cookie: alice, input: { ...inputEdit, confirmNewAccess: true } })).status, 200);
      assert.equal((await send(`/api/dubs/${newTrack.id}/audio`, { cookie: bob })).status, 200);
    });
    await t.test("archives contain exact bytes and cannot survive permission/revision changes", async () => {
      const requested = await send(`/api/packs/${privatePack.id}/archive`, { method: "POST", cookie: bob, input: {} });
      assert.equal(requested.status, 202);
      assert.equal((await send(`/api/packs/${privatePack.id}/archive`, { cookie: bob })).status, 409);
      await runner.runOnce();
      const archive = await send(`/api/packs/${privatePack.id}/archive`, { cookie: bob });
      assert.equal(archive.status, 200);
      assert.equal(archive.body.readUInt32LE(0), 0x04034b50);
      const nameSize = archive.body.readUInt16LE(26);
      const dataSize = archive.body.readUInt32LE(18);
      assert.deepEqual(archive.body.subarray(30 + nameSize, 30 + nameSize + dataSize), wave());
      const second = 30 + nameSize + dataSize;
      assert.equal(archive.body.readUInt32LE(second), 0x04034b50);
      const secondNameSize = archive.body.readUInt16LE(second + 26);
      const secondDataSize = archive.body.readUInt32LE(second + 18);
      assert.deepEqual(archive.body.subarray(second + 30 + secondNameSize, second + 30 + secondNameSize + secondDataSize), wave(2));
      assert.equal(archive.body.readUInt16LE(archive.body.length - 12), 2);
      privateArchive = requested.body.id;
      await send(`/api/packs/${privatePack.id}/grants/spike-bob`, { method: "DELETE", cookie: alice });
      assert.equal((await send(`/api/packs/${privatePack.id}/archive`, { cookie: bob })).status, 404);
      assert.equal((await send(`/api/dubs/${privateDub.id}/audio`, { cookie: bob })).status, 404);
      for (const path of ["/api/community", "/api/dubs/search?q=synthetic"]) {
        const hidden = await send(path, { cookie: bob });
        assert.ok(!hidden.body.dubs.some((dub) => dub.id === privateDub.id));
        assert.ok(!hidden.body.packs.some((pack) => pack.id === privatePack.id));
      }
      assert.equal((await send(`/api/packs/${privatePack.id}/archive`, { cookie: alice })).status, 409);
      const clean = await reconcile(database, disk, { logger });
      assert.ok(clean.staleArchives >= 1);
      assert.equal((await database.pool.query("SELECT state FROM media_jobs WHERE id = $1", [privateArchive])).rows[0].state, "failed");
      const queued = await send(`/api/packs/${privatePack.id}/archive`, { method: "POST", cookie: alice, input: {} });
      await send(`/api/packs/${privatePack.id}`, { method: "PATCH", cookie: alice, input: { title: "Changed after queue" } });
      await assert.rejects(runner.runOnce(), { status: 409 });
      assert.equal((await database.pool.query("SELECT state FROM media_jobs WHERE id = $1", [queued.body.id])).rows[0].state, "failed");
    });
    await t.test("independent direct grants survive pack revocation; restricted A-List does not leak", async () => {
      await send(`/api/dubs/${privateDub.id}/grants`, { method: "POST", cookie: alice, input: { userId: "spike-bob" } });
      assert.equal((await send(`/api/dubs/${privateDub.id}/audio`, { cookie: bob })).status, 200);
      assert.equal((await send(`/api/packs/${privatePack.id}`, { cookie: bob })).status, 404);
      await send(`/api/dubs/${privateDub.id}/grants/spike-bob`, { method: "DELETE", cookie: alice });
      assert.equal((await send(`/api/dubs/${privateDub.id}/audio`, { cookie: bob })).status, 404);
      const alist = await dub("alist");
      const alistPack = await pack("alist", [alist.id]);
      await publish(alistPack.id);
      for (const path of ["/api/community", "/api/dubs/search"]) {
        const hidden = await send(path, { cookie: bob });
        assert.ok(!hidden.body.dubs.some((dub) => dub.id === alist.id));
        assert.ok(!hidden.body.packs.some((pack) => pack.id === alistPack.id));
      }
      for (const path of [`/api/dubs/${alist.id}/audio`, `/api/packs/${alistPack.id}`]) {
        for (const cookie of [undefined, bob, charlie]) assert.equal((await send(path, { cookie })).status, 404);
        assert.equal((await send(path, { cookie: dana })).status, 200);
      }
      const publicAlist = await dub("alist", { aListPublic: true });
      assert.equal((await send(`/api/dubs/${publicAlist.id}/audio`)).body.length, 44 + 30 * 32000);
      assert.equal((await send(`/api/dubs/${publicAlist.id}/audio`, { cookie: bob })).body.length, wave().length);
    });
    await t.test("canceling a real processor leaves retryable state without publication", async () => {
      const id = await upload();
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(runner.runOnce({ signal: controller.signal }));
      assert.equal((await send(`/api/uploads/${id}`, { cookie: alice })).body.state, "uploaded");
      await database.pool.query("UPDATE media_jobs SET available_at = now() WHERE asset_id = $1", [id]);
      await runner.runOnce();
      assert.equal((await send(`/api/uploads/${id}`, { cookie: alice })).body.state, "ready");
      await send(`/api/uploads/${id}`, { method: "DELETE", cookie: alice });
      await reconcile(database, disk, { logger });
    });
    await t.test("uncertain commit acknowledgment cannot delete a committed ready preview", async () => {
      const id = await upload();
      let transactions = 0;
      const uncertain = {
        ...database,
        async transaction(work) {
          const result = await database.transaction(work);
          if (++transactions === 2) throw Object.assign(new Error("Synthetic lost commit acknowledgment"), { code: "ECONNRESET" });
          return result;
        },
      };
      await assert.rejects(createMediaRunner(uncertain, disk, { logger }).runOnce(), { code: "ECONNRESET" });
      const asset = (await database.pool.query("SELECT * FROM media_assets WHERE id = $1", [id])).rows[0];
      assert.equal(asset.state, "ready");
      await disk.verify(asset.preview_key, asset.preview_bytes, asset.preview_checksum);
      assert.equal((await database.pool.query("SELECT state FROM media_jobs WHERE asset_id = $1", [id])).rows[0].state, "done");
      await send(`/api/uploads/${id}`, { method: "DELETE", cookie: alice });
      await reconcile(database, disk, { logger });
    });
    await t.test("global leasing caps concurrency at two and recovers expired slots", async () => {
      const ids = await Promise.all([upload(wave(1)), upload(wave(1)), upload(wave(1))]);
      const claims = await Promise.all([claimJob(database), claimJob(database), claimJob(database)]);
      assert.equal(claims.filter(Boolean).length, 2);
      assert.equal(claims.filter((job) => job === null).length, 1);
      await database.pool.query("UPDATE media_jobs SET lease_until = now() - interval '1 second' WHERE asset_id = ANY($1::text[]) AND state = 'running'", [ids]);
      for (let index = 0; index < 3; index++) await runner.runOnce();
      for (const id of ids) {
        assert.equal((await send(`/api/uploads/${id}`, { cookie: alice })).body.state, "ready");
        await send(`/api/uploads/${id}`, { method: "DELETE", cookie: alice });
      }
      await reconcile(database, disk, { logger });
    });
    await t.test("tampered original bytes fail closed and quota/deletion cannot bypass references", async () => {
      const asset = (await database.pool.query("SELECT a.* FROM media_assets a JOIN media_dubs d ON d.asset_id = a.id WHERE d.id = $1", [publicDub.id])).rows[0];
      assert.equal((await send(`/api/uploads/${asset.id}`, { method: "DELETE", cookie: alice })).status, 409);
      await writeFile(disk.path(asset.stored_key), Buffer.from("tampered"));
      assert.equal((await send(`/api/dubs/${publicDub.id}/audio`, { cookie: bob })).status, 503);
      await writeFile(disk.path(asset.stored_key), wave());
      const reservations = [];
      for (let index = 0; index < 10; index++) {
        const reserved = await send("/api/uploads", { method: "POST", cookie: charlie, input: { fileName: "quota.wav", bytes: 104857600 } });
        assert.equal(reserved.status, 201);
        reservations.push(reserved.body.id);
      }
      assert.equal((await send("/api/uploads", { method: "POST", cookie: charlie, input: { fileName: "quota.wav", bytes: 104857600 } })).status, 429);
      for (const id of reservations) await send(`/api/uploads/${id}`, { method: "DELETE", cookie: charlie });
      await reconcile(database, disk, { logger });
    });
    await t.test("reconciliation removes only old unknown files and expired unclaimed assets", async () => {
      const id = await reserve(wave(1), bob);
      await database.pool.query("UPDATE media_assets SET expires_at = now() - interval '1 second' WHERE id = $1", [id]);
      const old = disk.newKey(".wav");
      const young = disk.newKey(".wav");
      await writeFile(disk.path(old), "old orphan");
      await writeFile(disk.path(young), "new uncommitted attempt");
      const ago = new Date(Date.now() - 7200000);
      await utimes(disk.path(old), ago, ago);
      const result = await reconcile(database, disk, { logger });
      assert.ok(result.deletedAssets >= 1);
      assert.ok(result.orphans >= 1);
      assert.ok(!existsSync(disk.path(old)));
      assert.ok(existsSync(disk.path(young)));
      assert.ok(existsSync(join(disk.root, ".cre8-spike")));
      assert.equal((await send(`/api/uploads/${id}`, { cookie: bob })).body.state, "deleted");
      assert.ok((await readdir(disk.root)).length > 1);
      const damaged = (await database.pool.query("SELECT a.* FROM media_assets a JOIN media_dubs d ON d.asset_id = a.id WHERE d.id = $1", [publicDub.id])).rows[0];
      await writeFile(disk.path(damaged.preview_key), "damaged preview");
      const integrity = await reconcile(database, disk, { logger });
      assert.equal(integrity.damagedAssets, 1);
      assert.equal((await send(`/api/dubs/${publicDub.id}/audio`)).status, 404);
      assert.equal((await send(`/api/uploads/${damaged.id}`, { cookie: alice })).body.state, "failed");
      const logged = JSON.stringify(logs);
      for (const sensitive of [alice, bob, config.connectionString, "Synthetic shared pack", fixtureAccounts[0].password]) {
        assert.ok(!logged.includes(sensitive));
      }
    });
  } finally {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await database.close();
  }
});
