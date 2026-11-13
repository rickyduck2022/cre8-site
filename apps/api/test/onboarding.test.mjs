import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApiServer } from "../src/server.mjs";

test("tutorial progress is authenticated, account-owned, platform-specific and persistent", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-onboarding-"));
  const start = async () => {
    const server = createApiServer({
      dataPath: join(directory, "community.json"), mediaDirectory: join(directory, "audio"),
      publicAudioDirectory: join(directory, "seed-audio"),
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return { server, url: `http://127.0.0.1:${server.address().port}` };
  };
  let running = await start();
  const stop = () => new Promise((resolve, reject) => running.server.close((error) => error ? reject(error) : resolve()));
  const login = async (username) => {
    const response = await fetch(`${running.url}/api/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: username }),
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  const read = async (cookie) => {
    const response = await fetch(`${running.url}/api/onboarding`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    return response.json();
  };
  const patch = (cookie, body) => fetch(`${running.url}/api/onboarding`, {
    method: "PATCH", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  try {
    for (const method of ["GET", "PATCH"]) {
      assert.equal((await fetch(`${running.url}/api/onboarding`, { method })).status, 401);
    }
    let cookie = await login("meladee");
    const other = await login("holik");
    const empty = { dismissed: false, completed: [] };
    assert.deepEqual(await read(cookie), { version: 1, desktop: empty, mobile: empty });
    const body = { ownerId: "user-meladee", platform: "desktop", action: "complete", lessonId: "media" };
    assert.equal((await patch(other, body)).status, 409);
    assert.equal((await patch(cookie, null)).status, 409);
    for (const bad of [{ platform: "tablet" }, { action: "erase" }, { lessonId: "unknown" }, { lessonId: null }]) {
      assert.equal((await patch(cookie, { ...body, ...bad })).status, 400);
    }
    assert.equal((await patch(cookie, body)).status, 200);
    assert.equal((await patch(cookie, body)).status, 200);
    assert.equal((await patch(cookie, { ...body, platform: "mobile", action: "dismiss" })).status, 200);
    assert.equal((await patch(cookie, { ...body, lessonId: "browse" })).status, 200);
    for (const lessonId of ["workspace", "upload", "sharing", "community"]) {
      assert.equal((await patch(cookie, { ...body, lessonId })).status, 200);
    }
    const saved = await read(cookie);
    assert.deepEqual(saved.desktop, { dismissed: true, completed: ["media", "browse", "workspace", "upload", "sharing", "community"] });
    assert.deepEqual(saved.mobile, { dismissed: true, completed: [] });
    assert.deepEqual(await read(other), { version: 1, desktop: empty, mobile: empty });
    await stop();
    running = await start();
    cookie = await login("meladee");
    assert.deepEqual(await read(cookie), saved);
  } finally {
    await stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
