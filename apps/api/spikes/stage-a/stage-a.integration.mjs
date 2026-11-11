import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createSpikeDatabase, migrate, readSpikeConfig } from "./database.mjs";
import { fixtureAccounts, seedFixtures } from "./fixtures.mjs";
import { createStageAServer } from "./server.mjs";
import { hashToken } from "./store.mjs";

const config = readSpikeConfig();

test("Stage A against isolated real PostgreSQL", async (t) => {
  const logs = [];
  const logger = { error: (...args) => logs.push(args) };
  let database = createSpikeDatabase(config, { logger });
  const otherDatabase = createSpikeDatabase(config, { logger });
  const servers = new Set();
  const prefix = randomUUID();
  const key = () => randomUUID();
  let a;
  let b;
  let alice;
  let bob;
  let crate;
  const stop = async (server) => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    servers.delete(server);
  };
  const start = async (db) => {
    const server = await createStageAServer({ database: db, logger });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    servers.add(server);
    return { server, base: `http://127.0.0.1:${server.address().port}` };
  };
  async function call(target, path, { method = "GET", cookie, body, requestKey, headers = {} } = {}) {
    const response = await fetch(target.base + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(requestKey ? { "idempotency-key": requestKey } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function login(target, account) {
    const result = await call(target, "/api/login", { method: "POST", body: { username: account.username, password: account.password } });
    assert.equal(result.status, 200);
    assert.match(result.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
    assert.match(result.headers.get("cache-control"), /no-store/);
    return result.headers.get("set-cookie").split(";")[0];
  }
  const count = async (table) => Number((await database.pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
  try {
    await t.test("migrations serialize, verify checksums and seeds do not reset hashes", async () => {
      const initial = await database.pool.query("SELECT to_regclass('cre8_stage_a.schema_migrations') AS relation");
      if (!initial.rows[0].relation) {
        const sql = (await readFile(new URL("./001-initial.sql", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
        await database.transaction(async (client) => {
          await client.query("CREATE SCHEMA IF NOT EXISTS cre8_stage_a");
          await client.query(sql);
          await client.query("INSERT INTO schema_migrations(version, checksum) VALUES (1, $1)", [createHash("sha256").update(sql).digest("hex")]);
        });
        await seedFixtures(database);
        await database.pool.query("INSERT INTO crates(id, user_id, name, name_key) VALUES ('spike-upgrade-preserved', 'spike-alice', 'Preserved upgrade fixture', 'preserved upgrade fixture')");
      }
      const preserved = await database.pool.query("SELECT id, name FROM crates WHERE id = 'spike-upgrade-preserved'");
      await Promise.all([migrate(database), migrate(otherDatabase)]);
      assert.deepEqual((await database.pool.query("SELECT id, name FROM crates WHERE id = 'spike-upgrade-preserved'")).rows, preserved.rows);
      await seedFixtures(database);
      const before = (await database.pool.query("SELECT password_hash FROM users WHERE id = 'spike-alice'")).rows[0].password_hash;
      await seedFixtures(database);
      assert.equal((await database.pool.query("SELECT password_hash FROM users WHERE id = 'spike-alice'")).rows[0].password_hash, before);
      assert.equal(await count("schema_migrations"), 2);
      assert.equal(await count("artists"), 2);
      a = await start(database);
      b = await start(otherDatabase);
      assert.equal((await call(a, "/api/health")).status, 200);
    });
    await t.test("login and session hashes are shared; credentials remain bounded", async () => {
      const wrong = await call(a, "/api/login", { method: "POST", body: { username: fixtureAccounts[0].username, password: "incorrect" } });
      assert.equal(wrong.status, 401);
      alice = await login(a, fixtureAccounts[0]);
      bob = await login(b, fixtureAccounts[1]);
      const token = alice.split("=")[1];
      const saved = await database.pool.query("SELECT token_hash FROM sessions WHERE token_hash = $1", [hashToken(token)]);
      assert.equal(saved.rows[0].token_hash, hashToken(token));
      assert.notEqual(saved.rows[0].token_hash, token);
      assert.equal((await call(b, "/api/session", { cookie: alice })).body.user.id, "spike-alice");
      assert.equal((await call(a, "/api/session", { cookie: "cre8_session=broken" })).status, 401);
      assert.equal((await call(a, "/api/login", { method: "POST", body: { username: "missing", password: "x".repeat(129) } })).status, 401);
    });
    await t.test("100 concurrent acknowledged writes survive a fresh API and connection pool", async () => {
      const responses = await Promise.all(Array.from({ length: 100 }, (_, index) => call(index % 2 ? a : b, "/api/crates", {
        method: "POST", cookie: alice, requestKey: key(), body: { name: `${prefix}-${index}` },
      })));
      for (const result of responses) assert.equal(result.status, 201, JSON.stringify(result.body));
      assert.equal(new Set(responses.map((result) => result.body.id)).size, 100);
      await stop(a.server);
      await database.close();
      database = createSpikeDatabase(config, { logger });
      a = await start(database);
      assert.equal((await call(a, "/api/session", { cookie: alice })).status, 200);
      const saved = await call(a, "/api/crates", { cookie: alice });
      const ids = new Set(saved.body.crates.map((item) => item.id));
      for (const result of responses) assert.ok(ids.has(result.body.id));
      crate = responses[0].body;
    });
    await t.test("concurrent retries commit one crate, idempotency record and event", async () => {
      const requestKey = key();
      const before = { crates: await count("crates"), events: await count("outbox"), requests: await count("idempotency_records") };
      const responses = await Promise.all(Array.from({ length: 10 }, (_, index) => call(index % 2 ? a : b, "/api/crates", {
        method: "POST", cookie: alice, requestKey, body: { name: `${prefix}-retry` },
      })));
      for (const response of responses) {
        assert.equal(response.status, 201);
        assert.deepEqual(response.body, responses[0].body);
      }
      assert.equal(await count("crates"), before.crates + 1);
      assert.equal(await count("outbox"), before.events + 1);
      assert.equal(await count("idempotency_records"), before.requests + 1);
      assert.equal((await call(a, "/api/crates", {
        method: "POST", cookie: alice, requestKey, body: { name: "different payload" },
      })).status, 409);
      assert.equal((await call(a, "/api/crates", { method: "POST", cookie: alice, body: { name: "no key" } })).status, 400);
      assert.equal((await call(b, "/api/crates", {
        method: "POST", cookie: bob, requestKey, body: { name: `${prefix}-retry` },
      })).status, 201, "Keys and names are actor-scoped.");
    });
    await t.test("commit failure leaves no visible crate, retry record or outbox event", async () => {
      await database.pool.query(`
        CREATE FUNCTION stage_a_test_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF EXISTS (SELECT 1 FROM crates WHERE id = NEW.aggregate_id AND name_key = 'stage a commit failure') THEN
            RAISE EXCEPTION 'synthetic commit failure' USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END $$;
        CREATE CONSTRAINT TRIGGER stage_a_test_commit_failure
          AFTER INSERT ON outbox DEFERRABLE INITIALLY DEFERRED
          FOR EACH ROW EXECUTE FUNCTION stage_a_test_commit_failure();
      `);
      const before = { crates: await count("crates"), events: await count("outbox"), requests: await count("idempotency_records") };
      const requestKey = key();
      try {
        const failed = await call(a, "/api/crates", {
          method: "POST", cookie: alice, requestKey, body: { name: "Stage A commit failure" },
        });
        assert.equal(failed.status, 503);
        assert.equal(await count("crates"), before.crates);
        assert.equal(await count("outbox"), before.events);
        assert.equal(await count("idempotency_records"), before.requests);
        assert.ok(!(await call(b, "/api/crates", { cookie: alice })).body.crates.some((item) => item.name === "Stage A commit failure"));
      } finally {
        await database.pool.query("DROP TRIGGER stage_a_test_commit_failure ON outbox; DROP FUNCTION stage_a_test_commit_failure()");
      }
      const retry = await call(b, "/api/crates", {
        method: "POST", cookie: alice, requestKey, body: { name: "Stage A commit failure" },
      });
      assert.equal(retry.status, 201, "A failed transaction must not consume the retry key.");
      await call(a, `/api/crates/${retry.body.id}`, { method: "DELETE", cookie: alice, requestKey: key() });
    });
    await t.test("owner scope, normalized uniqueness and ordered membership remain consistent", async () => {
      const created = await call(a, "/api/crates", { method: "POST", cookie: alice, requestKey: key(), body: { name: `  ${prefix}-Name  ` } });
      assert.equal(created.status, 201);
      assert.equal(created.body.name, `${prefix}-Name`);
      assert.equal((await call(b, "/api/crates", { method: "POST", cookie: alice, requestKey: key(), body: { name: `${prefix}-NAME` } })).status, 409);
      const path = `/api/crates/${crate.id}`;
      assert.equal((await call(b, path, { cookie: bob })).status, 404);
      assert.equal((await call(b, path, { method: "PATCH", cookie: bob, requestKey: key(), body: { name: "Stolen" } })).status, 404);
      assert.equal((await call(a, path, { method: "PATCH", cookie: alice, requestKey: key(), body: { name: `${prefix}-renamed` } })).status, 200);
      assert.equal((await call(a, path + "/dubs/spike-bob-private", { method: "PUT", cookie: alice, requestKey: key() })).status, 404);
      const added = await Promise.all(["spike-public", "spike-alice-private", "spike-public"].map((id) =>
        call(b, `${path}/dubs/${id}`, { method: "PUT", cookie: alice, requestKey: key() })));
      for (const response of added) assert.equal(response.status, 200);
      const read = await call(a, path, { cookie: alice });
      assert.equal(read.body.dubIds.length, 2);
      assert.deepEqual(new Set(read.body.dubIds), new Set(["spike-public", "spike-alice-private"]));
      assert.deepEqual((await call(b, path, { cookie: alice })).body.dubIds, read.body.dubIds);
      await call(a, path + "/dubs/spike-public", { method: "DELETE", cookie: alice, requestKey: key() });
      const readded = await call(a, path + "/dubs/spike-public", { method: "PUT", cookie: alice, requestKey: key() });
      assert.deepEqual(readded.body.dubIds, ["spike-alice-private", "spike-public"]);
      assert.equal((await call(a, path, { method: "DELETE", cookie: bob, requestKey: key() })).status, 404);
      assert.equal((await call(a, path, { method: "DELETE", cookie: alice, requestKey: key() })).status, 200);
      assert.equal((await call(b, path, { cookie: alice })).status, 404);
      assert.equal((await database.pool.query("SELECT * FROM crate_items WHERE crate_id = $1", [crate.id])).rowCount, 0);
    });
    await t.test("expiry and logout revoke sessions across both instances", async () => {
      const expiredCookie = await login(a, fixtureAccounts[0]);
      await database.pool.query("UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
        [hashToken(expiredCookie.split("=")[1])]);
      for (const target of [a, b]) assert.equal((await call(target, "/api/session", { cookie: expiredCookie })).status, 401);
      assert.equal((await call(b, "/api/logout", { method: "POST", cookie: alice })).status, 200);
      for (const target of [a, b]) {
        assert.equal((await call(target, "/api/session", { cookie: alice })).status, 401);
        assert.equal((await call(target, "/api/crates", {
          method: "POST", cookie: alice, requestKey: key(), body: { name: "revoked" },
        })).status, 401);
      }
    });
    await t.test("unavailable database fails closed without leaking credentials", async () => {
      const unavailable = createSpikeDatabase(config, { logger });
      const target = await start(unavailable);
      await unavailable.close();
      try {
        assert.equal((await call(target, "/api/session", { cookie: bob })).status, 503);
        assert.equal((await call(target, "/api/health")).status, 503);
        const result = await call(target, "/api/crates", {
          method: "POST", cookie: bob, requestKey: key(), body: { name: "database unavailable" },
        });
        assert.equal(result.status, 503);
        assert.equal(result.body.error, "Stage A database operation failed.");
        assert.equal((await database.pool.query("SELECT * FROM crates WHERE name = 'database unavailable'")).rowCount, 0);
      } finally {
        await stop(target.server);
      }
      const logged = JSON.stringify(logs);
      assert.ok(logs.length > 0);
      for (const secret of [config.connectionString, bob, fixtureAccounts[0].password]) assert.ok(!logged.includes(secret));
    });
    await t.test("malformed input and foreign origins fail explicitly", async () => {
      assert.equal((await call(a, "/api/login", { method: "POST", body: [], headers: {} })).status, 400);
      assert.equal((await call(a, "/api/login", { method: "POST", body: { padding: "x".repeat(17000) } })).status, 413);
      const malformed = await fetch(a.base + "/api/login", {
        method: "POST", headers: { "content-type": "application/json" }, body: "{",
      });
      assert.equal(malformed.status, 400);
      await malformed.arrayBuffer();
      assert.equal((await call(a, "/api/crates/%xx", { cookie: bob })).status, 400);
      assert.equal((await call(a, "/api/logout", { method: "POST", cookie: bob, headers: { origin: "https://untrusted.example" } })).status, 403);
      assert.equal((await call(a, "/api/crates", { cookie: bob })).status, 200);
    });
    await t.test("migration refuses unrelated tables and schema drift", async () => {
      await database.pool.query("CREATE TABLE public.stage_a_foreign_fixture (id integer)");
      try {
        await assert.rejects(migrate(database), /non-spike tables/);
      } finally {
        await database.pool.query("DROP TABLE public.stage_a_foreign_fixture");
      }
      const { rows } = await database.pool.query("SELECT checksum FROM schema_migrations WHERE version = 1");
      await database.pool.query("UPDATE schema_migrations SET checksum = 'changed' WHERE version = 1");
      try {
        await assert.rejects(migrate(database), /checksum mismatch/);
        await assert.rejects(createStageAServer({ database, logger }), /schema version\/checksum mismatch/);
      } finally {
        await database.pool.query("UPDATE schema_migrations SET checksum = $1 WHERE version = 1", [rows[0].checksum]);
      }
    });
  } finally {
    await Promise.all([...servers].map(stop));
    await Promise.all([database.close(), otherDatabase.close()]);
  }
});
