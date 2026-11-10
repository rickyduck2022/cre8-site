import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("uses the dub-card date font for player text and controls", () => {
  const css = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
  const cardCss = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
  const style = document.createElement("style");
  style.textContent = `${css}\n${cardCss}`;
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet.cssRules);
    const player = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".audio-player");
    const controls = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText.replace(/\s+/g, " ") === ".audio-player button, .audio-player input");
    const date = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-card__timestamp");
    expect(player.style.getPropertyValue("font-family")).toBe("var(--font-mono)");
    expect(player.style.getPropertyValue("text-transform")).toBe("uppercase");
    expect(player.style.getPropertyValue("font-family")).toBe(date.style.getPropertyValue("font-family"));
    expect(controls.style.getPropertyValue("font-family")).toBe("inherit");
    const play = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText.includes(".audio-player.dub-card__player--current .transport-controls .transport-controls__play") && rule.style.getPropertyValue("box-shadow"));
    expect(play.selectorText).toContain(".audio-player--playable .transport-controls .transport-controls__play");
    expect(play.style.getPropertyValue("box-shadow")).toBe("inset 0 0.125rem 0.375rem color-mix(in srgb, var(--audio-active) 55%, black)");
  } finally {
    style.remove();
  }
});
