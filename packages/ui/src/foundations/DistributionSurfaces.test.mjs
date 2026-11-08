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

function mobileRuleFor(css, selector, breakpoint) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  try {
    const media = Array.from(style.sheet?.cssRules ?? []).find(
      (candidate) => candidate instanceof CSSMediaRule && candidate.conditionText === `(max-width: ${breakpoint})`,
    );
    const rule = Array.from(media?.cssRules ?? []).find(
      (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === selector,
    );
    if (!rule) throw new Error(`Missing mobile CSS rule: ${selector}`);
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

  it("uses the inverted A-List palette for sidebar and mobile navigation, including active states", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const sidebar = ruleFor(css, ".app-sidebar .navigation__item--alist");
    const activeSidebar = ruleFor(css, '.app-sidebar .navigation__item--alist[aria-current="page"]');
    expect(sidebar.getPropertyValue("background")).toBe("var(--surface-inverse)");
    expect(sidebar.getPropertyValue("border")).toContain("var(--action-inverse)");
    expect(sidebar.getPropertyValue("color")).toBe("var(--action-inverse)");
    expect(activeSidebar.getPropertyValue("background")).toBe("var(--action-inverse)");
    expect(activeSidebar.getPropertyValue("border-color")).toBe("var(--action-inverse-pressed)");
    expect(activeSidebar.getPropertyValue("color")).toBe("var(--text-on-inverse-accent)");
    expect(ruleFor(css, '.app-sidebar .navigation__item--alist[aria-current="page"]:hover').getPropertyValue("background")).toBe("var(--action-inverse-hover)");
    expect(ruleFor(css, '.app-sidebar .navigation__item--alist[aria-current="page"]:active').getPropertyValue("background")).toBe("var(--action-inverse-pressed)");
    const navigationCss = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
    const activeNavigation = ruleFor(navigationCss, '.navigation__item--alist[aria-current="page"]');
    expect(activeNavigation.getPropertyValue("background")).toBe("var(--action-inverse)");
    expect(activeNavigation.getPropertyValue("color")).toBe("var(--text-on-inverse-accent)");
    expect(css).toMatch(/\.mobile-tabs button\.mobile-tabs__item--alist\s*\{\s*background:\s*var\(--surface-inverse\);/);
    expect(css).toMatch(/\.mobile-tabs button\.mobile-tabs__item--alist\.is-active\s*\{\s*background:\s*var\(--action-inverse\);/);
    expect(css).toMatch(/\.mobile-tabs button\.mobile-tabs__item--alist\.is-active:hover\s*\{\s*background:\s*var\(--action-inverse-hover\);/);
    expect(css).toMatch(/\.mobile-tabs button\.mobile-tabs__item--alist\.is-active:active\s*\{\s*background:\s*var\(--action-inverse-pressed\);/);
  });

  it("uses each sidebar variant's accent for its count", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const standard = ruleFor(css, ".app-sidebar .navigation__badge");
    const alist = ruleFor(css, ".app-sidebar .navigation__item--alist .navigation__badge");
    const selectedAlist = ruleFor(css, '.app-sidebar .navigation__item--alist[aria-current="page"] .navigation__badge');
    const privateBadge = ruleFor(css, ".app-sidebar .navigation__item--private .navigation__badge");
    expect(standard.getPropertyValue("background")).toBe("var(--action-primary)");
    expect(alist.getPropertyValue("background")).toBe("var(--action-inverse)");
    expect(alist.getPropertyValue("color")).toBe("var(--text-on-inverse-accent)");
    expect(selectedAlist.getPropertyValue("box-shadow")).toContain("var(--text-on-inverse-accent)");
    expect(privateBadge.getPropertyValue("background")).toBe("var(--audio-active)");
    expect(privateBadge.getPropertyValue("color")).toBe("var(--text-on-accent)");
  });
});

describe("mobile distribution layouts", () => {
  it("uses compact, square cards and controls for every distribution", () => {
    const cardCss = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
    const searchCss = readFileSync(resolve("src", "organisms", "DubSearch", "DubSearch.css"), "utf8");
    const card = mobileRuleFor(cardCss, ".dub-card", "760px");
    const track = mobileRuleFor(cardCss, ".dub-card__track", "760px");
    const distribution = mobileRuleFor(searchCss, ".dub-search__distribution", "520px");
    expect(card.getPropertyValue("border-radius")).toBe("0");
    expect(card.getPropertyValue("padding")).toBe("0.625rem");
    expect(track.getPropertyValue("padding")).toBe("0.5rem 0");
    expect(distribution.getPropertyValue("border-radius")).toBe("0");
  });

  describe("dub card audio player surface", () => {
    it("uses the distribution palette with horizontal padding and rounded corners", () => {
      const css = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
      const player = ruleFor(css, ".dub-card .organism-card.audio-player");
      const privatePlayer = ruleFor(css, ".dub-card--private .organism-card.audio-player");
      expect(player.getPropertyValue("background")).toBe("var(--surface-control)");
      expect(player.getPropertyValue("border-radius")).toBe("5px");
      expect(player.getPropertyPriority("border-radius")).toBe("important");
      expect(player.getPropertyValue("padding-left")).toBe("0.75rem");
      expect(player.getPropertyValue("padding-right")).toBe("0.75rem");
      expect(privatePlayer.getPropertyValue("background")).toBe("var(--surface-canvas)");
    });
  });

  it("stretches every mobile menu link to the available width", () => {
    const css = readFileSync(resolve("src", "organisms", "MobileNavigation", "MobileNavigation.css"), "utf8");
    const items = ruleFor(css, ".mobile-navigation__menu.navigation .navigation__items");
    const link = ruleFor(css, ".mobile-navigation__menu.navigation .navigation__item");
    expect(items.getPropertyValue("grid-template-columns")).toBe("minmax(0, 1fr)");
    expect(items.getPropertyValue("justify-content")).toBe("stretch");
    expect(link.getPropertyValue("width")).toBe("100%");
  });
});
