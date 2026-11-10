import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("keeps the mobile details row compact without a bottom divider", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
  document.head.append(style);
  try {
    const mobile = Array.from(style.sheet.cssRules).find((rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px)");
    const rules = Array.from(mobile.cssRules);
    const track = Array.from(style.sheet.cssRules).find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-card__track");
    const buttons = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-card__mobile-actions .button");
    const details = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-card__mobile-details");
    const distribution = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-card__distribution-column");
    const card = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-card");
    expect(track.style.getPropertyValue("border-bottom")).toBe("");
    expect(track.style.getPropertyValue("border-top")).toBe("");
    expect(buttons.style.getPropertyValue("min-height")).toBe("2rem");
    expect(buttons.style.getPropertyValue("min-width")).toBe("2.75rem");
    expect(details.style.getPropertyValue("display")).toBe("flex");
    expect(distribution.style.getPropertyValue("gap")).toBe("var(--spacing-4)");
    expect(card.style.getPropertyValue("padding")).toBe("1rem 0.625rem 0.5rem");
  } finally {
    style.remove();
  }
});

it("removes the embedded player border while retaining horizontal padding", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
  document.head.append(style);
  try {
    const rule = Array.from(style.sheet.cssRules).find(
      (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === ".dub-card .organism-card.audio-player",
    );
    expect(rule).toBeDefined();
    expect(rule.style.getPropertyValue("background")).toBe("var(--surface-canvas)");
    expect(rule.style.getPropertyValue("border")).toBe("0");
    expect(rule.style.getPropertyValue("box-shadow")).toBe("var(--shadow-media-inset)");
    expect(rule.style.getPropertyValue("padding-left")).toBe("0.75rem");
    expect(rule.style.getPropertyValue("padding-right")).toBe("0.75rem");
    expect(rule.style.getPropertyValue("padding-top")).toBe("");
    expect(rule.style.getPropertyValue("padding-bottom")).toBe("");
  } finally {
    style.remove();
  }
});

it("gives individual dub cards the dark surface without overriding collection surfaces", () => {
  const surfaces = readFileSync(resolve("src", "foundations", "DistributionSurfaces.css"), "utf8");
  const css = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
  const style = document.createElement("style");
  style.textContent = `${surfaces}\n${css}`;
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet.cssRules);
    const card = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-card");
    expect(card.style.getPropertyValue("box-shadow")).toBe("var(--shadow-card)");
    expect(card.style.getPropertyValue("border")).toBe("1px solid var(--color-neutral-950)");
    const surface = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText.split(",").map((part) => part.trim()).includes(".dub-card:not(.dub-card--collection)"));
    expect(surface.style.getPropertyValue("--surface-raised").trim()).toBe("var(--color-background)");
    const collection = document.createElement("article");
    collection.className = "dub-card dub-card--collection";
    expect(collection.matches(surface.selectorText)).toBe(false);
    for (const [distribution, color, shadow] of [["worldwide", "var(--audience-worldwide)", "var(--shadow-control-blue)"], ["private", "var(--audio-active)", "var(--shadow-control-audio)"], ["alist", "var(--audience-alist)", "var(--shadow-control-accent)"]]) {
      const selector = `.dub-card__distribution--${distribution}, .dub-card__distribution--${distribution}:hover`;
      const rule = rules.find((candidate) => candidate instanceof CSSStyleRule && candidate.selectorText.replace(/\s+/g, " ") === selector);
      expect(rule.style.getPropertyValue("background")).toBe(color);
      expect(rule.style.getPropertyValue("color")).toBe("var(--text-on-accent)");
      expect(rule.style.getPropertyValue("box-shadow")).toBe(shadow);
    }
  } finally {
    style.remove();
  }
});

it("adds spacing between the player and metadata without changing other gaps", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet.cssRules);
    const selector = ".dub-card__track-info > .audio-player + .dub-card__metadata";
    const spacing = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === selector);
    expect(spacing.style.getPropertyValue("margin-top")).toBe("0.5rem");
    const mobile = rules.find((rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px)");
    const mobileSpacing = Array.from(mobile.cssRules).find((rule) => rule instanceof CSSStyleRule && rule.selectorText === selector);
    expect(mobileSpacing.style.getPropertyValue("margin-top")).toBe("0.75rem");
  } finally {
    style.remove();
  }
});

it("uses the waveform color for the current track's control and keeps its icon dark", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet.cssRules);
    const surface = rules.find((candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === ".dub-card .organism-card.audio-player.dub-card__player--current");
    expect(surface.style.getPropertyValue("background")).toBe("var(--surface-media-section)");
    const inactiveVolume = rules.find((candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === ".dub-card .audio-player .audio-player__volume input");
    expect(inactiveVolume.style.getPropertyValue("accent-color")).toBe("var(--surface-media-section)");
    const volume = rules.find((candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === ".dub-card .audio-player.dub-card__player--current .audio-player__volume input");
    expect(volume.style.getPropertyValue("accent-color")).toBe("var(--audio-active)");
    const playing = ".dub-card .audio-player.dub-card__player--current .transport-controls .transport-controls__play";
    const rule = rules.find((candidate) => candidate instanceof CSSStyleRule && candidate.selectorText.replace(/\s+/g, " ") === `${playing}, ${playing}:hover:not(:disabled)`);
    expect(rule.style.getPropertyValue("background")).toBe("var(--audio-active)");
    expect(rule.style.getPropertyValue("border-color")).toBe("var(--audio-active)");
    expect(rule.style.getPropertyValue("color")).toBe("var(--text-on-accent)");
    const hover = rules.find((candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === `${playing}:hover:not(:disabled)`);
    expect(hover.style.getPropertyValue("background")).toBe("var(--media-accent-hover)");
    expect(hover.style.getPropertyValue("border-color")).toBe(hover.style.getPropertyValue("background"));
  } finally {
    style.remove();
  }
});
