import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { layers, lightThemeTokens, semanticTokens } from "../../tokens/src/index";
import tokens from "../../tokens/src/tokens.json";

it("keeps tutorial sheets above app chrome and below the focus overlay with synchronized layer tokens", () => {
  expect(tokens.layers).toEqual(layers);
  expect(layers.modal).toBeGreaterThan(layers.popover);
  expect(layers.modal).toBeLessThan(layers.notification);
  const css = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
  for (const [name, value] of Object.entries(layers)) {
    expect(css).toContain(`--layer-${name}: ${value};`);
  }
});

it("keeps every semantic colour role identical in CSS, TypeScript and JSON", () => {
  expect(tokens.semantic).toEqual(semanticTokens);
  const css = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  try {
    const root = Array.from(style.sheet?.cssRules ?? []).find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ":root");
    if (!(root instanceof CSSStyleRule)) throw new Error("Missing semantic token root");
    for (const [group, roles] of Object.entries(semanticTokens)) {
      for (const [role, value] of Object.entries(roles)) {
        expect(root.style.getPropertyValue(`--${group}-${role}`).trim(), `--${group}-${role}`).toBe(value);
      }
    }
  } finally {
    style.remove();
  }
});
it("mutes the guide panel rainbow while keeping contextual outlines vivid", () => {
  for (const role of ["action-primary", "audio-dub-active", "audio-sample-active", "audio-vocal-active"]) {
    expect(semanticTokens.tutorial["outline-gradient"]).toContain(`var(--${role})`);
    expect(semanticTokens.tutorial["panel-outline-gradient"]).toContain(`color-mix(in srgb, var(--${role}) 40%, var(--surface-raised))`);
  }
  expect(semanticTokens.tutorial["outline-gradient"]).not.toContain("color-mix");
  const guide = readFileSync(resolve("src", "organisms", "TutorialGuide", "TutorialGuide.css"), "utf8");
  expect(guide).toMatch(/\.tutorial-focus-outline\s*\{[^}]*background: var\(--tutorial-outline-gradient\)/);
  expect(guide).toMatch(/\.tutorial-guide\s*\{[^}]*var\(--tutorial-panel-outline-gradient\) border-box/);
  expect(guide).toContain("mask-composite: exclude");
  expect(guide).not.toContain("--tutorial-context-accent");
  expect(guide).not.toContain(".tutorial-focus-outline--guide");
});

it("keeps collection colour definitions in design-system palettes, not filter components", () => {
  const css = readFileSync(resolve("src", "organisms", "DubSearch", "DubSearch.css"), "utf8");
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(|color-mix\(|var\(--color-(?:blue|cyan|orange|green|neutral)-/i);
  expect(css).not.toMatch(/--audience-accent\s*:/);
  expect(css).toContain("var(--audience-selected-surface)");
  expect(css).toContain("var(--media-selection-surface)");
  expect(css).toContain("border: 1px solid var(--media-accent, var(--action-primary))");
  expect(css).toContain("background: var(--surface-frosted)");
  expect(css).toContain("backdrop-filter: blur(var(--overlay-blur))");
  const button = readFileSync(resolve("src", "atoms", "Button", "Button.css"), "utf8");
  expect(button).not.toContain("color-mix(");
  expect(button).toContain("var(--media-accent-hover)");
  expect(button).toContain("var(--media-accent-pressed)");
});

it("keeps the light theme synchronized across CSS, TypeScript and JSON without replacing media identities", () => {
  expect(tokens.themes.light).toEqual(lightThemeTokens);
  const css = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  try {
    const rule = Array.from(style.sheet?.cssRules ?? []).find((entry) => entry instanceof CSSStyleRule
      && entry.selectorText === ':root[data-theme="light"]');
    if (!(rule instanceof CSSStyleRule)) throw new Error("Missing light theme tokens");
    for (const [group, roles] of Object.entries(lightThemeTokens)) {
      for (const [role, value] of Object.entries(roles)) {
        expect(rule.style.getPropertyValue(`--${group}-${role}`).trim()).toBe(value);
      }
    }
    expect(rule.style.getPropertyValue("color-scheme")).toBe("light");
    expect(rule.style.getPropertyValue("--audio-dub-active")).toBe("");
    expect(rule.style.getPropertyValue("--audio-sample-active")).toBe("");
    expect(rule.style.getPropertyValue("--release-alist-surface")).toBe("");
  } finally { style.remove(); }
});
