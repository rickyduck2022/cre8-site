import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandActions, interpolate, loadTemplate, resolveAssets, resolveProfile, subtitleTime, validateTemplate, wrapCaption } from "./template.mjs";
import { runGuideActions } from "./actions.mjs";

test("every available guide template validates", () => {
  for (const filename of readdirSync(new URL("./templates/", import.meta.url)).filter((name) => name.endsWith(".json"))) {
    loadTemplate(filename.slice(0, -5));
    loadTemplate(filename.slice(0, -5), "mobile");
  }
});

test("the categorized catalogue covers every journey exactly once", () => {
  const catalogue = JSON.parse(readFileSync(new URL("./catalogue.json", import.meta.url), "utf8"));
  const ids = catalogue.flatMap((category) => {
    assert.ok(category.title.trim());
    assert.ok(category.journeys.length);
    return category.journeys;
  });
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.sort(), readdirSync(new URL("./templates/", import.meta.url))
    .filter((name) => name.endsWith(".json"))
    .filter((name) => JSON.parse(readFileSync(new URL(`./templates/${name}`, import.meta.url), "utf8")).marketing !== true)
    .map((name) => name.slice(0, -5)).sort());
});

test("the instagram advert records a 9:16 branded video outside the guide catalogue", () => {
  const advert = loadTemplate("cre8-advert", "instagram");
  assert.equal(advert.marketing, true);
  assert.equal(advert.profile, "instagram");
  assert.equal(advert.isMobile, true);
  assert.equal(advert.hasTouch, true);
  const width = advert.viewport.width;
  const height = advert.viewport.height + advert.captionBandHeight;
  assert.equal(width * 16, height * 9);
});

test("recording profiles share journey content but isolate viewport, typography and device behavior", () => {
  const desktop = loadTemplate("add-dub");
  const mobile = loadTemplate("add-dub", "mobile");
  assert.deepEqual(desktop.steps, mobile.steps);
  assert.deepEqual(desktop.assets, mobile.assets);
  assert.deepEqual(mobile.viewport, { width: 390, height: 844 });
  assert.equal(mobile.hasTouch, true);
  assert.equal(mobile.isMobile, true);
  assert.equal(desktop.captionStyle.wrapAt, 76);
  assert.equal(mobile.captionStyle.wrapAt, 29);
  assert.equal(loadTemplate("add-dub").hasTouch, false);
  assert.throws(() => loadTemplate("add-dub", "unknown"), /Unknown recording profile/);
});

test("device-specific changes replace only the setup or steps that differ", () => {
  const template = loadTemplate("signup-get-started");
  template.steps[1].profileOverrides = {
    mobile: { caption: "Tap the signup button.", actions: [{ type: "click", target: { role: "button", name: "Mobile signup" } }] },
  };
  template.profileOverrides = { mobile: { setup: [{ type: "waitFor", target: { label: "Mobile start" } }] } };
  const mobile = resolveProfile(template, "mobile");
  assert.equal(mobile.steps[1].caption, "Tap the signup button.");
  assert.equal(mobile.steps[1].actions[0].target.name, "Mobile signup");
  assert.deepEqual(mobile.steps[0], template.steps[0]);
  assert.equal(mobile.setup[0].target.label, "Mobile start");
  assert.equal(resolveProfile(template).steps[1].caption, template.steps[1].caption);
  template.steps[1].profileOverrides.mobile.actions = [{ type: "invalid" }];
  assert.throws(() => resolveProfile(template, "mobile"), /Unknown action/);
});

test("touch recording taps without desktop hover", async () => {
  const calls = [];
  await runGuideActions({ getByRole: () => ({
    scrollIntoViewIfNeeded: async () => calls.push("scroll"),
    tap: async () => calls.push("tap"),
  }) }, [{ type: "click", target: { role: "button", name: "Next" } }],
  { hasTouch: true }, {}, {}, { paced: false });
  assert.deepEqual(calls, ["scroll", "tap"]);
});

test("the signup template is valid and supplies reusable recording defaults", () => {
  const guide = loadTemplate("signup-get-started");
  assert.equal(guide.viewport.width, 1440);
  assert.equal(guide.steps.length, 9);
  assert.equal(guide.holdMs, 4500);
  assert.equal(guide.variables.demoPassword, undefined);
});

test("template validation reports broken actions, variables and video dimensions before recording", () => {
  const guide = loadTemplate("signup-get-started");
  assert.throws(() => loadTemplate("..\\outside"), /kebab-case/);
  assert.throws(() => validateTemplate({ ...guide, viewport: { width: 1441, height: 900 } }), /even integer/);
  assert.throws(() => validateTemplate({ ...guide, steps: [] }), /needs steps/);
  assert.throws(() => validateTemplate({ ...guide, variables: { demoPassword: "not-allowed" } }), /generated at runtime/);
  assert.throws(() => validateTemplate({
    ...guide, steps: [{ caption: "Test", actions: [{ type: "fill", target: { label: "Artist" }, value: "{{missing}}" }] }],
  }), /Unknown variable/);
  assert.throws(() => validateTemplate({
    ...guide, steps: [{ caption: "Test", actions: [{ type: "runAnything", target: { label: "Artist" } }] }],
  }), /Unknown action/);
});

test("caption rendering wraps readable lines, formats time and substitutes explicit variables", () => {
  assert.equal(interpolate("Hello {{name}}", { name: "Demo" }), "Hello Demo");
  assert.throws(() => interpolate("{{missing}}", {}), /Unknown variable/);
  assert.equal(subtitleTime(65.125), "00:01:05,125");
  assert.equal(subtitleTime(3599.9999), "01:00:00,000");
  assert.equal(wrapCaption("One two three four", 8), "One two\nthree\nfour");
});

test("fill supports clearing a field while other actions still require nonempty values", () => {
  const guide = loadTemplate("signup-get-started");
  const actions = (type, value) => ({ ...guide, steps: [{ caption: "Reset search", actions: [{ type, target: { label: "Search" }, value }] }] });
  assert.doesNotThrow(() => validateTemplate(actions("fill", "")));
  assert.throws(() => validateTemplate(actions("fill", undefined)), /must be a string/);
  assert.throws(() => validateTemplate(actions("select", "")), /non-empty/);
});

test("updated UX journeys demonstrate direct reset, profile links and unique library entries on both devices", () => {
  for (const profile of ["desktop", "mobile"]) {
    const reset = loadTemplate("find-dub", profile).steps.flatMap((step) => step.actions);
    assert.ok(reset.some((action) => action.target?.name === "Clear filters"));
    assert.ok(reset.some((action) => action.type === "fill" && action.value === ""));
    const edit = loadTemplate("edit-artist-profile", profile).steps.flatMap((step) => step.actions);
    assert.ok(edit.some((action) => action.type === "fill" && action.target?.label === "Other website / custom link"));
    const library = loadTemplate("download-to-library", profile).steps.flatMap((step) => step.actions);
    assert.ok(library.some((action) => action.target?.text === "1 dub"));
  }
});

test("sharing guides distinguish friend and external tabs and use direct access management", () => {
  for (const profile of ["desktop", "mobile"]) {
    const external = loadTemplate("external-share-link", profile).steps.flatMap((step) => step.actions);
    assert.ok(external.some((action) => action.type === "click" && action.target?.role === "tab" && action.target.name === "External link"));
    const friends = loadTemplate("share-existing-dub", profile).steps.flatMap((step) => step.actions);
    assert.ok(friends.some((action) => action.target?.role === "tabpanel" && action.target.name === "Friends"));
    const access = loadTemplate("revoke-private-access", profile).steps.flatMap((step) => step.actions);
    assert.ok(access.some((action) => action.type === "click" && action.target?.name === "Manage access for {{trackTitle}}, 1 recipient"));
    assert.ok(access.some((action) => action.target?.text === "No friends currently have access."));
  }
});

test("upload assets resolve from local environment overrides without storing personal paths", () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-guide-assets-"));
  try {
    const audio = join(directory, "source.wav");
    const image = join(directory, "logo.png");
    writeFileSync(audio, "test audio");
    writeFileSync(image, "test image");
    const guide = loadTemplate("add-dub");
    assert.throws(() => resolveAssets(guide, directory, {}), /Set GUIDE_AUDIO_PATH/);
    assert.deepEqual(resolveAssets(guide, directory, { GUIDE_AUDIO_PATH: audio, GUIDE_ARTWORK_PATH: image }), { audio, artwork: image });
    assert.throws(() => resolveAssets({ assets: { invalid: { path: "." } } }, directory, {}), /not a file/);
    assert.throws(() => validateTemplate({ ...guide, assets: {} }), /Unknown upload asset/);
    assert.throws(() => validateTemplate({ ...guide, setup: [{ type: "unknown", target: { label: "Artist" } }] }), /Unknown action/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("upload and select actions use real file inputs and support unrecorded setup", async () => {
  const calls = [];
  const locator = {
    scrollIntoViewIfNeeded: async () => calls.push("scroll"),
    hover: async () => calls.push("hover"),
    setInputFiles: async (path) => calls.push(["upload", path]),
    selectOption: async (value) => calls.push(["select", value]),
  };
  const page = { getByLabel: () => locator };
  await runGuideActions(page, [
    { type: "upload", target: { label: "Audio" }, asset: "audio" },
    { type: "select", target: { label: "Distribution" }, value: "{{distribution}}" },
  ], {}, { distribution: "worldwide" }, { audio: "example.wav" }, { paced: false });
  assert.deepEqual(calls, ["scroll", ["upload", "example.wav"], "scroll", "hover", ["select", "worldwide"]]);
});

test("private sharing waits for publishing to finish before navigating away", async () => {
  const guide = loadTemplate("private-dub-share");
  const wait = guide.steps.flatMap((step) => step.actions).find((action) => action.state === "hidden");
  assert.equal(wait.target.name, "Share a dub");
  const calls = [];
  await runGuideActions({ getByRole: () => ({ waitFor: async (options) => calls.push(options) }) },
    [wait], guide, {}, {}, { paced: false });
  assert.deepEqual(calls, [{ state: "hidden" }]);
  assert.throws(() => validateTemplate({
    ...guide, steps: [{ caption: "Test", actions: [{ ...wait, state: "missing" }] }],
  }), /visible or hidden/);
});

test("shared setup fragments expand before validating variables and assets", () => {
  const guide = loadTemplate("find-dub");
  assert.ok(guide.setup.every((action) => action.type !== "include"));
  assert.equal(guide.setup[0].target.name, "Sign up as an artist");
  assert.ok(guide.setup.some((action) => action.type === "upload"));
  assert.throws(() => expandActions([{ type: "include", fragment: "unknown" }]), /Unknown guide fragment/);
  assert.throws(() => validateTemplate({ ...guide, variables: {} }), /Unknown variable/);
  assert.throws(() => validateTemplate({ ...guide, assets: {} }), /Unknown upload asset/);
  assert.throws(() => validateTemplate({
    ...guide, setup: [{ type: "navigate", destination: "unknown" }],
  }), /Unknown navigation destination/);
});

test("responsive navigation opens More only for secondary mobile sections", async () => {
  const calls = [];
  const target = { tap: async () => calls.push("tap") };
  const page = {
    getByRole: (role, options) => {
      calls.push([role, options.name]);
      return {
        locator: (selector) => { calls.push(selector); return target; },
        getByRole: (role, options) => { calls.push([role, options.name]); return target; },
      };
    },
  };
  await runGuideActions(page, [
    { type: "navigate", destination: "samples" },
    { type: "navigate", destination: "library" },
    { type: "navigate", destination: "my-dubs" },
  ], { hasTouch: true }, {}, {}, { paced: false });
  assert.deepEqual(calls, [
    ["navigation", "Main sections"], 'a[href="#samples"]', "tap",
    ["navigation", "Main sections"], ["button", "More"], "tap",
    ["dialog", "Navigation"], 'a[href="#library"]', "tap",
    ["navigation", "Main sections"], ["button", "More"], "tap",
    ["dialog", "Navigation"], 'a[href="#my-dubs"]', "tap",
  ]);
});

test("fixture and entry routes are restricted to supported local journeys", () => {
  const guide = loadTemplate("admin-review");
  assert.equal(guide.fixture, "admin");
  assert.equal(guide.entryPath, "/admin/");
  assert.throws(() => validateTemplate({ ...guide, fixture: "production" }), /Unknown guide fixture/);
  assert.throws(() => validateTemplate({ ...guide, assets: {} }), /require an audio asset/);
  assert.throws(() => validateTemplate({ ...guide, entryPath: "https://example.com" }), /local app/);
});

test("captured share links and subsequent visits never leave the isolated app", async () => {
  const variables = {};
  const visits = [];
  const page = {
    url: () => "http://127.0.0.1:1234/",
    getByRole: () => ({
      scrollIntoViewIfNeeded: async () => {},
      inputValue: async () => "http://127.0.0.1:1234/#share?dub=demo",
    }),
    goto: async (url) => visits.push(url),
  };
  await runGuideActions(page, [
    { type: "captureLink", target: { role: "textbox", name: "Link" }, variable: "sharedUrl" },
    { type: "visit", value: "{{sharedUrl}}" },
  ], { hasTouch: true }, variables, {}, { paced: false });
  assert.equal(variables.sharedUrl, "http://127.0.0.1:1234/#share?dub=demo");
  assert.deepEqual(visits, [variables.sharedUrl]);
  await assert.rejects(() => runGuideActions(page, [
    { type: "visit", value: "https://example.com/" },
  ], {}, {}, {}, { paced: false }), /isolated app origin/);
  page.getByRole = () => ({
    scrollIntoViewIfNeeded: async () => {},
    inputValue: async () => "http://127.0.0.1:1234/#pack?id=demo",
  });
  await runGuideActions(page, [
    { type: "captureLink", target: { role: "textbox", name: "Link" }, variable: "sharedUrl" },
  ], { hasTouch: true }, variables, {}, { paced: false });
  assert.equal(variables.sharedUrl, "http://127.0.0.1:1234/#pack?id=demo");
  page.getByRole = () => ({
    scrollIntoViewIfNeeded: async () => {},
    inputValue: async () => "https://example.com/#pack?id=demo",
  });
  await assert.rejects(() => runGuideActions(page, [
    { type: "captureLink", target: { role: "textbox", name: "Link" }, variable: "sharedUrl" },
  ], { hasTouch: true }, variables, {}, { paced: false }), /isolated app origin/);
});

test("downloads must produce a nonempty local file before the guide can succeed", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-guide-download-"));
  try {
    const path = join(directory, "dub.wav");
    const page = {
      getByRole: () => ({ scrollIntoViewIfNeeded: async () => {}, tap: async () => {} }),
      waitForEvent: async () => ({ failure: async () => null, path: async () => path }),
    };
    const actions = [{ type: "download", target: { role: "button", name: "Download" } }];
    writeFileSync(path, "");
    await assert.rejects(() => runGuideActions(page, actions, { hasTouch: true }, {}, {}, { paced: false }), /empty/);
    writeFileSync(path, "audio");
    await runGuideActions(page, actions, { hasTouch: true }, {}, {}, { paced: false });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("status content is located by exact text rather than an invented accessible name", async () => {
  const calls = [];
  await runGuideActions({ getByText: (text, options) => {
    calls.push([text, options]);
    return { waitFor: async (options) => calls.push(options) };
  } }, [{ type: "waitFor", target: { text: "Preview length saved." } }], {}, {}, {}, { paced: false });
  assert.deepEqual(calls, [["Preview length saved.", { exact: true }], { state: "visible" }]);
});

test("revealing a wait target scrolls it into view but hidden waits cannot reveal", async () => {
  const calls = [];
  await runGuideActions({ getByRole: () => ({
    waitFor: async () => calls.push("visible"),
    scrollIntoViewIfNeeded: async () => calls.push("scroll"),
  }) }, [{ type: "waitFor", target: { role: "button", name: "Revoke" }, reveal: true }],
  {}, {}, {}, { paced: false });
  assert.deepEqual(calls, ["visible", "scroll"]);
  const guide = loadTemplate("find-dub");
  assert.throws(() => validateTemplate({
    ...guide, steps: [{ caption: "Test", actions: [{
      type: "waitFor", target: { role: "button", name: "Revoke" }, state: "hidden", reveal: true,
    }] }],
  }), /visible waitFor/);
});
