import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("mobile zoom lock", () => {
  it("locks the viewport against zooming and keeps touch selects at least 16px", () => {
    const html = readFileSync(resolve("..", "..", "apps", "web", "index.html"), "utf8");
    expect(html).toContain(
      'content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"',
    );
    const adminHtml = readFileSync(resolve("..", "..", "apps", "admin", "index.html"), "utf8");
    expect(adminHtml).toContain(
      'content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"',
    );
    const shell = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    expect(shell).toMatch(/html\s*\{[^}]*touch-action:\s*pan-x pan-y;/);
    const adminCss = readFileSync(resolve("..", "..", "apps", "admin", "src", "admin.css"), "utf8");
    expect(adminCss).toMatch(/html\s*\{\s*touch-action:\s*pan-x pan-y;\s*\}/);
    const css = readFileSync(resolve("..", "..", "apps", "web", "src", "app", "App.css"), "utf8");
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    try {
      const media = Array.from(style.sheet.cssRules).find(
        (rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px), (pointer: coarse)",
      );
      const rule = Array.from(media.cssRules).find((candidate) =>
        candidate instanceof CSSStyleRule && candidate.selectorText.includes("select"),
      );
      expect(rule.style.getPropertyValue("font-size")).toBe("max(16px, 1em)");
      expect(rule.style.getPropertyPriority("font-size")).toBe("important");
    } finally {
      style.remove();
    }
  });
});
