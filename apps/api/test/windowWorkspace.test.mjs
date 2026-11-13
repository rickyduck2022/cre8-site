import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApiServer, initializeData } from "../src/server.mjs";
import { parseWindowWorkspace } from "../src/windowWorkspace.mjs";

const savedWindow = (id) => ({
  id, title: "Studio", frame: { placement: "left", position: { x: 120, y: 80 }, size: { width: 640, height: 480 } },
  restoreFrame: null, minimized: true, group: "shared-group", order: 2, dockOrder: 1,
});
const workspace = (windows = [savedWindow("player")]) => ({
  version: 1, windows, dockWidths: { ":left": 480 }, playerTrackId: null,
});

test("window workspace validates bounded, unique layouts and strips unknown properties", () => {
  const input = workspace();
  assert.deepEqual(parseWindowWorkspace(input).workspace, input);
  for (const invalid of [
    null, [], {}, { ...input, version: 2 }, workspace(Array.from({ length: 51 }, () => savedWindow("player"))),
    workspace([savedWindow("player"), savedWindow("player")]), workspace([{ ...savedWindow("player"), title: "" }]),
    workspace([{ ...savedWindow("player"), id: "unknown" }]),
    workspace([savedWindow("profile:invalid user")]), workspace([savedWindow("profile:")]),
    workspace([{ ...savedWindow("player"), frame: { ...savedWindow("player").frame, position: { x: -1, y: 0 } } }]),
    workspace([{ ...savedWindow("player"), frame: { ...savedWindow("player").frame, size: { width: Infinity, height: 1 } } }]),
    { ...input, dockWidths: { bad: 200 } }, { ...input, playerTrackId: 2 },
  ]) assert.ok(parseWindowWorkspace(invalid).error);
  assert.deepEqual(parseWindowWorkspace({ ...input, secret: "not stored" }).workspace, input);
});

test("validates root-only workspace mode preferences and preserves legacy layouts", () => {
  for (const mode of ["simple", "explorer"]) {
    const value = { ...workspace(), mode, explorerIntroduced: true };
    assert.deepEqual(parseWindowWorkspace(value).workspace, value);
  }
  for (const invalid of [{ mode: "other" }, { mode: null }, { explorerIntroduced: "true" }]) {
    assert.ok(parseWindowWorkspace({ ...workspace(), ...invalid }).error);
  }
  assert.ok(parseWindowWorkspace({ ...workspace(), mode: "simple" }, true).error);
  assert.ok(parseWindowWorkspace({ ...workspace(), explorerIntroduced: true }, true).error);
});

test("validates remembered dependency selection against each workspace's own membership", () => {
  const input = { ...workspace([savedWindow("player"), savedWindow("pack:one")]), openedDependencies: ["player"] };
  assert.deepEqual(parseWindowWorkspace(input).workspace, input);
  for (const openedDependencies of [["missing"], ["player", "player"], null, "player", [2]]) {
    assert.ok(parseWindowWorkspace({ ...input, openedDependencies }).error);
  }
  assert.ok(parseWindowWorkspace({ ...workspace([savedWindow("workspace:studio")]), openedDependencies: ["workspace:studio"] }).error);
  const nested = { ...workspace([savedWindow("track:two")]), openedDependencies: ["track:two"] };
  assert.deepEqual(parseWindowWorkspace(nested, true).workspace, nested);
});

test("validates the root-only viewed workspace and supports Draft and legacy preferences", () => {
  const input = { ...workspace(), workspaces: [{ id: "studio", title: "Studio", saved: true, dependencies: [], layout: workspace([]) }] };
  for (const viewedWorkspaceId of ["", "studio"]) {
    const value = { ...input, viewedWorkspaceId };
    assert.deepEqual(parseWindowWorkspace(value).workspace, value);
  }
  for (const viewedWorkspaceId of ["missing", null, 2, {}, []]) {
    assert.ok(parseWindowWorkspace({ ...input, viewedWorkspaceId }).error);
  }
  assert.ok(parseWindowWorkspace({ ...workspace(), viewedWorkspaceId: "" }, true).error);
});

test("validates the root-only active workspace for entry restoration", () => {
  const input = { ...workspace(), workspaces: [{ id: "studio", title: "Studio", saved: true, dependencies: [], layout: workspace([]) }] };
  for (const activeWorkspaceId of ["", "studio", null]) {
    const value = { ...input, activeWorkspaceId };
    assert.deepEqual(parseWindowWorkspace(value).workspace, value);
  }
  for (const activeWorkspaceId of ["missing", 2, {}, []]) assert.ok(parseWindowWorkspace({ ...input, activeWorkspaceId }).error);
  assert.ok(parseWindowWorkspace({ ...workspace(), activeWorkspaceId: "" }, true).error);
});

test("validates independent last-save checkpoints without treating historical membership as live ownership", () => {
  const savedLayout = { ...workspace([savedWindow("track:one")]), openedDependencies: ["track:one"] };
  const input = { ...workspace([savedWindow("track:one")]), workspaces: [{
    id: "studio", title: "Studio", saved: true, dependencies: [], layout: workspace([]), savedLayout,
  }] };
  assert.deepEqual(parseWindowWorkspace(input).workspace, input);
  for (const invalid of [null, {}, { ...savedLayout, mode: "simple" },
    { ...savedLayout, activeWorkspaceId: "" }, { ...savedLayout, workspaces: [] },
    workspace([savedWindow("workspace:studio")]), workspace([savedWindow("player")]),
    workspace([savedWindow("track:one"), savedWindow("track:one")]),
    { ...savedLayout, openedDependencies: ["missing"] }]) {
    assert.ok(parseWindowWorkspace({ ...input, workspaces: [{ ...input.workspaces[0], savedLayout: invalid }] }).error);
  }
});

test("account workspaces persist across sessions and servers, enforce owner and access isolation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-workspace-"));
  const dataPath = join(directory, "community.json");
  const mediaDirectory = join(directory, "audio");
  const data = initializeData(dataPath, mediaDirectory);
  data.friendships.push({ id: "friend", ownerId: "user-meladee", friendUserId: "user-holik", groups: [], presence: "offline" });
  data.dubs.push({ id: "track", title: "Track", uploaderId: "user-meladee", distribution: "worldwide", uploadedAt: "2026-01-01" });
  data.packs.push({ id: "pack", title: "Pack", ownerId: "user-meladee", status: "published", distribution: "private", dubIds: ["track"], grants: [] });
  writeFileSync(dataPath, JSON.stringify(data));
  let server;
  let baseUrl;
  const start = async () => {
    server = createApiServer({ dataPath, mediaDirectory, publicAudioDirectory: join(directory, "seed-audio") });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  };
  const login = async (username) => {
    const response = await fetch(`${baseUrl}/api/login`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: username }) });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  const get = async (cookie) => (await fetch(`${baseUrl}/api/workspace`, { headers: { cookie } })).json();
  const put = (cookie, body) => fetch(`${baseUrl}/api/workspace`, { method: "PUT", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
  const close = () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  try {
    await start();
    assert.equal((await fetch(`${baseUrl}/api/workspace`)).status, 401);
    const cookie = await login("meladee");
    const other = await login("holik");
    assert.equal(await get(cookie), null);
    assert.equal((await put(cookie, { ownerId: "user-holik", workspace: workspace() })).status, 409);
    assert.equal((await put(cookie, { ownerId: "user-meladee", workspace: null })).status, 400);
    const friend = data.friendships.find((entry) => entry.ownerId === "user-meladee");
    const value = { mode: "simple", explorerIntroduced: true, viewedWorkspaceId: "studio", activeWorkspaceId: "studio", openedDependencies: ["pack:pack", "track:track"], ...workspace([{ ...savedWindow("pack:pack"), groupTitle: "Production", tabOrder: 3 },
      { ...savedWindow("track:track"), groupTitle: "Production", tabOrder: 1 }, savedWindow("player"), savedWindow("profile:holik"),
      savedWindow("workspace:studio"), ...(friend ? [savedWindow(`conversation:${friend.id}`)] : [])]), playerTrackId: "track",
      workspaces: [{ id: "studio", title: "Production context", saved: true, dependencies: [], layout: { ...workspace([savedWindow("profile:meladee")]), openedDependencies: ["profile:meladee"] },
        savedLayout: { ...workspace([savedWindow("track:track")]), openedDependencies: ["track:track"] } }] };
    assert.equal((await put(cookie, { ownerId: "user-meladee", workspace: value })).status, 200);
    assert.equal(await get(other), null);
    assert.deepEqual(await get(await login("meladee")), value);
    const snapshot = await (await fetch(`${baseUrl}/api/community`, { headers: { cookie } })).json();
    assert.deepEqual(snapshot.windowWorkspace, value);
    const forbidden = { ...workspace([savedWindow("pack:pack"), savedWindow("track:missing"), savedWindow("conversation:missing"), savedWindow("profile:missing")]), playerTrackId: "missing",
      workspaces: [{ id: "studio", title: "Private workspace", saved: false, dependencies: [], layout: workspace([savedWindow("pack:pack"), savedWindow("profile:missing")]) }] };
    forbidden.windows = forbidden.windows.filter((entry) => !["pack:pack", "profile:missing"].includes(entry.id));
    forbidden.openedDependencies = ["track:missing"];
    forbidden.workspaces[0].layout.openedDependencies = ["pack:pack", "profile:missing"];
    forbidden.workspaces[0].savedLayout = { ...workspace([savedWindow("pack:pack"), savedWindow("track:missing")]),
      openedDependencies: ["pack:pack", "track:missing"] };
    assert.equal((await put(other, { ownerId: "user-holik", workspace: forbidden })).status, 200);
    assert.deepEqual((await get(other)).windows, []);
    assert.equal((await get(other)).playerTrackId, null);
    assert.deepEqual((await get(other)).workspaces[0].layout.windows, []);
    assert.deepEqual((await get(other)).openedDependencies, []);
    assert.deepEqual((await get(other)).workspaces[0].layout.openedDependencies, []);
    assert.deepEqual((await get(other)).workspaces[0].savedLayout.windows, []);
    assert.deepEqual((await get(other)).workspaces[0].savedLayout.openedDependencies, []);
    await close();
    await start();
    const restored = await get(await login("meladee"));
    assert.deepEqual(restored, value);
    const updated = JSON.parse(readFileSync(dataPath, "utf8"));
    updated.dubs = updated.dubs.filter((dub) => dub.id !== "track");
    updated.packs = updated.packs.filter((pack) => pack.id !== "pack");
    updated.users = updated.users.filter((user) => user.username !== "holik");
    await close();
    writeFileSync(dataPath, JSON.stringify(updated));
    await start();
    const pruned = await get(await login("meladee"));
    assert.ok(pruned.windows.every((entry) => entry.id !== "pack:pack" && entry.id !== "track:track" && entry.id !== "profile:holik"));
    assert.equal(pruned.playerTrackId, null);
    assert.deepEqual(pruned.openedDependencies, []);
    assert.deepEqual(pruned.workspaces[0].savedLayout.windows, []);
    assert.deepEqual(pruned.workspaces[0].savedLayout.openedDependencies, []);
  } finally {
    await close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("window workspace preserves optional group names and independent tab order with bounded validation", () => {
  const entry = { ...savedWindow("player"), groupTitle: "  Production  ", tabOrder: 4 };
  assert.deepEqual(parseWindowWorkspace(workspace([entry])).workspace.windows[0], { ...entry, groupTitle: "Production" });
  for (const fields of [
    { groupTitle: "" }, { groupTitle: "   " }, { groupTitle: "a".repeat(101) }, { groupTitle: 3 },
    { groupTitle: "Group", group: null }, { tabOrder: -1 }, { tabOrder: 1.5 }, { tabOrder: 100001 }, { tabOrder: "2" },
  ]) assert.ok(parseWindowWorkspace(workspace([{ ...entry, ...fields }])).error);
});

test("workspace contexts preserve independent layouts, names and dependency links and reject cycles or duplicate ownership", () => {
  const context = (id, windows = [], dependencies = []) => ({ id, title: id, saved: true, dependencies, layout: workspace(windows) });
  const input = { ...workspace([savedWindow("workspace:studio")]), workspaces: [
    context("studio", [savedWindow("pack:one"), savedWindow("workspace:reference")], ["reference"]),
    { ...context("reference", [savedWindow("profile:holik")]), saved: false, title: "Unsaved Workspace" },
  ] };
  assert.deepEqual(parseWindowWorkspace(input).workspace, input);
  for (const invalid of [
    { ...input, workspaces: [context("studio", [savedWindow("workspace:studio")])] },
    { ...input, workspaces: [context("studio", [], ["reference"]), context("reference", [], ["studio"])] },
    { ...input, workspaces: [context("studio", [], ["missing"])] },
    { ...input, workspaces: [context("studio", [savedWindow("pack:duplicate")]), context("reference", [savedWindow("pack:duplicate")])] },
    { ...input, windows: [savedWindow("workspace:unknown")] },
    { ...input, workspaces: [{ ...context("studio"), title: " " }] },
    { ...input, workspaces: [{ ...context("studio"), layout: { ...workspace(), workspaces: [] } }] },
    { ...input, workspaces: [context("studio"), context("studio")] },
  ]) assert.ok(parseWindowWorkspace(invalid).error, JSON.stringify(invalid));
});
