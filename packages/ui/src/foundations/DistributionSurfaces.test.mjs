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
      (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText.replace(/\s+/g, " ") === selector.replace(/\s+/g, " "),
    );
    if (!rule) throw new Error(`Missing mobile CSS rule: ${selector}`);
    return rule.style;
  } finally {
    style.remove();
  }
}

describe("A-List distribution surface", () => {
  it("uses the private surface for A-List cards, players and statistics", () => {
    const surfaceCss = readFileSync(resolve("src", "foundations", "DistributionSurfaces.css"), "utf8");
    const surface = ruleFor(surfaceCss, ".dub-card--private, .dub-card--alist, .audio-player--private, .audio-player--alist, .audio-player--worldwide, .my-dubs-template__statistics--private, .my-dubs-template__statistics--alist");
    expect(surface.getPropertyValue("--surface-raised").trim()).toBe("var(--color-background)");
    expect(surface.getPropertyValue("--text-primary")).toBe("");
    expect(surface.getPropertyValue("--action-primary")).toBe("");
  });

  it("uses the private palette for A-List navigation and filters", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const sidebar = ruleFor(css, ".app-sidebar .navigation__item--alist, .app-sidebar .navigation__item--private");
    expect(sidebar.getPropertyValue("background")).toBe("var(--color-background)");
    expect(sidebar.getPropertyValue("color")).toBe("var(--text-primary)");
    const active = ruleFor(css, '.app-sidebar .navigation__item--alist:hover, .app-sidebar .navigation__item--alist[aria-current="page"], .app-sidebar .navigation__item--private:hover, .app-sidebar .navigation__item--private[aria-current="page"]');
    expect(active.getPropertyValue("color")).toBe("var(--audio-active)");
    const navigationCss = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
    expect(ruleFor(navigationCss, '.navigation__item--alist, .navigation__item--alist:hover, .navigation__item--alist[aria-current="page"], .navigation__item--private, .navigation__item--private:hover, .navigation__item--private[aria-current="page"]').getPropertyValue("background")).toBe("var(--color-background)");
    const search = readFileSync(resolve("src", "organisms", "DubSearch", "DubSearch.css"), "utf8");
    expect(ruleFor(search, ".dub-search__distribution--private, .dub-search__distribution--alist").getPropertyValue("background")).toBe("var(--color-background)");
  });

  it("uses each sidebar variant's accent for its count", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const standard = ruleFor(css, ".app-sidebar .navigation__badge");
    const privateBadge = ruleFor(css, ".app-sidebar .navigation__item--alist .navigation__badge, .app-sidebar .navigation__item--private .navigation__badge");
    expect(standard.getPropertyValue("background")).toBe("var(--action-primary)");
    expect(privateBadge.getPropertyValue("background")).toBe("var(--audio-active)");
    expect(privateBadge.getPropertyValue("color")).toBe("var(--text-on-accent)");
  });
});

describe("mobile distribution layouts", () => {
  it("uses rounded cards and compact controls for every distribution", () => {
    const cardCss = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
    const searchCss = readFileSync(resolve("src", "organisms", "DubSearch", "DubSearch.css"), "utf8");
    const card = mobileRuleFor(cardCss, ".dub-card", "760px");
    const track = mobileRuleFor(cardCss, ".dub-card__track", "760px");
    const distribution = mobileRuleFor(searchCss, ".dub-search__distribution", "520px");
    expect(ruleFor(cardCss, ".dub-card").getPropertyValue("border-radius")).toBe("0.75rem");
    expect(card.getPropertyValue("border-radius")).toBe("");
    expect(card.getPropertyValue("padding")).toBe("1rem 0.625rem");
    expect(ruleFor(cardCss, ".dub-card").getPropertyValue("box-shadow")).toBe("var(--shadow-card)");
    expect(track.getPropertyValue("padding")).toBe("0.5rem 0");
    expect(distribution.getPropertyValue("border-radius")).toBe("0");
  });

  describe("dub card audio player surface", () => {
    it("uses the distribution palette with horizontal padding and rounded corners", () => {
      const css = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
      const player = ruleFor(css, ".dub-card .organism-card.audio-player");
      const privatePlayer = ruleFor(css, ".dub-card--private .organism-card.audio-player, .dub-card--alist .organism-card.audio-player, .dub-card .organism-card.audio-player--worldwide");
      expect(player.getPropertyValue("background")).toBe("var(--surface-control)");
      expect(player.getPropertyValue("border-radius")).toBe("5px");
      expect(player.getPropertyPriority("border-radius")).toBe("important");
      expect(player.getPropertyValue("padding-left")).toBe("0.75rem");
      expect(player.getPropertyValue("padding-right")).toBe("0.75rem");
      expect(privatePlayer.getPropertyValue("background")).toBe("var(--surface-canvas)");
      const surfaces = readFileSync(resolve("src", "foundations", "DistributionSurfaces.css"), "utf8");
      expect(ruleFor(surfaces, ".dub-card--private, .dub-card--alist, .audio-player--private, .audio-player--alist, .audio-player--worldwide, .my-dubs-template__statistics--private, .my-dubs-template__statistics--alist")
        .getPropertyValue("--surface-raised").trim()).toBe("var(--color-background)");
      const mobilePlayer = mobileRuleFor(css, ".dub-card .organism-card.audio-player", "760px");
      expect(mobilePlayer.getPropertyValue("padding-top")).toBe("0.5rem");
      expect(mobilePlayer.getPropertyValue("padding-bottom")).toBe("0.5rem");
    });
  });

  it("uses a prominent light A-List distribution label and keeps approval ticks orange", () => {
    const css = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
    const tag = ruleFor(css, ".dub-card__distribution--alist, .dub-card__distribution--alist:hover");
    expect(tag.getPropertyValue("background")).toBe("var(--surface-inverse)");
    expect(tag.getPropertyValue("color")).toBe("var(--text-inverse)");
    expect(tag.getPropertyValue("font-size")).toBe("var(--type-size-label)");
    expect(tag.getPropertyValue("font-weight")).toBe("var(--type-weight-strong)");
    const badge = ruleFor(css, ".dub-card--alist .alist-badge");
    expect(badge.getPropertyValue("--alist-badge-background").trim()).toBe("var(--color-orange-500)");
    expect(badge.getPropertyValue("--alist-badge-foreground").trim()).toBe("var(--color-neutral-950)");
  });

  it("joins My Dubs statistics to the card without rounded corners or gaps", () => {
    const css = readFileSync(resolve("src", "templates", "MyDubsTemplate", "MyDubsTemplate.css"), "utf8");
    const card = ruleFor(css, ".my-dubs-template__track > .dub-card");
    const details = ruleFor(css, ".my-dubs-template__statistics");
    const summary = ruleFor(css, ".my-dubs-template__statistics summary");
    expect(card.getPropertyValue("border-bottom-left-radius")).toBe("0");
    expect(card.getPropertyValue("border-bottom-right-radius")).toBe("0");
    expect(details.getPropertyValue("margin")).toBe("0");
    expect(summary.getPropertyValue("border-top")).toBe("0");
    expect(summary.getPropertyValue("border-radius")).toBe("0");
    expect(ruleFor(css, ".my-dubs-template__statistics .dub-statistics").getPropertyValue("border-radius")).toBe("0");
  });

  it("retains desktop card spacing and library download dates on mobile", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    expect(ruleFor(css, ".feed-list").getPropertyValue("gap")).toBe("1rem");
    expect(css).not.toMatch(/\.feed-list\s*>\s*\.dub-card\s*\+\s*\.dub-card/);
    expect(css).not.toMatch(/\.app-content:not\(\.app-content--messenger\)\s+\.feed-list/);
    expect(css).not.toMatch(/\.feed-list\s*\{\s*gap:\s*0\s*;/);
    expect(ruleFor(css, ".dub-card-list__downloaded").getPropertyValue("margin")).toBe("0");
    const myDubs = readFileSync(resolve("src", "templates", "MyDubsTemplate", "MyDubsTemplate.css"), "utf8");
    const card = mobileRuleFor(myDubs, ".my-dubs-template__track > .dub-card", "760px");
    expect(card.getPropertyValue("border-bottom-left-radius")).toBe("0.75rem");
    expect(card.getPropertyValue("border-bottom-right-radius")).toBe("0.75rem");
  });

  it("keeps mobile search and navigation compact", () => {
    const search = readFileSync(resolve("src", "organisms", "DubSearch", "DubSearch.css"), "utf8");
    expect(mobileRuleFor(search, ".dub-search__toggle-label", "760px").getPropertyValue("display")).toBe("none");
    const nav = readFileSync(resolve("src", "organisms", "MobileNavigation", "MobileNavigation.css"), "utf8");
    const container = ruleFor(nav, ".mobile-tabs.mobile-navigation");
    expect(container.getPropertyValue("box-shadow")).toBe("0 -0.125rem 0.375rem var(--mobile-navigation-active-surface), 0 -0.375rem 1rem var(--mobile-navigation-active-surface)");
    const shell = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    expect(mobileRuleFor(shell, ".mobile-tabs", "760px").getPropertyValue("border-top")).toBe("");
    expect(container.getPropertyValue("padding")).toBe("0");
    expect(container.getPropertyValue("gap")).toBe("0");
    expect(ruleFor(nav, ".mobile-navigation .mobile-navigation__item").getPropertyValue("border-radius")).toBe("0");
    expect(ruleFor(nav, '.mobile-navigation .mobile-navigation__item[aria-current="page"]').getPropertyValue("background")).toBe("var(--mobile-navigation-active-surface)");
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
