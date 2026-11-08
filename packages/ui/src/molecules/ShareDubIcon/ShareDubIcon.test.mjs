import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function mobileRules(path) {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", ...path), "utf8");
  document.head.append(style);
  const media = Array.from(style.sheet.cssRules).find(
    (rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px)",
  );
  const rules = Array.from(media.cssRules);
  style.remove();
  return rules;
}

describe("mobile share action", () => {
  it("hides only the label and swaps the desktop icon at the mobile breakpoint", () => {
    const buttonRules = mobileRules(["atoms", "Button", "Button.css"]);
    const iconRules = mobileRules(["molecules", "ShareDubIcon", "ShareDubIcon.css"]);
    const styleFor = (rules, selector) => rules.find((rule) => rule.selectorText === selector).style;
    expect(styleFor(buttonRules, ".button--hide-label-mobile > .button__label").display).toBe("none");
    expect(styleFor(iconRules, ".share-dub-icon__desktop").display).toBe("none");
    expect(styleFor(iconRules, ".share-dub-icon__mobile").display).toBe("inline-flex");
  });
});
