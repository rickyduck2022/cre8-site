import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import WebSocket from "ws";
import { createCommunityPostgres, readCommunityDatabaseConfig } from "../src/communityPostgres.mjs";
import { createPostgresApiServer, createSeedState } from "../src/server.mjs";
import { afterCommit, afterRollback, respondAfterCommit } from "../src/commitEffects.mjs";

const config = readCommunityDatabaseConfig();
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(config.connectionString).hostname)
  || !config.name.startsWith("cre8_community_test_")) {
  throw new Error("Integration tests require a disposable loopback cre8_community_test_* database.");
}

function wave() {
  const pcm = Buffer.alloc(35 * 32000);
  const header = Buffer.alloc(44);
  header.write("RIFF"); header.writeUInt32LE(pcm.length + 36, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

test("complete community API against real isolated PostgreSQL", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "cre8-community-pg-"));
  const mediaDirectory = join(directory, "audio");
  const webDirectory = join(directory, "web");
  const adminDirectory = join(directory, "admin");
  const jsonPath = join(directory, "must-not-exist.json");
  await Promise.all([mkdir(mediaDirectory), mkdir(webDirectory), mkdir(adminDirectory)]);
  await writeFile(join(webDirectory, "index.html"), "<main>community frontend</main>");
  await writeFile(join(adminDirectory, "index.html"), "<main>admin frontend</main>");
  const logs = [];
  let storage = createCommunityPostgres(config, { logger: { error: (...args) => logs.push(args) } });
  const other = createCommunityPostgres(config);
  let otherClosed = false;
  const servers = new Set();
  const sockets = new Set();
  const previousAdmins = process.env.ADMIN_USERNAMES;
  process.env.ADMIN_USERNAMES = "meladee";
  let base;
  let second;
  let owner;
  let friend;
  let outsider;
  let friendId;
  let buddyId;
  let dub;
  let pack;
  let ownerId;
  let artistId;
  let committedResponse = false;
  const original = wave();
  const options = { dataPath: jsonPath, mediaDirectory, webDirectory, adminDirectory,
    guidesDirectory: join(directory, "guides"), publicAudioDirectory: join(directory, "public-audio"),
    adminSeed: {}, pushService: null };
  const start = async (store) => {
    const { server } = await createPostgresApiServer({ ...options, storage: store });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    servers.add(server);
    return { server, base: `http://127.0.0.1:${server.address().port}` };
  };
  const close = async (server) => {
    server.emit("shutdown");
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    servers.delete(server);
  };
  async function call(path, { method = "GET", cookie = owner, body, bytes, headers = {}, target = base } = {}) {
    return fetch(target + path, { method, headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers,
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : bytes !== undefined ? { body: bytes } : {}) });
  }
  async function json(path, opts) {
    const response = await call(path, opts);
    const body = await response.json();
    assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(body)}`);
    return body;
  }
  const snapshot = (cookie = owner) => json("/api/community", { cookie });
  async function register(username) {
    const response = await call("/api/register", { method: "POST", cookie: null,
      body: { username, displayName: username, password: "synthetic-password-only", genres: ["Jungle"] } });
    assert.equal(response.status, 201);
    await response.arrayBuffer();
    return response.headers.get("set-cookie").split(";")[0];
  }
  async function upload(name = "original.wav", cookie = owner, type) {
    const response = await call(`/api/uploads${type ? `?type=${type}` : ""}`, {
      method: "POST", cookie, bytes: type ? Buffer.from("synthetic artwork") : original,
      headers: { "x-file-name": name, "content-type": type ? "image/png" : "audio/wav" },
    });
    assert.equal(response.status, 201);
    return (await response.json()).uploadId;
  }
  async function connect(cookie = owner) {
    const socket = new WebSocket(base.replace("http", "ws") + "/api/chat", { headers: { cookie, origin: base } });
    sockets.add(socket);
    await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    return socket;
  }
  try {
    await t.test("explicit migration and initialization preserve existing identities and never create JSON files", async () => {
      await assert.rejects(start(storage));
      await Promise.all([storage.migrate(), other.migrate()]);
      const state = createSeedState();
      state.users[0].aListApproved = true;
      const hash = state.users[0].passwordHash;
      await storage.initialize(state);
      await assert.rejects(storage.initialize(state), /overwrite/);
      const first = await start(storage);
      base = first.base;
      second = await start(other);
      assert.equal((await storage.pool.query("SELECT payload->>'passwordHash' AS hash FROM cre8_community.records WHERE collection='users' AND payload->>'username'='meladee'")).rows[0].hash, hash);
      assert.equal(existsSync(jsonPath), false);
    });
    await t.test("same-origin web and admin pages remain served; database-backed health is available", async () => {
      assert.match(await (await call("/", { cookie: null })).text(), /community frontend/);
      assert.match(await (await call("/admin", { cookie: null })).text(), /admin frontend/);
      assert.equal((await json("/api/health", { cookie: null })).status, "ok");
    });
    await t.test("login and registration use the existing cookie and complete dashboard contract", async () => {
      const response = await call("/api/login", { method: "POST", cookie: null, body: { username: "meladee", password: "meladee" } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
      owner = response.headers.get("set-cookie").split(";")[0];
      await response.arrayBuffer();
      friend = await register("pg_friend");
      outsider = await register("pg_outsider");
      const state = await snapshot();
      ownerId = state.member.id; artistId = state.artists[0].id;
      friendId = (await snapshot(friend)).member.id;
      for (const key of ["member", "lastPlayback", "artists", "dubs", "packs", "sharedDubIds", "sharedPackIds", "buddies", "conversations", "likedDubIds", "suggestedMembers", "crates", "library", "aListApplication", "notifications"]) {
        assert.ok(Object.hasOwn(state, key), `Missing frontend contract field ${key}`);
      }
      const token = owner.split("=")[1];
      const rows = (await storage.pool.query("SELECT * FROM cre8_community.sessions")).rows;
      assert.ok(rows.some((row) => row.token_hash === createHash("sha256").update(token).digest("hex")));
      assert.equal(JSON.stringify(rows).includes(token), false);
      assert.equal((await call("/api/community", { cookie: owner, target: second.base })).status, 200);
    });
    await t.test("profile, member search and bidirectional friendships use existing shapes", async () => {
      assert.ok((await json("/api/members?q=pg_friend")).members.some((item) => item.id === friendId));
      const connected = await json("/api/buddies", { method: "POST", body: { username: "pg_friend" } });
      buddyId = connected.buddies.find((item) => item.username === "pg_friend").id;
      assert.ok((await snapshot(friend)).buddies.some((item) => item.username === "meladee"));
      const updated = await json("/api/profile", { method: "PATCH", body: { displayName: "Database Owner", bio: "Postgres profile", links: [{ label: "Website", url: "https://example.com" }] } });
      assert.equal(updated.member.displayName, "Database Owner");
    });
    await t.test("raw upload and dub creation/search/playback retain the frontend protocol", async () => {
      dub = await json("/api/dubs", { method: "POST", body: {
        uploadId: await upload(), title: "PostgreSQL release", artistId,
        distribution: "worldwide", durationSeconds: 35, tags: ["Jungle"], bpm: 170,
      } });
      assert.ok(dub.id);
      const results = await json("/api/dubs/search?q=PostgreSQL&distribution=worldwide");
      assert.ok(results.dubs.some((item) => item.id === dub.id));
      await json("/api/playback", { method: "PUT", body: { dubId: dub.id, positionSeconds: 4 } });
      assert.equal((await snapshot()).lastPlayback.dubId, dub.id);
      const bytes = await call(`/api/dubs/${dub.id}/audio`, { headers: { range: "bytes=0-43" } });
      assert.equal(bytes.status, 206);
      assert.deepEqual(Buffer.from(await bytes.arrayBuffer()), original.subarray(0, 44));
    });
    await t.test("guest links use actual clipped bytes and cannot obtain originals", async () => {
      const shared = await json(`/api/public/dubs/${dub.id}`, { cookie: null });
      assert.equal(shared.authenticated, false);
      const response = await call(`/api/public/dubs/${dub.id}/audio`, { cookie: null });
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.length, 30 * 32000 + 44);
      assert.equal((await call(`/api/public/dubs/${dub.id}/audio?download=1`, { cookie: null })).status, 401);
    });
    await t.test("crates, likes and download library preserve response and ordering contracts", async () => {
      const crate = await json("/api/crates", { method: "POST", body: { name: "Database crate" } });
      const filled = await json(`/api/crates/${crate.id}/dubs/${dub.id}`, { method: "PUT" });
      assert.deepEqual(filled.dubIds, [dub.id]);
      await json(`/api/dubs/${dub.id}/download`, { method: "POST" });
      const state = await snapshot();
      assert.ok(state.crates.some((item) => item.id === crate.id));
      assert.ok(state.likedDubIds.includes(dub.id));
      assert.ok(state.library.length);
    });
    await t.test("WebSocket snapshots and Messenger survive committed database writes", async () => {
      const socket = await connect(friend);
      const incoming = new Promise((resolve) => {
        socket.on("message", (raw) => {
          const message = JSON.parse(raw);
          if (message.type === "community.snapshot" && message.snapshot.conversations.some((item) => item.messages.some((entry) => entry.text === "Postgres chat"))) resolve(message.snapshot);
        });
      });
      await json(`/api/conversations/${buddyId}/messages`, { method: "POST", body: { text: "Postgres chat" } });
      assert.ok((await incoming).conversations.length);
      assert.ok((await json(`/api/conversations/${buddyId}/messages`)).messages.some((item) => item.text === "Postgres chat"));
      socket.terminate();
    });
    await t.test("sample pack publish and confirmed sharing keep classification separate from access", async () => {
      pack = (await json("/api/packs", { method: "POST", body: { title: "Database samples", kind: "sample", distribution: "private", licence: "Synthetic original audio." } })).pack;
      const added = await json(`/api/packs/${pack.id}/tracks`, { method: "POST", body: {
        uploadId: await upload(), title: "Private sample", artistId, durationSeconds: 35, requestId: randomUUID(),
      } });
      assert.ok(added.pack);
      assert.equal((await call(`/api/packs/${pack.id}`, { cookie: outsider })).status, 404);
      await json(`/api/packs/${pack.id}/publish`, { method: "POST", body: {} });
      assert.equal((await call(`/api/conversations/${buddyId}/messages`, { method: "POST", body: { text: "Private pack", packId: pack.id } })).status, 409);
      await json(`/api/conversations/${buddyId}/messages`, { method: "POST", body: { text: "Private pack", packId: pack.id, confirmPackAccess: true } });
      const received = await snapshot(friend);
      assert.ok(received.sharedPackIds.includes(pack.id));
      assert.ok(received.packs.find((item) => item.id === pack.id).items.every((item) => item.dub.mediaKind === "sample"));
      assert.equal((await call(`/api/packs/${pack.id}`, { cookie: outsider })).status, 404);
    });
    await t.test("existing pack download action and archive bytes work without new frontend routes", async () => {
      const result = await json(`/api/packs/${pack.id}/download`, { method: "POST", cookie: friend });
      assert.equal(result.downloadUrl, `/api/packs/${pack.id}/archive`);
      const archive = await call(result.downloadUrl, { cookie: friend });
      assert.equal(archive.status, 200);
      const bytes = Buffer.from(await archive.arrayBuffer());
      assert.equal(bytes.readUInt32LE(0), 0x04034b50);
      assert.ok(bytes.includes(original));
      assert.equal((await call(result.downloadUrl, { cookie: outsider })).status, 404);
      assert.equal((await call(result.downloadUrl, { cookie: null })).status, 401);
    });
    await t.test("admin, A-List and notification routes retain authorization and shape", async () => {
      assert.ok((await json("/api/admin/overview")).metrics);
      assert.equal((await call("/api/admin/overview", { cookie: friend })).status, 403);
      assert.equal((await call("/api/packs", { method: "POST", cookie: friend, body: { title: "Forbidden", distribution: "alist" } })).status, 403);
      assert.equal((await json("/api/push/config")).publicKey, null);
      assert.equal((await call("/api/push/subscription", { method: "POST", body: {} })).status, 503);
      await json("/api/notifications/read", { method: "POST" });
    });
    await t.test("A-List review and notification state commit through the full admin workflow", async () => {
      const application = await json("/api/alist/application", { method: "POST", cookie: outsider, body: {
        artistName: "Database applicant", roles: ["DJ"], djExperience: "Synthetic experience",
        producerExperience: "", events: ["Fixture event"], supporters: [], labels: [],
        social: {}, additionalInfo: "",
      } });
      assert.equal(application.status, "pending");
      const listed = await json("/api/admin/alist/applications");
      assert.ok(listed.applications.some((item) => item.id === application.id));
      await json(`/api/admin/alist/applications/${application.id}/decision`, { method: "POST", body: { action: "approve", note: "Synthetic approval" } });
      const approved = await snapshot(outsider);
      assert.equal(approved.member.aListApproved, true);
      assert.ok(approved.notifications.length);
      await json("/api/notifications/read", { method: "POST", cookie: outsider });
      assert.ok((await snapshot(outsider)).notifications.every((item) => item.read));
    });
    await t.test("profile artwork and dub replacement use the same upload protocol and remove old files after commit", async () => {
      const avatar = await upload("avatar.png", owner, "avatar");
      const state = await json("/api/profile", { method: "PATCH", body: { avatarUploadId: avatar } });
      assert.ok(state.member.avatarUrl);
      const avatarBytes = await call(state.member.avatarUrl);
      assert.equal(await avatarBytes.text(), "synthetic artwork");
      const old = (await storage.pool.query("SELECT payload->>'storedAudioName' AS name FROM cre8_community.records WHERE collection='dubs' AND payload->>'id'=$1", [dub.id])).rows[0].name;
      const changed = await json(`/api/dubs/${dub.id}`, { method: "PATCH", body: {
        title: "Replaced database release", artistId, uploadId: await upload(), durationSeconds: 35, tags: ["Jungle"],
      } });
      assert.equal(changed.title, "Replaced database release");
      assert.equal(existsSync(join(mediaDirectory, old)), false);
      const current = await call(`/api/dubs/${dub.id}/audio`);
      assert.deepEqual(Buffer.from(await current.arrayBuffer()), original);
    });
    await t.test("cross-origin writes fail before any mutation", async () => {
      assert.equal((await call("/api/crates", { method: "POST", body: { name: "Untrusted" }, headers: { origin: "https://untrusted.example" } })).status, 403);
      assert.equal((await snapshot()).crates.some((item) => item.name === "Untrusted"), false);
    });
    await t.test("two API instances serialize concurrent acknowledged writes without stale-state loss", async () => {
      const responses = await Promise.all(Array.from({ length: 10 }, (_, index) =>
        call("/api/crates", { method: "POST", body: { name: `Concurrent ${index}` }, target: index % 2 ? base : second.base })));
      for (const response of responses) {
        assert.equal(response.status, 201);
        await response.arrayBuffer();
      }
      assert.equal((await snapshot()).crates.filter((item) => item.name.startsWith("Concurrent ")).length, 10);
    });
    await t.test("commit failure emits no successful response, cookie, event or visible mutation", async () => {
      await storage.pool.query(`CREATE FUNCTION cre8_community.reject_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.collection = 'crates' AND NEW.payload->>'name' = 'Commit must fail' THEN RAISE EXCEPTION 'fixture failure'; END IF; RETURN NEW; END $$`);
      await storage.pool.query(`CREATE CONSTRAINT TRIGGER reject_fixture AFTER INSERT ON cre8_community.records
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cre8_community.reject_fixture()`);
      const socket = await connect();
      let events = 0;
      socket.on("message", (raw) => { if (JSON.parse(raw).type === "community.snapshot") events++; });
      const failed = await call("/api/crates", { method: "POST", body: { name: "Commit must fail" } });
      assert.equal(failed.status, 503);
      assert.equal(failed.headers.get("set-cookie"), null);
      assert.doesNotMatch(await failed.text(), /fixture failure|postgres:|password/i);
      assert.equal((await snapshot()).crates.some((item) => item.name === "Commit must fail"), false);
      assert.equal(events, 0);
      socket.terminate();
      await storage.pool.query("DROP TRIGGER reject_fixture ON cre8_community.records");
      await storage.pool.query("DROP FUNCTION cre8_community.reject_fixture()");
    });
    await t.test("registration and session creation roll back together when commit rejects the new identity", async () => {
      await storage.pool.query(`CREATE FUNCTION cre8_community.reject_registration() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF EXISTS (SELECT 1 FROM cre8_community.records WHERE collection='users'
          AND payload->>'id'=NEW.user_id AND payload->>'username'='pg_rollback_user')
          THEN RAISE EXCEPTION 'fixture registration failure'; END IF; RETURN NEW; END $$`);
      await storage.pool.query(`CREATE CONSTRAINT TRIGGER reject_registration AFTER INSERT ON cre8_community.sessions
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cre8_community.reject_registration()`);
      try {
        const failed = await call("/api/register", { method: "POST", cookie: null,
          body: { username: "pg_rollback_user", displayName: "Rollback", password: "synthetic-password-only" } });
        assert.equal(failed.status, 503);
        assert.equal(failed.headers.get("set-cookie"), null);
        await failed.arrayBuffer();
        const users = await storage.pool.query("SELECT 1 FROM cre8_community.records WHERE collection='users' AND payload->>'username'='pg_rollback_user'");
        assert.equal(users.rowCount, 0);
      } finally {
        await storage.pool.query("DROP TRIGGER reject_registration ON cre8_community.sessions");
        await storage.pool.query("DROP FUNCTION cre8_community.reject_registration()");
      }
    });
    await t.test("errors roll back dirty state and rollback effects; failed commands cannot leak into a later request", async () => {
      let rolledBack = false;
      await storage.run(undefined, () => {
        storage.data.crates.push({ id: "rollback-fixture", name: "No persistence", userId: ownerId, dubIds: [] });
        storage.markDirty();
        afterCommit(() => { committedResponse = true; });
        afterRollback(() => { rolledBack = true; });
        respondAfterCommit(400, () => {});
      });
      assert.equal(rolledBack, true);
      assert.equal(committedResponse, false);
      assert.equal((await snapshot()).crates.some((item) => item.id === "rollback-fixture"), false);
    });
    await t.test("lost commit acknowledgment does not run cleanup against committed media or acknowledge success", async () => {
      const connect = storage.pool.connect.bind(storage.pool);
      let failed = false;
      storage.pool.connect = (...args) => {
        if (args.length) return connect(...args);
        return connect().then((client) => new Proxy(client, {
          get(target, key) {
            if (key === "query") return async (...parameters) => {
              const result = await target.query(...parameters);
              if (!failed && parameters[0] === "COMMIT") {
                failed = true;
                throw Object.assign(new Error("Synthetic lost acknowledgment"), { code: "TEST_COMMIT_ACK" });
              }
              return result;
            };
            const value = Reflect.get(target, key);
            return typeof value === "function" ? value.bind(target) : value;
          },
        }));
      };
      let cleaned = false;
      let responded = false;
      try {
        await assert.rejects(storage.run(undefined, () => {
          storage.data.crates.push({ id: "uncertain-committed", userId: ownerId, name: "Uncertain committed", dubIds: [] });
          storage.markDirty();
          afterRollback(() => { cleaned = true; });
          respondAfterCommit(201, () => { responded = true; });
        }), { code: "TEST_COMMIT_ACK" });
      } finally { storage.pool.connect = connect; }
      assert.equal(cleaned, false);
      assert.equal(responded, false);
      assert.ok((await snapshot()).crates.some((item) => item.id === "uncertain-committed"));
    });
    await t.test("failed dub deletion retains its original bytes; successful deletion removes them after commit", async () => {
      const current = (await storage.pool.query("SELECT payload->>'storedAudioName' AS name FROM cre8_community.records WHERE collection='dubs' AND payload->>'id'=$1", [dub.id])).rows[0].name;
      const path = join(mediaDirectory, current);
      assert.equal(existsSync(path), true);
      await storage.pool.query(`CREATE FUNCTION cre8_community.reject_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NOT EXISTS (SELECT 1 FROM cre8_community.records WHERE collection='dubs'
          AND payload->>'title'='Replaced database release') THEN RAISE EXCEPTION 'fixture deletion failure'; END IF; RETURN NEW; END $$`);
      await storage.pool.query(`CREATE CONSTRAINT TRIGGER reject_deletion AFTER UPDATE ON cre8_community.metadata
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cre8_community.reject_deletion()`);
      try {
        const failed = await call(`/api/dubs/${dub.id}`, { method: "DELETE" });
        assert.equal(failed.status, 503);
        await failed.arrayBuffer();
        assert.deepEqual(await readFile(path), original);
        assert.ok((await snapshot()).dubs.some((item) => item.id === dub.id));
      } finally {
        await storage.pool.query("DROP TRIGGER reject_deletion ON cre8_community.metadata");
        await storage.pool.query("DROP FUNCTION cre8_community.reject_deletion()");
      }
      await json(`/api/dubs/${dub.id}`, { method: "DELETE" });
      assert.equal(existsSync(path), false);
      assert.equal((await snapshot()).dubs.some((item) => item.id === dub.id), false);
    });
    await t.test("session and domain records survive fresh API and pool creation; expiry fails closed", async () => {
      for (const server of [...servers]) await close(server);
      await other.close();
      otherClosed = true;
      await storage.close();
      storage = createCommunityPostgres(config, { logger: { error: (...args) => logs.push(args) } });
      const restarted = await start(storage);
      base = restarted.base;
      assert.equal((await snapshot()).member.id, ownerId);
      assert.ok((await snapshot(friend)).packs.some((item) => item.id === pack.id));
      const hash = createHash("sha256").update(outsider.split("=")[1]).digest("hex");
      await storage.pool.query("UPDATE cre8_community.sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1", [hash]);
      assert.equal((await call("/api/community", { cookie: outsider })).status, 401);
    });
    await t.test("logout revokes the durable session and closes its WebSocket", async () => {
      const socket = await connect(friend);
      const closed = new Promise((resolve) => socket.once("close", resolve));
      await json("/api/logout", { method: "POST", cookie: friend });
      await closed;
      assert.equal((await call("/api/community", { cookie: friend })).status, 401);
      assert.equal(existsSync(jsonPath), false);
    });
    await t.test("schema drift fails closed rather than returning stale data or falling back to JSON", async () => {
      await storage.pool.query("UPDATE cre8_community.metadata SET migration_checksum = 'changed'");
      assert.equal((await call("/api/community")).status, 503);
      assert.equal(existsSync(jsonPath), false);
      assert.ok(logs.length === 0);
    });
  } finally {
    if (previousAdmins === undefined) delete process.env.ADMIN_USERNAMES;
    else process.env.ADMIN_USERNAMES = previousAdmins;
    for (const socket of sockets) socket.terminate();
    for (const server of servers) await close(server);
    await storage.close();
    if (!otherClosed) await other.close();
    await rm(directory, { recursive: true, force: true });
  }
});
