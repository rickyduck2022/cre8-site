import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("responsive scrollbars", () => {
  it("removes the mobile scrollbar gutter while preserving desktop styling", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(resolve("src", "foundations", "Scrollbar.css"), "utf8");
    document.head.append(style);
    try {
      const rules = Array.from(style.sheet.cssRules);
      expect(rules.find((rule) => rule.selectorText === "*").style.getPropertyValue("scrollbar-width")).toBe("thin");
      const mobile = rules.find((rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px)");
      const mobileRules = Array.from(mobile.cssRules);
      const all = mobileRules.find((rule) => rule.selectorText === "*").style;
      const webkit = mobileRules.find((rule) => rule.selectorText === "::-webkit-scrollbar").style;
      expect(all.getPropertyValue("scrollbar-width")).toBe("none");
      expect(mobileRules.find((rule) => rule.selectorText === ".scroll-viewport").style.getPropertyValue("scrollbar-gutter")).toBe("auto");
      expect(webkit.getPropertyValue("display")).toBe("none");
      expect(webkit.getPropertyValue("width")).toBe("0");
    } finally {
      style.remove();
    }
  });
});
