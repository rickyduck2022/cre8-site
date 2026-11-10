import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const defaults = JSON.parse(readFileSync(resolve(directory, "defaults.json"), "utf8"));
const profiles = JSON.parse(readFileSync(resolve(directory, "profiles.json"), "utf8"));
const fragments = JSON.parse(readFileSync(resolve(directory, "fragments.json"), "utf8"));
const actionTypes = new Set(["click", "fill", "waitFor", "upload", "select", "navigate", "captureLink", "visit", "download", "press"]);
const destinations = new Set(["dubs", "library", "profile", "messenger", "buddies", "my-dubs"]);
const runtimeVariables = new Set(["demoPassword", "sharedUrl"]);

export function expandActions(actions, ancestry = []) {
  if (!Array.isArray(actions)) return actions;
  return actions.flatMap((action) => {
    if (action.type !== "include") return [action];
    if (!Object.hasOwn(fragments, action.fragment)) throw new Error(`Unknown guide fragment: ${action.fragment}`);
    if (ancestry.includes(action.fragment)) throw new Error(`Circular guide fragment: ${action.fragment}`);
    return expandActions(fragments[action.fragment], [...ancestry, action.fragment]);
  });
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
}

export function validateTemplate(template) {
  if (!template || typeof template !== "object") throw new Error("A guide template must be an object.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(template.id ?? "")) throw new Error("Guide id must use lowercase kebab-case.");
  requireText(template.title, "Guide title");
  requireText(template.description, "Guide description");
  if (!template.steps?.length || !Array.isArray(template.steps)) throw new Error("A guide needs steps.");
  const guide = { ...defaults, ...profiles.desktop, ...template };
  for (const key of ["holdMs", "actionDelayMs", "typingDelayMs", "timeoutMs", "captionBandHeight"]) {
    if (!Number.isInteger(guide[key]) || guide[key] <= 0) throw new Error(`${key} must be a positive integer.`);
  }
  for (const key of ["width", "height"]) {
    if (!Number.isInteger(guide.viewport?.[key]) || guide.viewport[key] < 320 || guide.viewport[key] % 2) {
      throw new Error(`Viewport ${key} must be an even integer of at least 320.`);
    }
  }
  if (guide.captionBandHeight % 2) throw new Error("Caption band height must be even.");
  for (const [key, value] of Object.entries(guide.captionStyle)) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`Caption style ${key} must be a positive integer.`);
  }
  for (const key of ["isMobile", "hasTouch"]) {
    if (typeof guide[key] !== "boolean") throw new Error(`${key} must be boolean.`);
  }
  const style = guide.captionStyle;
  const titleLines = wrapCaption(guide.title, style.wrapAt).split("\n").length;
  if (style.titleY + titleLines * (style.titleSize + 4) > style.captionY - 4) {
    throw new Error("Guide title does not fit above the captions.");
  }
  if (guide.viewport.width - style.margin * 2 < style.fontSize * style.wrapAt * 0.6) {
    throw new Error("Caption wrapping is too wide for the viewport.");
  }
  requireText(guide.outputDirectory, "Output directory");
  if (guide.variables && (typeof guide.variables !== "object" || Array.isArray(guide.variables))) throw new Error("Variables must be an object.");
  for (const [name, value] of Object.entries(guide.variables ?? {})) {
    requireText(value, `Variable ${name}`);
    if (name === "demoPassword") throw new Error("demoPassword is generated at runtime, never saved in a template.");
  }
  if (guide.assets && (typeof guide.assets !== "object" || Array.isArray(guide.assets))) throw new Error("Assets must be an object.");
  for (const [name, asset] of Object.entries(guide.assets ?? {})) {
    if (!asset || typeof asset !== "object" || (!asset.path && !asset.env)) throw new Error(`Asset ${name} needs a path or env.`);
    if (asset.path) requireText(asset.path, `Asset ${name} path`);
    if (asset.env && !/^[A-Z][A-Z0-9_]*$/.test(asset.env)) throw new Error(`Asset ${name} env must be an environment variable name.`);
  }
  function validateActions(actions) {
    if (!Array.isArray(actions) || !actions.length) throw new Error("Each step or setup needs actions.");
    for (const action of actions) {
      if (!actionTypes.has(action.type)) throw new Error(`Unknown action: ${action.type}`);
      if (action.type === "navigate") {
        if (!destinations.has(action.destination)) throw new Error(`Unknown navigation destination: ${action.destination}`);
      } else if (action.type !== "visit") {
        const target = action.target;
        if (!target || (!target.text && !target.label && !(target.role && target.name))) throw new Error("Action target needs text, label or role and name.");
        if (target.text) requireText(target.text, "Target text");
        else if (target.label) requireText(target.label, "Target label");
        else { requireText(target.role, "Target role"); requireText(target.name, "Target name"); }
        if (target.within) {
          requireText(target.within.role, "Scope role");
          requireText(target.within.name, "Scope name");
        }
      }
      if (action.type === "fill" && typeof action.value !== "string") throw new Error("Fill action value must be a string.");
      if (["select", "press", "visit"].includes(action.type)) requireText(action.value, "Action value");
      if (action.type === "captureLink" && action.variable !== "sharedUrl") throw new Error("captureLink must populate sharedUrl.");
      if (action.state !== undefined && (action.type !== "waitFor" || !["visible", "hidden"].includes(action.state))) {
        throw new Error("Only waitFor actions support state: visible or hidden.");
      }
      if (action.reveal !== undefined && (action.type !== "waitFor" || typeof action.reveal !== "boolean" || action.state === "hidden")) {
        throw new Error("Only visible waitFor actions support a boolean reveal.");
      }
      if (action.type === "upload" && !(action.asset in (guide.assets ?? {}))) throw new Error(`Unknown upload asset: ${action.asset}`);
      for (const [, variable] of JSON.stringify(action).matchAll(/\{\{(\w+)\}\}/g)) {
        if (!runtimeVariables.has(variable) && !(variable in (guide.variables ?? {}))) throw new Error(`Unknown variable: ${variable}`);
      }
    }
  }
  if (guide.setup !== undefined) validateActions(guide.setup);
  for (const [index, step] of guide.steps.entries()) {
    requireText(step.caption, `Step ${index + 1} caption`);
    if (step.caption.length > 110) throw new Error(`Step ${index + 1} caption is too long; split it into smaller steps.`);
    const lines = wrapCaption(step.caption, style.wrapAt).split("\n").length;
    if (style.captionY + lines * (style.fontSize + style.lineSpacing) > guide.captionBandHeight - 12) {
      throw new Error(`Step ${index + 1} caption does not fit the caption band.`);
    }
    if (step.holdMs !== undefined && (!Number.isInteger(step.holdMs) || step.holdMs <= 0)) throw new Error("Step holdMs must be a positive integer.");
    if (!Array.isArray(step.actions) || !step.actions.length) throw new Error(`Step ${index + 1} needs actions.`);
    validateActions(step.actions);
  }
  return guide;
}

export function resolveAssets(guide, root, environment = process.env) {
  return Object.fromEntries(Object.entries(guide.assets ?? {}).map(([name, asset]) => {
    const source = (asset.env && environment[asset.env]) || asset.path;
    if (!source) throw new Error(`Set ${asset.env} to the local file for asset ${name}.`);
    const path = resolve(root, source);
    if (!statSync(path).isFile()) throw new Error(`Asset ${name} is not a file.`);
    return [name, path];
  }));
}

export function resolveProfile(template, profile = "desktop") {
  if (!Object.hasOwn(profiles, profile)) throw new Error(`Unknown recording profile: ${profile}`);
  const overrides = template.profileOverrides ?? {};
  for (const name of Object.keys(overrides)) {
    if (!Object.hasOwn(profiles, name)) throw new Error(`Unknown profile override: ${name}`);
    const variant = overrides[name];
    if (!variant || typeof variant !== "object" || Array.isArray(variant)
      || Object.keys(variant).some((key) => key !== "setup" && key !== "steps")) {
      throw new Error("Profile overrides may only replace setup and/or steps.");
    }
  }
  const result = { ...defaults, ...template, ...profiles[profile], ...overrides[profile], profile };
  result.steps = result.steps?.map((step) => {
    for (const [name, variant] of Object.entries(step.profileOverrides ?? {})) {
      if (!Object.hasOwn(profiles, name)) throw new Error(`Unknown step profile: ${name}`);
      if (!variant || typeof variant !== "object" || Array.isArray(variant)
        || Object.keys(variant).some((key) => !["caption", "actions", "holdMs"].includes(key))) {
        throw new Error("Step profile overrides may only replace caption, actions and/or holdMs.");
      }
    }
    const resolved = { ...step, ...step.profileOverrides?.[profile] };
    return { ...resolved, actions: expandActions(resolved.actions) };
  });
  if (result.setup) result.setup = expandActions(result.setup);
  return validateTemplate(result);
}

export function loadTemplate(id, profile = "desktop") {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Select a kebab-case template id.");
  const template = JSON.parse(readFileSync(resolve(directory, "templates", `${id}.json`), "utf8"));
  if (template.id !== id) throw new Error("Template id must match its filename.");
  return resolveProfile(template, profile);
}

export function interpolate(text, variables) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in variables)) throw new Error(`Unknown variable: ${key}`);
    return variables[key];
  });
}

export function subtitleTime(seconds) {
  const milliseconds = Math.round(seconds * 1000);
  return `${String(Math.floor(milliseconds / 3600000)).padStart(2, "0")}:${String(Math.floor(milliseconds / 60000) % 60).padStart(2, "0")}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")},${String(milliseconds % 1000).padStart(3, "0")}`;
}

export function wrapCaption(text, maxLength = 76) {
  const lines = [""];
  for (const word of text.split(/\s+/)) {
    const last = lines.length - 1;
    if (lines[last] && lines[last].length + word.length + 1 > maxLength) lines.push(word);
    else lines[last] += `${lines[last] ? " " : ""}${word}`;
  }
  return lines.join("\n");
}
