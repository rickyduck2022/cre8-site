import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("uses body typography for search text on desktop and touch devices", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "molecules", "Molecules.css"), "utf8");
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet.cssRules);
    const find = (list, selector) => {
      const rule = list.find((candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === selector);
      if (!rule) throw new Error(`Missing CSS rule: ${selector}`);
      return rule.style;
    };
    expect(find(rules, ".search-field").getPropertyValue("min-height")).toBe("2.25rem");
    expect(find(rules, ".search-field input").getPropertyValue("font-size")).toBe("var(--type-size-input)");
    expect(find(rules, ".search-field input").getPropertyValue("line-height")).toBe("var(--type-leading-body)");
    expect(find(rules, ".search-field input").getPropertyValue("font-weight")).toBe("var(--type-weight-regular)");
    expect(find(rules, ".search-field input::placeholder").getPropertyValue("color")).toBe("var(--text-secondary)");
    expect(find(rules, ".search-field__icon").getPropertyValue("width")).toBe("0.875rem");
    const touch = rules.find((rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px), (pointer: coarse)");
    expect(touch).toBeDefined();
    expect(find(Array.from(touch.cssRules), ".search-field").getPropertyValue("min-height")).toBe("2.75rem");
    expect(Array.from(touch.cssRules).find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".search-field input")).toBeUndefined();
    const appStyle = document.createElement("style");
    appStyle.textContent = readFileSync(resolve("..", "..", "apps", "web", "src", "app", "App.css"), "utf8");
    document.head.append(appStyle);
    try {
      const appTouch = Array.from(appStyle.sheet.cssRules).find((rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px), (pointer: coarse)");
      expect(Array.from(appTouch.cssRules).map((rule) => rule.selectorText)).toEqual(["select"]);
    } finally {
      appStyle.remove();
    }
  } finally {
    style.remove();
  }
});

it("shares body sizing with form and message inputs and keeps placeholders muted", () => {
  const tokens = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
  expect(tokens).toMatch(/--type-size-input:\s*var\(--type-size-body\)/);
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "molecules", "Molecules.css"), "utf8");
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet.cssRules);
    for (const selector of [
      ".dub-upload-form__field input, .dub-upload-form__field textarea, .dub-upload-form__field select",
      ".crate-form__field input",
      ".artist-registration-form__field input",
      ".edit-profile-form__field input, .edit-profile-form__field textarea",
      ".share-entry__input textarea",
    ]) {
      const rule = rules.find((candidate) => candidate instanceof CSSStyleRule && candidate.selectorText.replace(/\s+/g, " ") === selector);
      expect(rule?.style.getPropertyValue("font-size")).toBe("var(--type-size-input)");
    }
    const placeholder = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".share-entry__input textarea::placeholder");
    expect(placeholder.style.getPropertyValue("color")).toBe("var(--text-secondary)");
  } finally {
    style.remove();
  }
});
