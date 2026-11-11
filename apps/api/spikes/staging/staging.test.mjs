import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { createStageBServer } from "../stage-b/routes.mjs";
import { createStagingAdmission } from "./admission.mjs";
import { startStagingRuntime } from "./runtime.mjs";
import { readStagingConfig } from "./config.mjs";

test("staging configuration requires opt-in, Node 22 and its dedicated resources", () => {
  const valid = {
    SPIKE_STAGING_ACK: "isolated-synthetic-only", SPIKE_RUN_ID: "render_stage",
    SPIKE_DATABASE_URL: "postgres://localhost/cre8_spike_render_stage",
    SPIKE_MEDIA_DIRECTORY: "/var/data/cre8_spike_render_stage",
  };
  assert.equal(readStagingConfig(valid, "22").port, 10000);
  assert.equal(readStagingConfig({ ...valid, SPIKE_STAGING_PAUSED: "true" }, "22").paused, true);
  assert.throws(() => readStagingConfig(valid, "26"), /Node 22/);
  for (const change of [
    { SPIKE_STAGING_ACK: undefined }, { SPIKE_RUN_ID: "another_stage" },
    { SPIKE_DATABASE_URL: "postgres://localhost/community" },
    { SPIKE_DATABASE_URL: "postgres://remote.example/cre8_spike_render_stage" },
    { SPIKE_MEDIA_DIRECTORY: "/var/data/audio" },
    { PORT: "3002" }, { PORT: "80" }, { PORT: "NaN" }, { PORT: "65536" },
    { SPIKE_STAGING_PAUSED: "yes" },
  ]) assert.throws(() => readStagingConfig({ ...valid, ...change }, "22"));
});

function response() {
  const result = new EventEmitter();
  result.headers = {};
  result.setHeader = (key, value) => { result.headers[key] = value; };
  return result;
}

test("staging admission bounds active requests, auth, uploads and fixed-window rates", () => {
  let time = 0;
  const admit = createStagingAdmission({ now: () => time });
  const request = (method, url) => ({ method, url });
  const login = request("POST", "/api/login?test=1");
  const first = response();
  admit(login, first);
  const denied = response();
  assert.throws(() => admit(request("POST", "http://localhost/api/login"), denied), { status: 429 });
  assert.equal(denied.headers["retry-after"], "60");
  assert.equal(denied.headers.connection, "close");
  first.emit("finish");
  first.emit("close");
  for (let i = 0; i < 4; i++) {
    const result = response();
    admit(login, result);
    result.emit("close");
  }
  assert.throws(() => admit(login, response()), { status: 429 });
  time = 60000;
  const uploading = response();
  admit(request("PUT", "/api/uploads/one"), uploading);
  assert.throws(() => admit(request("PUT", "/api/uploads/two"), response()), { status: 429 });
  const reading = response();
  admit(request("GET", "/api/session"), reading);
  assert.throws(() => admit(request("GET", "/api/session"), response()), { status: 429 });
  uploading.emit("close");
  reading.emit("finish");
  for (let i = 0; i < 118; i++) {
    const result = response();
    admit(request("GET", "/api/session"), result);
    result.emit("finish");
  }
  assert.throws(() => admit(request("GET", "/api/session"), response()), { status: 429 });
  time = 120000;
  const next = response();
  admit(login, next);
  next.emit("finish");
});

test("Stage B wires admission before routes and releases rejected request resources", async (t) => {
  const parent = await mkdtemp(join(tmpdir(), "cre8-staging-admission-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const rows = await Promise.all(["../stage-a/001-initial.sql", "../stage-b/002-media.sql"].map(async (path, index) => ({
    version: index + 1,
    checksum: createHash("sha256").update((await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n")).digest("hex"),
  })));
  let healthQueries = 0;
  const database = { pool: { async query(sql) {
    if (sql === "SELECT 1") healthQueries++;
    return { rows };
  } } };
  const admit = createStagingAdmission();
  let admitted = 0;
  const { server } = await createStageBServer({
    database, directory: join(parent, "cre8_spike_test_stage"), runId: "test_stage",
    logger: { error() {} },
    admit(request, result) { admitted++; admit(request, result); },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (let i = 0; i < 120; i++) {
    const result = await fetch(base + "/api/health");
    assert.equal(result.status, 200);
    await result.arrayBuffer();
  }
  const limited = await fetch(base + "/api/health");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  await limited.arrayBuffer();
  assert.equal(healthQueries, 120);
  assert.equal(admitted, 121);
});

async function eventually(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await delay(10);
  }
  assert.fail("Staging state did not converge.");
}

test("staging exposes only cached health, supervises one worker and fails closed on dependency errors", async (t) => {
  const logs = [];
  let queries = 0;
  let dependencyError = false;
  let diskError = false;
  let workerError = false;
  let working = 0;
  let maximumWorking = 0;
  const server = createServer((request, result) => result.end("loopback only"));
  const runtime = await startStagingRuntime({
    database: { pool: { async query() {
      queries++;
      if (dependencyError) throw Object.assign(new Error("not for logs"), { code: "TEST_DB" });
    } } },
    disk: { async capacity() { if (diskError) throw Object.assign(new Error("private path"), { code: "TEST_DISK" }); } },
    server, port: 0, host: "127.0.0.1", loopbackPort: 0, pollMilliseconds: 10, probeMilliseconds: 10,
    logger: { error: (...args) => logs.push(args), info: (...args) => logs.push(args) },
    runner: { async runOnce({ signal }) {
      working++;
      maximumWorking = Math.max(maximumWorking, working);
      try {
        await delay(5);
        if (workerError) throw Object.assign(new Error("decoder details"), { code: "TEST_WORKER" });
        if (signal.aborted) return false;
        return false;
      } finally { working--; }
    } },
  });
  t.after(() => runtime.close());
  const base = `http://127.0.0.1:${runtime.health.address().port}`;
  const status = async () => {
    const result = await fetch(base + "/api/health");
    await result.arrayBuffer();
    return result.status;
  };
  await eventually(async () => await status() === 200);
  for (const [method, path] of [["GET", "/api/login"], ["POST", "/api/login"], ["GET", "/api/health?x=1"], ["POST", "/api/health"], ["GET", "/api/dubs/a/audio"]]) {
    const result = await fetch(base + path, { method });
    assert.equal(result.status, 404);
    assert.deepEqual(await result.json(), { error: "Not found." });
  }
  const head = await fetch(base + "/api/health", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const before = queries;
  await Promise.all(Array.from({ length: 10 }, status));
  assert.ok(queries - before < 10, "Public health must not run a database query per request.");
  dependencyError = true;
  await eventually(async () => await status() === 503);
  dependencyError = false;
  await eventually(async () => await status() === 200);
  diskError = true;
  await eventually(async () => await status() === 503);
  diskError = false;
  await eventually(async () => await status() === 200);
  workerError = true;
  await eventually(async () => await status() === 503);
  workerError = false;
  await eventually(async () => await status() === 200);
  assert.equal(maximumWorking, 1);
  assert.ok(logs.some(([, fields]) => fields.code === "TEST_DB"));
  assert.ok(logs.some(([, fields]) => fields.code === "TEST_DISK"));
  assert.ok(logs.some(([, fields]) => fields.code === "TEST_WORKER"));
  assert.doesNotMatch(JSON.stringify(logs), /not for logs|private path|decoder details/);
  const first = runtime.close();
  assert.equal(runtime.close(), first);
  await first;
  assert.equal(server.listening, false);
  assert.equal(runtime.health.listening, false);
  assert.equal(working, 0);
});

test("staging shutdown cancels an active worker and drains it before returning", async () => {
  let started;
  const starting = new Promise((resolve) => { started = resolve; });
  let canceled = false;
  const server = createServer();
  const runtime = await startStagingRuntime({
    database: { pool: { async query() {} } }, disk: { async capacity() {} },
    server, port: 0, host: "127.0.0.1", loopbackPort: 0,
    logger: { error() {}, info() {} },
    runner: { async runOnce({ signal }) {
      started();
      await new Promise((resolve) => signal.addEventListener("abort", () => {
        canceled = true;
        resolve();
      }, { once: true }));
    } },
  });
  await starting;
  await runtime.close();
  assert.equal(canceled, true);
  assert.equal(server.listening, false);
  assert.equal(runtime.health.listening, false);
});

test("paused staging keeps dependencies observable but starts no harness listener or worker", async (t) => {
  let jobs = 0;
  const server = createServer();
  const runtime = await startStagingRuntime({
    database: { pool: { async query() {} } }, disk: { async capacity() {} },
    server, port: 0, host: "127.0.0.1", loopbackPort: 0, paused: true,
    logger: { error() {}, info() {} },
    runner: { async runOnce() { jobs++; } },
  });
  t.after(() => runtime.close());
  const base = `http://127.0.0.1:${runtime.health.address().port}`;
  await eventually(async () => {
    const result = await fetch(base + "/api/health");
    return (await result.json()).status === "paused";
  });
  assert.equal(server.listening, false);
  assert.equal(jobs, 0);
});

test("cached readiness expires at exactly 15 seconds without querying on public requests", async (t) => {
  let time = 100000;
  let queries = 0;
  const runtime = await startStagingRuntime({
    database: { pool: { async query() { queries++; } } }, disk: { async capacity() {} },
    server: createServer(), port: 0, host: "127.0.0.1", paused: true, now: () => time,
    probeMilliseconds: 60000, logger: { error() {}, info() {} },
    runner: { async runOnce() { assert.fail("Paused worker must not run."); } },
  });
  t.after(() => runtime.close());
  const base = `http://127.0.0.1:${runtime.health.address().port}`;
  const status = async () => {
    const result = await fetch(base + "/api/health");
    await result.arrayBuffer();
    return result.status;
  };
  await eventually(async () => await status() === 200);
  time += 14999;
  assert.equal(await status(), 200);
  time++;
  assert.equal(await status(), 503);
  assert.equal(queries, 1);
});
