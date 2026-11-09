import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { purgeData } from "../scripts/purge.mjs";
import { createApiServer, initializeData } from "../src/server.mjs";

test("purging restores seeded accounts and removes other records without deleting media", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-purge-"));
  const dataPath = join(directory, "community.json");
  const mediaPath = join(directory, "uploaded-audio.wav");
  try {
    const data = initializeData(dataPath, join(directory, "audio"));
    data.users.push({ id: "extra-user", username: "extra" });
    data.users[0].displayName = "Changed";
    data.dubs.push({ id: "extra-dub" });
    data.conversations.push({ id: "extra-conversation" });
    data.crates.push({ id: "extra-crate" });
    writeFileSync(dataPath, JSON.stringify(data));
    writeFileSync(mediaPath, "media");

    purgeData(dataPath);
    const reset = JSON.parse(readFileSync(dataPath, "utf8"));
    assert.deepEqual(reset.users.map(({ username }) => username), ["meladee", "holik"]);
    assert.equal(reset.users[0].displayName, "Meladee");
    assert.deepEqual(reset.artists.map(({ userId }) => userId), ["user-meladee", "user-holik"]);
    for (const [key, value] of Object.entries(reset)) {
      if (Array.isArray(value) && key !== "users" && key !== "artists") assert.deepEqual(value, [], key);
    }
    assert.equal(readFileSync(mediaPath, "utf8"), "media");

    const server = createApiServer({ dataPath, mediaDirectory: join(directory, "audio") });
    await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
    try {
      for (const [username, password, expectedStatus] of [
        ["meladee", "meladee", 200],
        ["holik", "holik", 200],
        ["extra", "long-enough-password", 401],
      ]) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        assert.equal(response.status, expectedStatus, username);
      }
    } finally {
      await new Promise((resolveClose, rejectClose) =>
        server.close((error) => error ? rejectClose(error) : resolveClose()));
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("purge refuses missing databases", () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-purge-missing-"));
  try {
    const dataPath = join(directory, "missing.json");
    assert.throws(() => purgeData(dataPath), /Database does not exist/);
    assert.equal(existsSync(dataPath), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("purge command refuses production and custom database paths", () => {
  const script = fileURLToPath(new URL("../scripts/purge.mjs", import.meta.url));
  for (const overrides of [
    { NODE_ENV: "production", COMMUNITY_DATA_PATH: "" },
    { NODE_ENV: "development", COMMUNITY_DATA_PATH: "other.json" },
  ]) {
    const result = spawnSync(process.execPath, [script, "--yes"], {
      env: { ...process.env, ...overrides },
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /only available for the default local database/);
  }
});

test("purge command requires explicit confirmation without a terminal", () => {
  const script = fileURLToPath(new URL("../scripts/purge.mjs", import.meta.url));
  const env = { ...process.env, NODE_ENV: "development" };
  delete env.COMMUNITY_DATA_PATH;
  const result = spawnSync(process.execPath, [script], { env, input: "", encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Confirmation requires a terminal/);
});
