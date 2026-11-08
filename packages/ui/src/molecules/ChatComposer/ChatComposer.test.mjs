import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("responsive send icon", () => {
  it("shows the send icon on mobile and hides it on desktop", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(resolve("src", "molecules", "ChatComposer", "ChatComposer.css"), "utf8");
    document.head.append(style);
    try {
      const rules = Array.from(style.sheet.cssRules);
      expect(rules.find((rule) => rule.selectorText === ".chat-compose__send .button__icon").style.display).toBe("none");
      const mobile = rules.find((rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px)");
      expect(Array.from(mobile.cssRules).find((rule) => rule.selectorText === ".chat-compose__send .button__icon").style.display).toBe("inline-flex");
    } finally {
      style.remove();
    }
  });
});
