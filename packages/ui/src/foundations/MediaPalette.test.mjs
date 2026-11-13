import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const theme = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
const palette = readFileSync(resolve("src", "foundations", "MediaPalette.css"), "utf8");
const tokens = JSON.parse(readFileSync(resolve("..", "tokens", "src", "tokens.json"), "utf8"));
it("keeps nested navigation subdued with semantic media selection and quiet counts", () => {
  const nested = palette.slice(palette.indexOf('.navigation .navigation__items--nested'));
  expect(nested).toContain("background: var(--media-selection-surface)");
  expect(nested).toContain("border-color: var(--media-selection-border)");
  expect(nested).toContain("color: var(--media-accent)");
  expect(nested).toContain("background: var(--surface-control)");
  expect(nested).not.toMatch(/#[0-9a-f]{3,8}\b|var\(--color-/i);
});
it("maps addition feedback to incoming media variants with a theme-level mixed-group override", () => {
  for (const kind of ["dub", "sample", "vocal"]) {
    expect(palette).toContain(`.window-addition.window-addition--${kind} { --window-addition-variant-accent: var(--audio-${kind}-active); }`);
  }
  expect(palette).toContain("--window-addition-accent: var(--window-addition-mixed-accent, var(--window-addition-variant-accent, var(--action-primary)))");
  expect(tokens.semantic.window["addition-mixed-accent"]).toBe("initial");
  const windows = readFileSync(resolve("src", "organisms", "Window", "Window.css"), "utf8");
  expect(windows).toContain("box-shadow: var(--window-shadow), var(--window-addition-shadow)");
  expect(windows).toContain(".window-layer__minimized-group, .floating-window { transition: none; }");
});
it("keeps Workspace Manager domains neutral and independent of child media variants", () => {
  const workspace = readFileSync(resolve("src", "foundations", "WorkspacePalette.css"), "utf8");
  expect(tokens.semantic.window["manager-current-accent"]).toBe("var(--text-primary)");
  expect(tokens.semantic.window["manager-explorer-accent"]).toBe("color-mix(in srgb, var(--text-primary) 55%, var(--text-secondary))");
  expect(workspace).toContain("--workspace-manager-accent: var(--window-manager-current-accent)");
  expect(workspace).toContain("--workspace-manager-accent: var(--window-manager-explorer-accent)");
  expect(workspace).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  const chrome = workspace.match(/\.workspace-palette--charcoal\s*\{([^}]+)\}/)?.[1];
  expect(chrome).not.toMatch(/--audio-(dub|sample)|--media-/);
  expect(workspace).toContain("--surface-raised: var(--window-manager-surface)");
  expect(workspace).toContain("--text-primary: var(--window-manager-text)");
  expect(workspace).toContain("--window-dock-surface: var(--window-manager-surface)");
  expect(workspace).toContain("--workspace-content-surface: var(--window-manager-surface)");
  expect(workspace).toContain("--workspace-item-surface: var(--window-manager-canvas)");
});
it("uses theme-aware neutral tab borders, not white backgrounds, and shared timed-highlight tokens", () => {
  const rule = palette.match(/\.collection-tabs > \.filter-tab\.window-kind--dialog\s*\{([^}]+)\}/)?.[1];
  expect(rule).toContain("--window-tab-border: var(--window-dialog-tab-border)");
  expect(rule).not.toMatch(/--window-tab-(surface|hover|selected|text):/);
  const typescript = readFileSync(resolve("..", "tokens", "src", "index.ts"), "utf8");
  for (const [name, value] of Object.entries(tokens.semantic.window)) {
    expect(theme).toContain(`--window-${name}: ${value};`);
    expect(typescript).toMatch(new RegExp(`(?:"${name}"|\\b${name}): "${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  expect(tokens.semantic.window["dialog-tab-border"]).toBe("var(--text-primary)");
  expect(tokens.semantic.window["highlight-border"]).toBe("var(--action-primary)");
});
it.each(["sample", "dub", "vocal"])("enforces the %s design token for shared collection tab indicators and focus rings", (kind) => {
  const rule = palette.match(new RegExp(`\\.collection-tabs\\.media-kind--${kind} > \\.filter-tab\\s*\\{([^}]+)\\}`))?.[1];
  expect(rule).toContain(`--window-tab-indicator: var(--audio-${kind}-active)`);
  expect(rule).toContain(`--focus-ring: var(--audio-${kind}-active)`);
  const tabs = readFileSync(resolve("src", "molecules", "CollectionTabs", "CollectionTabs.css"), "utf8");
  expect(tabs).toContain("box-shadow: inset 0 3px var(--window-tab-indicator)");
  expect(tabs).not.toMatch(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(|color-mix\(|var\(--color-/i);
});
const color = (name) => {
  const hex = theme.match(new RegExp(`--color-${name}:\\s*#([0-9a-f]{6})`, "i"))?.[1];
  if (!hex) throw new Error(`Missing color ${name}`);
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
};
const luminance = (rgb) => rgb.map((value) => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

it("keeps the charcoal workspace distinct from the app with readable primary and secondary text", () => {
  const surface = color("neutral-700");
  const text = color("neutral-50");
  const muted = text.map((channel, index) => channel * 0.8 + color("neutral-400")[index] * 0.2);
  const control = surface.map((channel, index) => channel * 0.9 + text[index] * 0.1);
  expect(tokens.semantic.window["manager-surface"]).toBe("var(--color-neutral-700)");
  expect(tokens.semantic.window["manager-canvas"]).toBe("var(--color-neutral-800)");
  expect(luminance(surface)).toBeGreaterThan(luminance(color("neutral-950")));
  for (const background of [surface, color("neutral-800"), control]) {
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, background)).toBeGreaterThanOrEqual(4.5);
  }
});

it("uses synchronized app-charcoal workspace and mixed/default roles with readable text", () => {
  expect(tokens.semantic.window["manager-selection-surface"]).toBe("var(--color-neutral-950)");
  expect(tokens.semantic.window["manager-selection-hover"]).toBe("var(--color-neutral-900)");
  expect(tokens.semantic.window["manager-selection-text"]).toBe("var(--color-neutral-50)");
  for (const background of ["neutral-950", "neutral-900"]) {
    expect(contrast(color("neutral-50"), color(background))).toBeGreaterThanOrEqual(4.5);
  }
  const workspace = readFileSync(resolve("src", "foundations", "WorkspacePalette.css"), "utf8");
  const selected = workspace.match(/\.workspace-card--open\s*\{([^}]+)\}/)?.[1];
  expect(selected).toContain("--workspace-item-surface: var(--workspace-card-open)");
  expect(selected).toContain("--text-primary: var(--workspace-card-text)");
  expect(selected).not.toMatch(/--audio-|--media-/);
});

it.each([["vocal", "violet-400"], ["sample", "green-400"], ["dub", "cyan-400"], ["other", "neutral-950"]])("keeps %s dependency backgrounds readable in open and muted states", (kind, name) => {
  const accent = color(name);
  const open = kind === "other" ? accent : accent.map((channel, index) => channel * 0.3 + color("neutral-800")[index] * 0.7);
  const muted = kind === "other" ? color("neutral-900") : accent.map((channel, index) => channel * 0.22 + color("neutral-800")[index] * 0.78);
  expect(contrast(color("neutral-50"), open)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(color("neutral-50"), muted)).toBeGreaterThanOrEqual(4.5);
  const secondary = color("neutral-50").map((channel, index) => channel * 0.8 + color("neutral-400")[index] * 0.2);
  expect(contrast(secondary, muted)).toBeGreaterThanOrEqual(4.5);
  if (kind === "other") expect(tokens.semantic.window["manager-other-muted"]).toBe("var(--color-neutral-900)");
  else expect(tokens.semantic.window[`manager-${kind}-muted`]).toContain("22%, var(--window-manager-canvas)");
});

it.each([["vocal", "violet-400"], ["sample", "green-400"], ["dub", "cyan-400"], ["other", "neutral-700"]])("distinguishes focused/open %s restore controls with readable darker surfaces", (kind, name) => {
  const accent = color(name);
  const mix = (ratio) => accent.map((channel, index) => channel * ratio + color("neutral-950")[index] * (1 - ratio));
  for (const ratio of [0.18, 0.28, 0.35]) expect(contrast(color("neutral-50"), mix(ratio))).toBeGreaterThanOrEqual(4.5);
  expect(luminance(mix(0.18))).toBeLessThan(luminance(mix(0.35)));
  const border = kind === "other" ? color("neutral-50") : accent;
  expect(contrast(border, mix(0.18))).toBeGreaterThanOrEqual(3);
  const workspace = readFileSync(resolve("src", "foundations", "WorkspacePalette.css"), "utf8");
  expect(workspace).toContain(`--window-restore-focus-border: var(--${kind === "other" ? "window-manager-text" : `audio-${kind}-active`})`);
  expect(workspace).toContain(`.floating-window[data-window-kind${kind === "other" ? "" : `="${kind}"`}] { --window-focus: var(--${kind === "other" ? "window-manager-text" : `audio-${kind}-active`}); }`);
  const windows = readFileSync(resolve("src", "organisms", "Window", "Window.css"), "utf8");
  expect(windows).toContain('.window-layer__minimized-group .window-layer__restore[data-window-state="focused"]');
  expect(windows).toContain("border-color: var(--window-restore-focus-border)");
  expect(windows).toContain("box-shadow: inset 0 0 0 1px var(--window-restore-focus-border)");
  for (const role of ["open", "focused", "hover"]) {
    expect(workspace).toContain(`--window-restore-${role}-surface: ${tokens.semantic.window[`restore-${role}-surface`]}`);
  }
  if (kind !== "other") expect(workspace).toContain(`--window-restore-accent: var(--audio-${kind}-active)`);
});

it.each(["cyan-400", "green-400", "orange-500"])("%s has readable text and waveform contrast on light and dark media variants", (name) => {
  const accent = color(name);
  const dark = color("neutral-950");
  const secondary = color("neutral-900");
  expect(contrast(accent, dark)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(accent, secondary)).toBeGreaterThanOrEqual(4.5);
  const dimWaveform = dark.map((channel, index) => channel * 0.7 + accent[index] * 0.3);
  expect(contrast(accent, dimWaveform)).toBeGreaterThanOrEqual(3);
  const controller = dark.map((channel, index) => channel * 0.9 + accent[index] * 0.1);
  expect(contrast(accent, controller)).toBeGreaterThanOrEqual(3);
  expect(contrast(color("neutral-50"), controller)).toBeGreaterThanOrEqual(4.5);
});

it("keeps the sample palette in shared tokens instead of hard-coding it in composites", () => {
  expect(tokens.color.green["400"].toUpperCase()).toBe("#4DD89A");
  expect(tokens.semantic.audio["sample-active"]).toBe("var(--color-green-400)");
  expect(palette).toContain("--media-accent: var(--audio-sample-active)");
  expect(palette).toContain("--audio-active: var(--media-accent)");
  const css = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
  expect(css).toContain("--audio-active: var(--media-accent)");
  expect(css).toContain("background: var(--media-accent)");
});
