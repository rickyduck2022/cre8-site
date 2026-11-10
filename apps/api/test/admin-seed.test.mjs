import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApiServer, initializeData } from "../src/server.mjs";

test("seeds an administrator on an existing database without resetting it on restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-admin-seed-"));
  const dataPath = join(directory, "community.json");
  const mediaDirectory = join(directory, "audio");
  const password = randomBytes(16).toString("hex");
  const otherPassword = randomBytes(16).toString("hex");
  const previousAdmins = process.env.ADMIN_USERNAMES;
  process.env.ADMIN_USERNAMES = "admin";
  let server;
  const start = async (seedPassword) => {
    server = createApiServer({ dataPath, mediaDirectory, adminSeed: { username: "admin", password: seedPassword } });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${server.address().port}`;
  };
  const close = async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server = undefined;
  };
  const login = (baseUrl, loginPassword) => fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: loginPassword }),
  });
  try {
    const data = initializeData(dataPath, mediaDirectory);
    data.dubs.push({ id: "preserved" });
    writeFileSync(dataPath, JSON.stringify(data));
    let baseUrl = await start(password);
    const seeded = JSON.parse(readFileSync(dataPath, "utf8"));
    const admin = seeded.users.find((user) => user.username === "admin");
    assert.ok(admin);
    assert.notEqual(admin.passwordHash, password);
    assert.equal(seeded.artists.filter((artist) => artist.userId === admin.id).length, 1);
    assert.ok(seeded.dubs.some((dub) => dub.id === "preserved"));
    const response = await login(baseUrl, password);
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie").split(";")[0];
    assert.equal((await fetch(`${baseUrl}/api/admin/overview`, { headers: { cookie } })).status, 200);
    await close();

    baseUrl = await start(otherPassword);
    const restarted = JSON.parse(readFileSync(dataPath, "utf8"));
    assert.equal(restarted.users.filter((user) => user.username === "admin").length, 1);
    assert.equal(restarted.users.find((user) => user.username === "admin").passwordHash, admin.passwordHash);
    assert.equal((await login(baseUrl, password)).status, 200);
    assert.equal((await login(baseUrl, otherPassword)).status, 401);
  } finally {
    if (server) await close();
    if (previousAdmins === undefined) delete process.env.ADMIN_USERNAMES;
    else process.env.ADMIN_USERNAMES = previousAdmins;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects incomplete seed configuration and refuses to claim an existing account", () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-admin-collision-"));
  const dataPath = join(directory, "community.json");
  const mediaDirectory = join(directory, "audio");
  const password = randomBytes(16).toString("hex");
  try {
    assert.throws(() => createApiServer({ dataPath, mediaDirectory, adminSeed: { username: "admin" } }), /ADMIN_SEED_PASSWORD/);
    assert.throws(() => createApiServer({ dataPath, mediaDirectory, adminSeed: { password } }), /ADMIN_SEED_USERNAME/);
    const data = initializeData(dataPath, mediaDirectory);
    data.users.push({ id: "existing", username: "Admin", passwordHash: "unchanged" });
    writeFileSync(dataPath, JSON.stringify(data));
    assert.throws(() => createApiServer({ dataPath, mediaDirectory, adminSeed: { username: "admin", password } }), /already belongs to an existing account/);
    const existing = JSON.parse(readFileSync(dataPath, "utf8")).users.find((user) => user.id === "existing");
    assert.equal(existing.passwordHash, "unchanged");
    assert.equal(existing.seededAdministrator, undefined);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
