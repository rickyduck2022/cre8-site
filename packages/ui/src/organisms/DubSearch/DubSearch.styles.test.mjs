import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("keeps audience identities visually distinct, including while unselected", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "foundations", "AudiencePalette.css"), "utf8")
    + readFileSync(resolve("src", "organisms", "DubSearch", "DubSearch.css"), "utf8");
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet.cssRules);
    const rule = (selector) => rules.find((item) => item.selectorText === selector);
    expect(rule(".audience--worldwide").style.getPropertyValue("--audience-accent").trim()).toBe("var(--audience-worldwide)");
    expect(rule(".audience--private").style.getPropertyValue("--audience-accent").trim()).toBe("var(--audience-private)");
    expect(rule(".audience--alist").style.getPropertyValue("--audience-accent").trim()).toBe("var(--audience-alist)");
    expect(rule(".dub-search__distribution").style.getPropertyValue("border-top")).toBe("3px solid var(--audience-accent)");
    expect(rule(".dub-search__distribution:has(input:checked)").style.getPropertyValue("border-color")).toBe("var(--audience-accent)");
    expect(rule(".dub-search__distribution:focus-within").style.getPropertyValue("outline")).toBe("2px solid var(--focus-ring)");
    const mobile = rules.find((item) => item instanceof CSSMediaRule && item.conditionText === "(max-width: 520px)");
    const tiles = Array.from(mobile.cssRules).find((item) => item.selectorText === ".dub-search__distribution-options");
    expect(tiles.style.getPropertyValue("grid-template-columns")).toBe("minmax(0, 1fr)");
  } finally {
    style.remove();
  }
});
