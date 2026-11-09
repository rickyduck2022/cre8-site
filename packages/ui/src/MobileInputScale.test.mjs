import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("mobile input scaling", () => {
  it("keeps editable fields at least 16px without disabling viewport zoom", () => {
    const html = readFileSync(resolve("..", "..", "apps", "web", "index.html"), "utf8");
    expect(html).toContain('content="width=device-width, initial-scale=1.0"');
    expect(html).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=/i);
    const css = readFileSync(resolve("..", "..", "apps", "web", "src", "app", "App.css"), "utf8");
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    try {
      const media = Array.from(style.sheet.cssRules).find(
        (rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px), (pointer: coarse)",
      );
      const rule = Array.from(media.cssRules).find((candidate) =>
        candidate instanceof CSSStyleRule && candidate.selectorText.includes("textarea"),
      );
      expect(rule.selectorText).toContain("select");
      expect(rule.selectorText).toContain('input:not([type="button"])');
      expect(rule.style.getPropertyValue("font-size")).toBe("max(16px, 1em)");
      expect(rule.style.getPropertyPriority("font-size")).toBe("important");
    } finally {
      style.remove();
    }
  });
});
