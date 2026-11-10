import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { layers } from "../../tokens/src/index";
import tokens from "../../tokens/src/tokens.json";

it("keeps stacking layers synchronized across CSS, TypeScript and JSON", () => {
  expect(tokens.layers).toEqual(layers);
  const css = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
  for (const [name, value] of Object.entries(layers)) {
    expect(css).toContain(`--layer-${name}: ${value};`);
  }
  const ordered = Object.values(layers);
  expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
  expect(new Set(ordered).size).toBe(ordered.length);
});

it("isolates window ranks below global popovers and notifications", () => {
  const css = readFileSync(resolve("src", "organisms", "Window", "Window.css"), "utf8");
  expect(css).toContain("isolation: isolate");
  expect(css).toContain("z-index: var(--layer-windows)");
  for (const [path, token] of [
    ["molecules/PlayerPositionMenu/PlayerPositionMenu.css", "popover"],
    ["organisms/NotificationViewport/NotificationViewport.css", "notification"],
    ["atoms/SnapPreview/SnapPreview.css", "snap-preview"],
  ]) {
    expect(readFileSync(resolve("src", ...path.split("/")), "utf8")).toContain(`z-index: var(--layer-${token})`);
  }
});
