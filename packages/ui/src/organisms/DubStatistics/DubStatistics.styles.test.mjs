import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("uses compact token-based tiles and stacks statistics on mobile", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "organisms", "DubStatistics", "DubStatistics.css"), "utf8");
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet.cssRules);
    const rule = (selector) => rules.find((item) => item instanceof CSSStyleRule && item.selectorText === selector).style;
    expect(rule(".dub-statistics").getPropertyValue("background")).toBe("var(--color-background)");
    expect(rule(".dub-statistics__metric").getPropertyValue("background")).toBe("var(--surface-media-section)");
    expect(rule(".dub-statistics__value").getPropertyValue("font-family")).toBe("var(--font-mono)");
    const mobile = rules.find((item) => item instanceof CSSMediaRule && item.conditionText === "(max-width: 760px)");
    const layout = Array.from(mobile.cssRules).find((item) => item instanceof CSSStyleRule && item.selectorText === ".dub-statistics__layout");
    expect(layout.style.getPropertyValue("grid-template-columns")).toBe("minmax(0, 1fr)");
  } finally {
    style.remove();
  }
});
