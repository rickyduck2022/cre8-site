import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function ruleFor(css, selector) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  try {
    const rule = Array.from(style.sheet?.cssRules ?? []).find(
      (candidate) =>
        candidate instanceof CSSStyleRule &&
        candidate.selectorText.replace(/\s+/g, " ") === selector.replace(/\s+/g, " "),
    );
    if (!rule) throw new Error(`Missing CSS rule: ${selector}`);
    return rule.style;
  } finally {
    style.remove();
  }
}

describe("A-List distribution surface", () => {
  it("shares teal action and foreground tokens between cards and players", () => {
    const surfaceCss = readFileSync(resolve("src", "foundations", "DistributionSurfaces.css"), "utf8");
    const tokensCss = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
    const surface = ruleFor(surfaceCss, ".dub-card.dub-card--alist,\n.organism-card.audio-player--alist");
    const tokens = ruleFor(tokensCss, ":root");

    expect(tokens.getPropertyValue("--audio-inverse-active").trim()).toBe("#006C7A");
    expect(tokens.getPropertyValue("--action-inverse").trim()).toBe("var(--audio-inverse-active)");
    expect(surface.getPropertyValue("--action-primary").trim()).toBe("var(--action-inverse)");
    expect(surface.getPropertyValue("--action-primary-hover").trim()).toBe("var(--action-inverse-hover)");
    expect(surface.getPropertyValue("--action-primary-pressed").trim()).toBe("var(--action-inverse-pressed)");
    expect(surface.getPropertyValue("--text-on-accent").trim()).toBe("var(--text-on-inverse-accent)");
    expect(tokens.getPropertyValue("--text-on-inverse-accent").trim()).toBe("var(--surface-inverse-raised)");
    expect(tokens.getPropertyValue("--action-inverse-hover")).toContain("var(--action-inverse)");
    expect(tokens.getPropertyValue("--action-inverse-pressed")).toContain("var(--action-inverse)");
  });
});
