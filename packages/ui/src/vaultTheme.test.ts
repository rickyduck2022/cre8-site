import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("keeps archive surface treatment opt-in, decorative and independent of media colours", () => {
  const css = readFileSync(resolve("src", "foundations", "VaultTheme.css"), "utf8");
  expect(css).toContain(".vault-theme .vault-panel");
  expect(css).toContain(".vault-theme .vault-rack");
  expect(css).toContain("pointer-events: none");
  expect(css).toContain("box-shadow: var(--vault-panel-shadow)");
  expect(css).not.toMatch(/--(?:media|audience|audio|action)-[\w-]+\s*:|#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(|color-mix\(|var\(--color-/i);
  const label = readFileSync(resolve("src", "atoms", "VaultLabel", "VaultLabel.css"), "utf8");
  expect(label).toContain("var(--font-mono)");
  expect(label).toContain("var(--vault-label)");
  expect(label).not.toContain("animation:");
});

it("keeps the descriptor header's mobile search usable without changing default headers", () => {
  const css = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
  expect(css).toContain(".app-header--described");
  expect(css).toContain(".app-header--described .app-header__search");
  expect(css).toMatch(/grid-column: 1 \/ -1;\s+grid-row: 2;/);
  const dashboard = readFileSync(resolve("src", "templates", "DashboardTemplate", "DashboardTemplate.css"), "utf8");
  expect(dashboard).toContain(".dashboard-template__header { min-width: 0; }");
});
