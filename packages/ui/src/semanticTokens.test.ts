import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { semanticTokens } from "../../tokens/src/index";
import tokens from "../../tokens/src/tokens.json";

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

it("keeps collection colour definitions in design-system palettes, not filter components", () => {
  const css = readFileSync(resolve("src", "organisms", "DubSearch", "DubSearch.css"), "utf8");
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(|color-mix\(|var\(--color-(?:blue|cyan|orange|green|neutral)-/i);
  expect(css).not.toMatch(/--audience-accent\s*:/);
  expect(css).toContain("var(--audience-selected-surface)");
  expect(css).toContain("var(--media-selection-surface)");
  const button = readFileSync(resolve("src", "atoms", "Button", "Button.css"), "utf8");
  expect(button).not.toContain("color-mix(");
  expect(button).toContain("var(--media-accent-hover)");
  expect(button).toContain("var(--media-accent-pressed)");
});
