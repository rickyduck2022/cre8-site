import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createCommunityPostgres, readCommunityDatabaseConfig, validateCommunityState } from "../src/communityPostgres.mjs";
import { createSeedState } from "../src/server.mjs";
import { inspectImport } from "../scripts/community-postgres.mjs";

test("community PostgreSQL configuration never falls back to JSON or permissive TLS", () => {
  const valid = {
    COMMUNITY_STORAGE: "postgres", COMMUNITY_DATABASE_NAME: "cre8_community_test_local",
    COMMUNITY_DATABASE_URL: "postgres://localhost/cre8_community_test_local",
  };
  assert.equal(readCommunityDatabaseConfig(valid).name, valid.COMMUNITY_DATABASE_NAME);
  for (const change of [
    { COMMUNITY_STORAGE: undefined }, { COMMUNITY_STORAGE: "json" },
    { COMMUNITY_DATABASE_NAME: "production" }, { COMMUNITY_DATABASE_URL: "postgres://localhost/community" },
    { COMMUNITY_DATABASE_URL: valid.COMMUNITY_DATABASE_URL + "?options=-csearch_path=public" },
    { COMMUNITY_DATABASE_URL: valid.COMMUNITY_DATABASE_URL + "?sslmode=no-verify" },
    { COMMUNITY_DATABASE_URL: valid.COMMUNITY_DATABASE_URL + "?sslmode=verify-full&sslmode=verify-full" },
    { COMMUNITY_DATABASE_URL: "postgres://remote.example/cre8_community_test_local" },
  ]) assert.throws(() => readCommunityDatabaseConfig({ ...valid, ...change }));
  assert.doesNotThrow(() => readCommunityDatabaseConfig({
    ...valid, COMMUNITY_DATABASE_URL: "postgres://remote.example/cre8_community_test_local?sslmode=verify-full",
  }));
  assert.throws(() => createCommunityPostgres({ connectionString: "postgres://localhost/production", name: valid.COMMUNITY_DATABASE_NAME }));
});

test("community import preserves hashes, source bytes and ordered domain records, and verifies media", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "cre8-community-import-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const mediaDirectory = join(directory, "audio");
  await mkdir(mediaDirectory);
  const source = join(directory, "source.json");
  const state = createSeedState();
  state.uploads.push({ id: "upload-one", userId: state.users[0].id, storedName: "one.wav", type: "audio" });
  await writeFile(join(mediaDirectory, "one.wav"), Buffer.from("synthetic original"));
  await writeFile(source, JSON.stringify(state));
  const before = await readFile(source);
  const inspected = await inspectImport(source, mediaDirectory);
  assert.deepEqual(inspected.initial.users, state.users);
  assert.equal(inspected.media[0].bytes, 18);
  assert.match(inspected.media[0].checksum, /^[a-f0-9]{64}$/);
  assert.deepEqual(await readFile(source), before);
  await rm(join(mediaDirectory, "one.wav"));
  await assert.rejects(inspectImport(source, mediaDirectory), { code: "ENOENT" });
  state.uploads[0].storedName = "..\\outside.wav";
  await writeFile(source, JSON.stringify(state));
  await assert.rejects(inspectImport(source, mediaDirectory), /unsafe media/);
  state.uploads = [];
  state.crates.push({ id: "crate", userId: state.users[0].id, name: "broken", dubIds: ["missing"] });
  assert.throws(() => validateCommunityState(state), /dangling/);
  state.crates = [];
  state.unknownRecords = [];
  assert.throws(() => validateCommunityState(state), /exact supported/);
});

test("synthetic community seed refuses production and remote databases before connecting", () => {
  for (const [mode, host] of [["production", "localhost"], ["test", "remote.invalid"]]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/community-postgres.mjs", import.meta.url)), "seed-synthetic"], {
      encoding: "utf8", timeout: 5000,
      env: {
        ...process.env, NODE_ENV: mode, COMMUNITY_STORAGE: "postgres",
        COMMUNITY_DATABASE_NAME: "cre8_community_test_seed",
        COMMUNITY_DATABASE_URL: `postgres://${host}/cre8_community_test_seed?sslmode=verify-full`,
        COMMUNITY_SYNTHETIC_ACK: "disposable-local-only",
      },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Synthetic accounts are local-only/);
    assert.doesNotMatch(result.stderr, /ENOTFOUND|ECONNREFUSED/);
  }
});
