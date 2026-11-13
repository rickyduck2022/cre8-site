import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("keeps window players inside narrow containers without fixed column minimums", () => {
  const css = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
  expect(css).toMatch(/\.organism-card\.audio-player--window\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  expect(css).toMatch(/\.organism-card\.audio-player--window\s*\{[^}]*min-width: 0/);
  expect(css).toContain(".audio-player--window > * { min-width: 0; }");
});
it("keeps the volume group, slider and mute control borderless with a visible keyboard focus ring", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet.cssRules);
    for (const selector of [".audio-player__volume", ".audio-player__volume input", ".audio-player__mute"]) {
      const rule = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === selector);
      expect(rule.style.getPropertyValue("border")).toBe("0");
    }
    const focus = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".audio-player__mute:focus-visible");
    expect(focus.style.getPropertyValue("outline")).toContain("var(--focus-ring)");
    expect(focus.style.getPropertyValue("outline-offset")).toBe("2px");
  } finally { style.remove(); }
});

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
