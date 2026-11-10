import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const css = readFileSync(resolve("src", "foundations", "DistributionSurfaces.css"), "utf8");
function rule(selector) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  try {
    const match = [...style.sheet.cssRules].find((item) => item.selectorText?.replace(/\s+/g, " ") === selector.replace(/\s+/g, " "));
    if (!match) throw new Error(`Missing distribution style: ${selector}`);
    return match.style;
  } finally { style.remove(); }
}

it("uses the inverted dark surface and light text on every A-List card variant", () => {
  const card = rule(".dub-card.dub-card--alist");
  expect(card.getPropertyValue("border-color")).toBe("var(--release-alist-accent)");
  expect(card.getPropertyValue("background")).toBe("var(--release-alist-surface)");
  expect(card.getPropertyValue("--text-primary")).toBe("var(--release-alist-text)");
  expect(card.getPropertyValue("--text-secondary")).toBe("var(--release-alist-text-secondary)");
  for (const token of ["--audio-active", "--media-accent", "--action-primary"]) {
    expect(card.getPropertyValue(token)).toBe("");
  }
  expect(rule(".dub-card.dub-card--alist:hover,\n.dub-card.dub-card--alist.dub-card--current").getPropertyValue("border-color"))
    .toBe("var(--release-alist-accent-hover)");
});

it("inverts A-List players to dark surfaces with orange transport and waveforms", () => {
  const player = rule(".organism-card.audio-player.audio-player--alist, .dub-card .organism-card.audio-player.audio-player--alist");
  expect(player.getPropertyValue("background")).toBe("var(--release-alist-surface)");
  expect(player.getPropertyValue("--text-primary")).toBe("var(--release-alist-text)");
  expect(player.getPropertyValue("--audio-active")).toBe("var(--release-alist-accent)");
  expect(player.getPropertyValue("--player-tab-surface")).toBe("var(--release-alist-surface)");
  expect(player.getPropertyValue("--player-tab-color")).toBe("var(--release-alist-accent)");
  const play = rule(".organism-card.audio-player.audio-player--alist .transport-controls .transport-controls__play, .organism-card.audio-player.audio-player--alist .transport-controls .transport-controls__play:hover:not(:disabled)");
  expect(play.getPropertyValue("background")).toBe("var(--release-alist-accent)");
  expect(play.getPropertyValue("color")).toBe("var(--text-on-accent)");
  expect(player.getPropertyValue("border-color")).toBe("var(--release-alist-accent)");
  expect(rule(".audio-player--alist .now-playing__artwork").getPropertyValue("outline")).toBe("2px solid var(--release-alist-accent)");
  const label = rule(".audio-player--alist .now-playing__context");
  expect(label.getPropertyValue("background")).toBe("var(--release-alist-accent)");
  expect(label.getPropertyValue("color")).toBe("var(--text-on-accent)");
});

it("uses orange accents for both media kinds within A-List cards and pack details", () => {
  const palette = rule(".dub-card--alist, .dub-card--alist .media-kind--dub, .dub-card--alist .media-kind--sample, .pack-view--alist, .pack-view--alist .media-kind--dub, .pack-view--alist .media-kind--sample, .audio-player--alist .media-kind--dub, .audio-player--alist .media-kind--sample, .organism-card.audio-player.audio-player--alist");
  expect(palette.getPropertyValue("--media-accent")).toBe("var(--release-alist-accent)");
  expect(palette.getPropertyValue("--audio-active")).toBe("var(--release-alist-accent)");
});
