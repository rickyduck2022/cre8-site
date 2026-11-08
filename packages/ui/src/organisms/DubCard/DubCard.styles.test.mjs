import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("removes the embedded player border and horizontal padding without affecting other players", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
  document.head.append(style);
  try {
    const rule = Array.from(style.sheet.cssRules).find(
      (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === ".dub-card .organism-card.audio-player",
    );
    expect(rule).toBeDefined();
    expect(rule.style.getPropertyValue("border")).toBe("0");
    expect(rule.style.getPropertyValue("box-shadow")).toBe("none");
    expect(rule.style.getPropertyValue("padding-left")).toBe("0");
    expect(rule.style.getPropertyValue("padding-right")).toBe("0");
    expect(rule.style.getPropertyValue("padding-top")).toBe("");
    expect(rule.style.getPropertyValue("padding-bottom")).toBe("");
  } finally {
    style.remove();
  }
});
