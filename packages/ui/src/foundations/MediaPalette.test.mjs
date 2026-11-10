import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const theme = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
const palette = readFileSync(resolve("src", "foundations", "MediaPalette.css"), "utf8");
const tokens = JSON.parse(readFileSync(resolve("..", "tokens", "src", "tokens.json"), "utf8"));
const color = (name) => {
  const hex = theme.match(new RegExp(`--color-${name}:\\s*#([0-9a-f]{6})`, "i"))?.[1];
  if (!hex) throw new Error(`Missing color ${name}`);
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
};
const luminance = (rgb) => rgb.map((value) => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

it.each(["cyan-400", "green-400", "orange-500"])("%s has readable text and waveform contrast on light and dark media variants", (name) => {
  const accent = color(name);
  const dark = color("neutral-950");
  const secondary = color("neutral-900");
  expect(contrast(accent, dark)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(accent, secondary)).toBeGreaterThanOrEqual(4.5);
  const dimWaveform = dark.map((channel, index) => channel * 0.7 + accent[index] * 0.3);
  expect(contrast(accent, dimWaveform)).toBeGreaterThanOrEqual(3);
  const controller = dark.map((channel, index) => channel * 0.9 + accent[index] * 0.1);
  expect(contrast(accent, controller)).toBeGreaterThanOrEqual(3);
  expect(contrast(color("neutral-50"), controller)).toBeGreaterThanOrEqual(4.5);
});

it("keeps the sample palette in shared tokens instead of hard-coding it in composites", () => {
  expect(tokens.color.green["400"].toUpperCase()).toBe("#4DD89A");
  expect(tokens.semantic.audio["sample-active"]).toBe("var(--color-green-400)");
  expect(palette).toContain("--media-accent: var(--audio-sample-active)");
  expect(palette).toContain("--audio-active: var(--media-accent)");
  const css = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
  expect(css).toContain("--audio-active: var(--media-accent)");
  expect(css).toContain("background: var(--media-accent)");
});
