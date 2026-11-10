import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function ruleFor(css, selector) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  try {
    const rule = Array.from(style.sheet?.cssRules ?? []).find(
      (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText.replace(/\s+/g, " ") === selector.replace(/\s+/g, " "),
    );
    if (!rule) throw new Error(`Missing CSS rule: ${selector}`);
    return rule.style;
  } finally {
    style.remove();
  }
}

function mediaRuleFor(css, selector, condition = "(max-width: 760px)") {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  try {
    const mobile = Array.from(style.sheet?.cssRules ?? []).find(
      (candidate) => candidate instanceof CSSMediaRule && candidate.conditionText === condition,
    );
    const rule = Array.from(mobile?.cssRules ?? []).find(
      (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText.replace(/\s+/g, " ") === selector.replace(/\s+/g, " "),
    );
    if (!rule) throw new Error(`Missing mobile CSS rule: ${selector}`);
    return rule.style;
  } finally {
    style.remove();
  }
}

function mobileRuleFor(css, selector) {
  return mediaRuleFor(css, selector);
}

describe("footer player tab layout", () => {
  it("anchors the media section and mobile navigation together while leaving the mini player movable", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const footer = ruleFor(css, ".app-sticky-footer");
    expect(footer.getPropertyValue("position")).toBe("fixed");
    expect(footer.getPropertyValue("bottom")).toBe("0");
    expect(footer.getPropertyValue("left")).toBe("var(--app-sidebar-width)");
    expect(footer.getPropertyValue("pointer-events")).toBe("none");
    expect(ruleFor(css, ".app-sticky-footer > *").getPropertyValue("pointer-events")).toBe("auto");
    expect(ruleFor(css, ".app-player").getPropertyValue("position")).toBe("relative");
    expect(ruleFor(css, ".community-dashboard-template .app-player.audio-player--minimized").getPropertyValue("position")).toBe("fixed");
    expect(mobileRuleFor(css, ".mobile-tabs").getPropertyValue("position")).toBe("relative");
  });

  it("keeps header navigation outside the scrollable content", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const body = ruleFor(css, ".community-dashboard-template .dashboard-template__body");
    expect(body.getPropertyValue("grid-row")).toBe("2");
    expect(body.getPropertyValue("padding")).toBe("var(--spacing-4) 0 0");
    const overlayCss = readFileSync(resolve("src", "templates", "DashboardTemplate", "DashboardTemplate.css"), "utf8");
    const overlay = ruleFor(overlayCss, ".dashboard-template__content-overlay");
    expect(overlay.getPropertyValue("grid-row")).toBe("2");
    expect(overlay.getPropertyValue("pointer-events")).toBe("none");
  });

  it("adds space below the expanded footer timeline without affecting the mini player", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const timeline = ruleFor(css, ".community-dashboard-template .app-player.audio-player--controller:not(.audio-player--minimized) .audio-player__timeline");
    expect(timeline.getPropertyValue("margin-bottom")).toBe("0.25rem");
  });

  it("uses inset shadows for desktop player surfaces and tabs", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const desktop = "(min-width: 761px)";
    for (const selector of [
      ".community-dashboard-template .app-player.audio-player--playable",
      ".community-dashboard-template--player-header .app-player.audio-player--playable.audio-player--controller:not(.audio-player--minimized)",
      ".community-dashboard-template .app-player.audio-player--playable.audio-player--minimized",
      ".community-dashboard-template .app-player.audio-player--controller .audio-player__minimize, .community-dashboard-template .app-player.audio-player--controller .audio-player__drag, .community-dashboard-template .app-player.audio-player--controller .player-position-menu__trigger, .community-dashboard-template .app-player.audio-player--playable.audio-player--minimized .audio-player__minimize, .community-dashboard-template--player-header .app-player.audio-player--controller:not(.audio-player--minimized) .audio-player__minimize",
    ]) {
      expect(mediaRuleFor(css, selector, desktop).getPropertyValue("box-shadow")).toMatch(/^inset /);
    }
  });

  it("gives the app header a matching downward shadow", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const header = ruleFor(css, ".community-dashboard-template .app-topbar");
    expect(header.getPropertyValue("box-shadow")).toBe("0 0.25rem 0.5rem rgb(0 0 0 / 45%), 0 0.75rem 2rem rgb(0 0 0 / 40%)");
  });

  it("uses the dub card surface for the navigation shadow in all player states", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const navCss = readFileSync(resolve("src", "organisms", "MobileNavigation", "MobileNavigation.css"), "utf8");
    expect(ruleFor(navCss, ".mobile-tabs.mobile-navigation").getPropertyValue("box-shadow"))
      .toBe("0 -0.125rem 0.375rem var(--color-background), 0 -0.375rem 1rem var(--color-background)");
    expect(css).not.toContain(".community-dashboard-template--player-minimized .mobile-tabs.mobile-navigation");
  });

  it("does not reserve footer space when there is no player", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    expect(ruleFor(css, ".community-dashboard-template:not(.community-dashboard-template--has-player)").getPropertyValue("--app-player-height").trim()).toBe("0rem");
    expect(ruleFor(css, ".community-dashboard-template .dashboard-template__main").getPropertyValue("padding-bottom")).toBe("var(--app-player-height)");
    expect(mobileRuleFor(css, ".community-dashboard-template .dashboard-template__main").getPropertyValue("padding-bottom")).toBe("calc(var(--app-player-height) + var(--mobile-navigation-height))");
    expect(mobileRuleFor(css, ".community-dashboard-template--has-player.community-dashboard-template--messenger:not(.community-dashboard-template--player-minimized) .dashboard-template__main").getPropertyValue("padding-bottom"))
      .toBe("calc(var(--measured-app-player-height, 10rem) + var(--mobile-navigation-height))");
  });

  it("floats the minimized desktop player without reserving the footer and keeps the message composer accessible", () => {
    const shellCss = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const messengerCss = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    const desktop = "(min-width: 761px)";
    const player = mediaRuleFor(shellCss, ".community-dashboard-template .app-player.audio-player--minimized", desktop);
    expect(player.getPropertyValue("bottom")).toBe("var(--floating-player-bottom, 1rem)");
    expect(player.getPropertyValue("right")).toBe("var(--floating-player-right, 1rem)");
    expect(player.getPropertyValue("left")).toBe("var(--floating-player-left, auto)");
    expect(player.getPropertyValue("top")).toBe("var(--floating-player-top, auto)");
    const handle = ruleFor(shellCss, ".app-player.audio-player--minimized .audio-player__drag");
    expect(handle.getPropertyValue("display")).toBe("inline-flex");
    expect(handle.getPropertyValue("touch-action")).toBe("none");
    expect(handle.getPropertyValue("position")).toBe("absolute");
    expect(handle.getPropertyValue("left")).toBe("0");
    expect(handle.getPropertyValue("min-height")).toBe("var(--app-player-tab-height)");
    expect(handle.getPropertyValue("min-width")).toBe("3rem");
    expect(handle.getPropertyValue("transform")).toBe("translateY(-100%)");
    const tabs = ruleFor(shellCss, ".community-dashboard-template .app-player.audio-player--minimized .audio-player__drag, .community-dashboard-template .app-player.audio-player--minimized .audio-player__minimize, .community-dashboard-template .app-player.audio-player--minimized .player-position-menu__trigger");
    expect(tabs.getPropertyValue("height")).toBe("var(--app-player-tab-height)");
    expect(tabs.getPropertyValue("box-sizing")).toBe("border-box");
    expect(ruleFor(shellCss, ".app-player.audio-player--minimized .audio-player__timeline").getPropertyValue("grid-column")).toBe("1 / -1");
    expect(player.getPropertyValue("width")).toBe("min(24rem, calc(100vw - var(--app-sidebar-width) - 2rem))");
    expect(mediaRuleFor(shellCss, ".community-dashboard-template--player-minimized", desktop).getPropertyValue("--app-player-height").trim()).toBe("0rem");
    const context = ".community-dashboard-template--has-player.community-dashboard-template--messenger.community-dashboard-template--player-docked";
    expect(mediaRuleFor(messengerCss, `${context} .chat-compose`, "(min-width: 761px) and (max-width: 1050px)").getPropertyValue("padding-bottom"))
      .toBe("calc(0.75rem + var(--measured-minimized-player-height, 6rem) + 1rem + var(--app-player-tab-height))");
    expect(mobileRuleFor(shellCss, ".app-player").getPropertyValue("width")).toBe("100%");
    expect(ruleFor(shellCss, ".community-dashboard-template .app-player.audio-player--minimized").getPropertyValue("z-index")).toBe("100");
    const miniSurface = ruleFor(shellCss, ".community-dashboard-template .app-player.audio-player--playable.audio-player--minimized");
    expect(miniSurface.getPropertyValue("--mini-waveform-background").trim()).toBe("var(--audio-player-controller-surface)");
    expect(miniSurface.getPropertyValue("--mini-player-outline").trim()).toBe("color-mix(in srgb, var(--audio-player-controller-surface) 85%, var(--color-blue-500))");
    expect(miniSurface.getPropertyValue("border")).toBe("1px solid var(--mini-player-outline)");
    expect(miniSurface.getPropertyValue("box-shadow").replace(/\s+/g, " ")).toBe("inset 0 0.125rem 0.375rem rgb(0 0 0 / 45%), inset 0 -0.125rem 0.375rem rgb(0 0 0 / 40%), 0 0.125rem 0.375rem rgb(0 0 0 / 45%), 0 0.25rem 0.75rem rgb(0 0 0 / 40%)");
    const miniTimeline = ruleFor(shellCss, ".community-dashboard-template .app-player.audio-player--playable.audio-player--minimized .audio-player__timeline");
    expect(miniTimeline.getPropertyValue("background")).toBe("var(--mini-waveform-background)");
    expect(miniTimeline.getPropertyValue("--audio-inactive").trim()).toBe("color-mix(in srgb, var(--color-neutral-50) 50%, var(--mini-waveform-background))");
    expect(miniTimeline.getPropertyValue("padding")).toBe("0.125rem 0.375rem");
    expect(miniTimeline.getPropertyValue("box-sizing")).toBe("border-box");
    expect(miniTimeline.getPropertyValue("grid-column")).toBe("1 / -1");
    expect(miniTimeline.getPropertyValue("grid-row")).toBe("3");
    expect(miniTimeline.getPropertyValue("margin")).toBe("0 calc(-1 * var(--mini-player-padding-x)) calc(-1 * var(--mini-player-padding-y))");
    expect(ruleFor(shellCss, ".community-dashboard-template .app-player.audio-player--playable.audio-player--minimized .audio-player__waveform").getPropertyValue("max-width")).toBe("100%");
    const waveformOutline = ruleFor(shellCss, ".community-dashboard-template .app-player.audio-player--playable.audio-player--minimized .audio-player__waveform path");
    expect(waveformOutline.getPropertyValue("stroke")).toBe("var(--mini-player-outline)");
    expect(waveformOutline.getPropertyValue("stroke-width")).toBe("1px");
    expect(waveformOutline.getPropertyValue("vector-effect")).toBe("non-scaling-stroke");
    expect(ruleFor(shellCss, ".community-dashboard-template .app-player.audio-player--playable.audio-player--minimized .audio-player__error").getPropertyValue("grid-row")).toBe("2");
    const miniLayout = ruleFor(shellCss, ".community-dashboard-template .app-player.audio-player--minimized");
    expect(miniLayout.getPropertyValue("min-height")).toBe("5.5rem");
    expect(miniLayout.getPropertyValue("--mini-player-padding-x").trim()).toBe("var(--spacing-4)");
    expect(miniLayout.getPropertyValue("--mini-player-padding-y").trim()).toBe("var(--spacing-4)");
    expect(miniLayout.getPropertyValue("padding")).toBe("var(--mini-player-padding-y) var(--mini-player-padding-x)");
    const mobileMiniLayout = mobileRuleFor(shellCss, ".community-dashboard-template .app-player.audio-player--minimized");
    expect(mobileMiniLayout.getPropertyValue("--mini-player-padding-x").trim()).toBe("var(--spacing-3)");
    expect(mobileMiniLayout.getPropertyValue("--mini-player-padding-y").trim()).toBe("var(--spacing-3)");
    expect(ruleFor(shellCss, ".community-dashboard-template .app-player.audio-player--playable.audio-player--minimized .audio-player__minimize").getPropertyValue("box-shadow"))
      .toBe("0 -0.125rem 0.25rem rgb(0 0 0 / 35%)");
  });

  it("docks the desktop mini player below the profile while preserving floating overrides", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const wide = "(min-width: 1051px)";
    const player = mediaRuleFor(css, ".community-dashboard-template .app-player.audio-player--minimized", wide);
    const docked = mediaRuleFor(css, ".community-dashboard-template--player-docked .app-player.audio-player--playable.audio-player--minimized", wide);
    expect(docked.getPropertyValue("width")).toBe("var(--app-sidebar-width)");
    expect(docked.getPropertyValue("left")).toBe("var(--floating-player-left, 0px)");
    expect(docked.getPropertyValue("right")).toBe("var(--floating-player-right, auto)");
    expect(docked.getPropertyValue("bottom")).toBe("var(--floating-player-bottom, 0px)");
    expect(docked.getPropertyValue("border-color")).toBe("transparent");
    expect(docked.getPropertyValue("border-top-color")).toBe("var(--mini-player-outline)");
    expect(docked.getPropertyValue("border-radius")).toBe("0");
    expect(docked.getPropertyValue("box-shadow").replace(/\s+/g, " ")).toBe("inset 0 0.25rem 0.5rem rgb(0 0 0 / 25%), inset 0 -0.25rem 0.5rem rgb(0 0 0 / 25%), 0 -0.25rem 0.5rem rgb(0 0 0 / 25%), 0 0.25rem 0.5rem rgb(0 0 0 / 25%)");
    expect(player.getPropertyValue("grid-template-columns")).toBe("minmax(0, 1fr) 2rem");
    const expand = mediaRuleFor(css, ".community-dashboard-template--player-docked .app-player.audio-player--playable.audio-player--minimized .audio-player__minimize", wide);
    expect(expand.getPropertyValue("position")).toBe("absolute");
    expect(expand.getPropertyValue("transform")).toBe("none");
    expect(expand.getPropertyValue("top")).toBe("-1px");
    expect(expand.getPropertyValue("bottom")).toBe("calc(50% + var(--spacing-1) / 2)");
    expect(expand.getPropertyValue("height")).toBe("auto");
    const menu = mediaRuleFor(css, ".community-dashboard-template--player-docked .app-player.audio-player--playable.audio-player--minimized .player-position-menu", wide);
    expect(menu.getPropertyValue("top")).toBe("calc(50% + var(--spacing-1) / 2)");
    expect(menu.getPropertyValue("bottom")).toBe("-1px");
    const drag = mediaRuleFor(css, ".community-dashboard-template--player-docked .app-player.audio-player--playable.audio-player--minimized .audio-player__drag", wide);
    expect(drag.getPropertyValue("height")).toBe("calc(50% - var(--spacing-1) / 2 + 1px)");
    expect(expand.getPropertyValue("right")).toBe("-2rem");
    expect(expand.getPropertyValue("width")).toBe("2rem");
    expect(expand.getPropertyValue("background")).toBe("var(--audio-player-controller-surface)");
    expect(expand.getPropertyValue("border-radius")).toBe("0 0.375rem 0.375rem 0");
    expect(expand.getPropertyValue("box-shadow")).toBe("inset 0 0.125rem 0.25rem rgb(0 0 0 / 35%)");
    expect(expand.getPropertyValue("isolation")).toBe("isolate");
    const expandShadow = mediaRuleFor(css, ".community-dashboard-template--player-docked .app-player.audio-player--playable.audio-player--minimized .audio-player__minimize::before", wide);
    expect(expandShadow.getPropertyValue("clip-path")).toBe("inset(-3rem -3rem -3rem 0)");
    expect(expandShadow.getPropertyValue("box-shadow")).toBe("none");
    expect(mediaRuleFor(css, ".community-dashboard-template--player-docked .app-player.audio-player--playable.audio-player--minimized .audio-player__timeline", wide).getPropertyValue("border-radius")).toBe("0");
    const sections = mediaRuleFor(css, ".community-dashboard-template--has-player.community-dashboard-template--player-docked .app-sidebar .navigation__sections", wide);
    expect(sections.getPropertyValue("min-height")).toBe("0");
    expect(sections.getPropertyValue("overflow-y")).toBe("auto");
    const profile = mediaRuleFor(css, ".community-dashboard-template--has-player.community-dashboard-template--player-docked .app-sidebar .navigation__footer", wide);
    expect(profile.getPropertyValue("margin-bottom")).toBe("max(0px, calc(var(--measured-minimized-player-height, 6rem) - 1rem))");
    expect(mediaRuleFor(css, ".community-dashboard-template--has-player.community-dashboard-template--player-docked .app-sidebar .navigation__brand, .community-dashboard-template--has-player.community-dashboard-template--player-docked .app-sidebar .navigation__footer", wide).getPropertyValue("flex-shrink")).toBe("0");
    expect(mediaRuleFor(css, ".community-dashboard-template .app-player.audio-player--minimized .now-playing > .badge", wide).getPropertyValue("clip-path")).toBe("inset(50%)");
    expect(ruleFor(css, ".app-player.audio-player--minimized .now-playing__artwork + .now-playing__copy").getPropertyValue("margin-left")).toBe("0.25rem");
  });

  it("makes the reusable player waveform responsive with a desktop width cap", () => {
    const css = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
    const waveform = ruleFor(css, ".audio-player__waveform");
    expect(waveform.getPropertyValue("flex")).toBe("1 1 0");
    expect(waveform.getPropertyValue("width")).toBe("100%");
    expect(waveform.getPropertyValue("min-width")).toBe("0");
    expect(waveform.getPropertyValue("max-width")).toBe("100%");
    expect(mediaRuleFor(css, ".audio-player__waveform", "(min-width: 761px)").getPropertyValue("max-width")).toBe("min(100%, 300px)");
    expect(ruleFor(css, ".audio-player__timeline").getPropertyValue("min-width")).toBe("0");
  });

  it("uses a readable blue playable surface with dark actions and waveform", () => {
    const css = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
    const theme = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
    const style = ruleFor(css, ".organism-card.audio-player--playable");
    expect(style.getPropertyValue("background")).toBe("var(--color-cyan-400)");
    expect(style.getPropertyValue("--text-primary").trim()).toBe("var(--color-neutral-950)");
    expect(style.getPropertyValue("--text-secondary").trim()).toBe("var(--color-neutral-900)");
    expect(style.getPropertyValue("--audio-active").trim()).toBe("var(--color-neutral-950)");
    expect(style.getPropertyValue("--audio-inactive").trim()).toBe("color-mix(in srgb, var(--color-neutral-950) 70%, var(--color-cyan-400))");
    const play = ruleFor(css, ".audio-player--playable .transport-controls .transport-controls__play");
    expect(play.getPropertyValue("background")).toBe("var(--color-neutral-950)");
    expect(play.getPropertyValue("color")).toBe("var(--color-cyan-400)");

    const rgb = (name) => {
      const hex = theme.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6})`, "i"))?.[1];
      if (!hex) throw new Error(`Missing color token ${name}`);
      return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
    };
    const luminance = (color) => color.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const background = rgb("color-cyan-400");
    const dark = rgb("color-neutral-950");
    const contrast = (foreground) => (luminance(background) + 0.05) / (luminance(foreground) + 0.05);
    expect(contrast(dark)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(rgb("color-neutral-900"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.map((value, index) => value * 0.7 + background[index] * 0.3))).toBeGreaterThanOrEqual(3);
    const controller = ruleFor(css, ".organism-card.audio-player--playable.audio-player--controller");
    expect(controller.getPropertyValue("background")).toBe("var(--audio-player-controller-surface)");
    expect(controller.getPropertyValue("--audio-player-controller-surface").trim()).toBe("var(--surface-media-section)");
    expect(controller.getPropertyValue("--text-primary").trim()).toBe("var(--color-neutral-50)");
    expect(controller.getPropertyValue("--text-secondary").trim()).toBe("color-mix(in srgb, var(--color-neutral-50) 75%, var(--audio-player-controller-surface))");
    expect(controller.getPropertyValue("--audio-active").trim()).toBe("var(--color-cyan-400)");
    expect(theme).toMatch(/--audio-active:\s*var\(--color-cyan-400\)/);
    expect(controller.getPropertyValue("--audio-inactive").trim()).toBe("color-mix(in srgb, var(--color-neutral-50) 50%, var(--audio-player-controller-surface))");
    expect(controller.getPropertyValue("--shadow-control-audio").trim()).toBe("var(--shadow-control-blue)");
    expect(controller.getPropertyValue("--shadow-control-audio-hover").trim()).toBe("var(--shadow-control-blue-hover)");
    const footer = ruleFor(readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8"), ".community-dashboard-template .app-player.audio-player--playable");
    expect(footer.getPropertyValue("border")).toBe("0");
    expect(footer.getPropertyValue("box-shadow")).toBe("0 -0.25rem 0.5rem rgb(0 0 0 / 45%), 0 -0.75rem 2rem rgb(0 0 0 / 40%)");
    const expanded = ruleFor(readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8"), ".community-dashboard-template .app-player.audio-player--controller:not(.audio-player--minimized)");
    expect(expanded.getPropertyValue("--audio-player-controller-surface").trim()).toBe("");
    expect(expanded.getPropertyValue("border-top")).toBe("1px solid color-mix(in srgb, var(--color-blue-500) 25%, var(--color-neutral-950))");
    expect(theme).toMatch(/--surface-media-section:\s*color-mix\(in srgb, var\(--color-blue-500\) 10%, var\(--color-neutral-950\)\)/);
    const footerBackground = dark.map((value, index) => value * 0.9 + rgb("color-blue-500")[index] * 0.1);
    const footerContrast = (foreground) => (luminance(foreground) + 0.05) / (luminance(footerBackground) + 0.05);
    const light = rgb("color-neutral-50");
    expect(footerContrast(light)).toBeGreaterThanOrEqual(4.5);
    expect(footerContrast(light.map((value, index) => value * 0.75 + footerBackground[index] * 0.25))).toBeGreaterThanOrEqual(4.5);
    expect(footerContrast(light.map((value, index) => value * 0.5 + footerBackground[index] * 0.5))).toBeGreaterThanOrEqual(3);
    expect(footerContrast(rgb("color-cyan-400"))).toBeGreaterThanOrEqual(3);
    const miniBackground = footerBackground;
    const navCss = readFileSync(resolve("src", "organisms", "MobileNavigation", "MobileNavigation.css"), "utf8");
    expect(ruleFor(navCss, ".mobile-tabs.mobile-navigation").getPropertyValue("--mobile-navigation-active-surface").trim()).toBe("color-mix(in srgb, var(--color-blue-500) 12%, black)");
    const selectedNav = "var(--mobile-navigation-active-surface)";
    expect(ruleFor(navCss, '.mobile-navigation .mobile-navigation__item[aria-current="page"]').getPropertyValue("background")).toBe(selectedNav);
    expect(ruleFor(navCss, '.mobile-navigation .mobile-navigation__item--alist[aria-current="page"], .mobile-navigation .mobile-navigation__item--private[aria-current="page"]').getPropertyValue("background")).toBe(selectedNav);
    expect(ruleFor(navCss, '.mobile-navigation .mobile-navigation__item[aria-current="page"]').getPropertyValue("color")).toBe("var(--color-blue-500)");
    expect(ruleFor(navCss, '.mobile-navigation .mobile-navigation__item--alist[aria-current="page"], .mobile-navigation .mobile-navigation__item--private[aria-current="page"]').getPropertyValue("color")).toBe("var(--color-blue-500)");
    const navBackground = rgb("color-blue-500").map((value) => value * 0.12);
    expect(luminance(navBackground)).toBeLessThan(luminance(footerBackground));
    expect((luminance(rgb("color-blue-500")) + 0.05) / (luminance(navBackground) + 0.05)).toBeGreaterThanOrEqual(4.5);
    const miniTimelineBackground = miniBackground;
    const miniTimelineContrast = (foreground) => (luminance(foreground) + 0.05) / (luminance(miniTimelineBackground) + 0.05);
    expect((luminance(light) + 0.05) / (luminance(miniBackground) + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(miniTimelineContrast(light.map((value, index) => value * 0.75 + miniBackground[index] * 0.25))).toBeGreaterThanOrEqual(4.5);
    expect(miniTimelineContrast(light.map((value, index) => value * 0.5 + miniTimelineBackground[index] * 0.5))).toBeGreaterThanOrEqual(3);
    expect(miniTimelineContrast(rgb("color-cyan-400"))).toBeGreaterThanOrEqual(3);
    const tab = ruleFor(readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8"), ".app-player.audio-player--controller .audio-player__minimize");
    expect(tab.getPropertyValue("background")).toBe("var(--audio-player-controller-surface)");
    expect(tab.getPropertyValue("border")).toBe("0");
    const buttons = ruleFor(readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8"), ".community-dashboard-template .app-player.audio-player--playable .button");
    expect(buttons.getPropertyValue("border")).toBe("0");
    const shellCss = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const footerPlay = ".audio-player--playable.audio-player--controller .transport-controls .transport-controls__play";
    const playStyle = ruleFor(css, `${footerPlay}, ${footerPlay}:hover:not(:disabled)`);
    expect(playStyle.getPropertyValue("background")).toBe("var(--audio-active)");
    expect(playStyle.getPropertyValue("color")).toBe("var(--color-neutral-950)");
    expect(ruleFor(css, `${footerPlay}:hover:not(:disabled)`).getPropertyValue("background")).toBe("color-mix(in srgb, var(--audio-active) 90%, var(--color-neutral-50))");
    const playingHover = rgb("color-cyan-400").map((value, index) => value * 0.9 + light[index] * 0.1);
    expect((luminance(playingHover) + 0.05) / (luminance(dark) + 0.05)).toBeGreaterThanOrEqual(3);
    expect(ruleFor(css, ".audio-player--playable.audio-player--controller .audio-player__volume input").getPropertyValue("accent-color")).toBe("var(--audio-active)");
    expect(ruleFor(css, ".audio-player--playable.audio-player--controller .transport-controls__button.is-active, .audio-player--playable.audio-player--controller .now-playing__artwork--fallback").getPropertyValue("color")).toBe("var(--color-blue-500)");
    const tabHover = ".app-player.audio-player--controller .audio-player__minimize.button--tertiary:not(:disabled):hover";
    expect(ruleFor(shellCss, tabHover).getPropertyValue("background")).toBe("color-mix(in srgb, var(--color-blue-500) 12%, var(--audio-player-controller-surface))");
    expect(mediaRuleFor(shellCss, tabHover, "(max-width: 760px) and (hover: none)").getPropertyValue("background")).toBe("var(--audio-player-controller-surface)");
    const tabHoverBackground = footerBackground.map((value, index) => value * 0.88 + rgb("color-blue-500")[index] * 0.12);
    expect((luminance(light) + 0.05) / (luminance(tabHoverBackground) + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect((luminance(rgb("color-blue-500")) + 0.05) / (luminance(dark) + 0.05)).toBeGreaterThanOrEqual(3);
  });

  it("places the tab above the player and reserves its height in Messenger", () => {
    const shellCss = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const messengerCss = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    const tab = ruleFor(shellCss, ".app-player .audio-player__minimize");
    const height = ruleFor(shellCss, ":root").getPropertyValue("--app-player-tab-height").trim();
    const context = ".community-dashboard-template--has-player.community-dashboard-template--messenger";

    expect(height).toBe("2rem");
    expect(tab.getPropertyValue("position")).toBe("absolute");
    expect(tab.getPropertyValue("top")).toBe("0");
    expect(tab.getPropertyValue("transform")).toBe("translateY(-100%)");
    expect(tab.getPropertyValue("min-height")).toBe("var(--app-player-tab-height)");
    for (const selector of [".chat-compose", ".messenger__sidebar"]) {
      expect(ruleFor(messengerCss, `${context} ${selector}`).getPropertyValue("padding-bottom"))
        .toBe("calc(0.75rem + var(--app-player-tab-height))");
    }
  });

  it("removes the mobile pointer focus outline without suppressing keyboard focus", () => {
    const shellCss = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const buttonCss = readFileSync(resolve("src", "atoms", "Button", "Button.css"), "utf8");
    expect(mobileRuleFor(shellCss, ".app-player .audio-player__minimize:focus:not(:focus-visible)").getPropertyValue("outline")).toBe("none");
    expect(ruleFor(buttonCss, ".button:focus-visible").getPropertyValue("outline")).toBe("var(--focus-outline-width) solid var(--focus-ring)");
    expect(mediaRuleFor(shellCss, ".app-player .audio-player__minimize.button--tertiary:not(:disabled):hover", "(max-width: 760px) and (hover: none)").getPropertyValue("background"))
      .toBe(ruleFor(shellCss, ".app-player .audio-player__minimize").getPropertyValue("background"));
  });

  it("floats the mobile minimized player and keeps content and messenger controls accessible", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const messengerCss = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    const minimized = mobileRuleFor(css, ".community-dashboard-template--player-minimized");
    const player = mobileRuleFor(css, ".community-dashboard-template .app-player.audio-player--minimized");
    const context = ".community-dashboard-template--has-player.community-dashboard-template--messenger.community-dashboard-template--player-docked";
    expect(minimized.getPropertyValue("--app-player-height").trim()).toBe("0rem");
    expect(minimized.getPropertyValue("--mobile-floating-player-clearance").trim()).toBe("calc(var(--measured-minimized-player-height, 4rem) + 1rem + var(--app-player-tab-height))");
    expect(player.getPropertyValue("bottom")).toBe("var(--floating-player-bottom, calc(var(--mobile-navigation-height) + 1rem))");
    expect(player.getPropertyValue("left")).toBe("var(--floating-player-left, auto)");
    expect(player.getPropertyValue("right")).toBe("var(--floating-player-right, 1rem)");
    expect(player.getPropertyValue("top")).toBe("var(--floating-player-top, auto)");
    expect(minimized.getPropertyValue("--mobile-floating-player-width").trim()).toBe("min(14rem, calc(100vw - 2rem))");
    expect(player.getPropertyValue("min-height")).toBe("5rem");
    expect(player.getPropertyValue("width")).toBe("var(--mobile-floating-player-width)");
    expect(player.getPropertyValue("grid-template-columns")).toBe("minmax(0, 1fr) 2rem");
    expect(mobileRuleFor(css, ".community-dashboard-template--has-player.community-dashboard-template--player-minimized:not(.community-dashboard-template--messenger) .app-content").getPropertyValue("padding-bottom"))
      .toBe("calc(2rem + var(--mobile-floating-player-clearance))");
    expect(mobileRuleFor(messengerCss, `${context} .share-a-dub`).getPropertyValue("min-height")).toBe("var(--mobile-floating-player-clearance)");
    expect(mobileRuleFor(messengerCss, `${context} .share-a-dub`).getPropertyValue("padding")).toBe("0.5rem calc(var(--mobile-floating-player-width) + 1rem) 0.5rem 0.75rem");
    expect(mobileRuleFor(messengerCss, `${context} .messenger__sidebar`).getPropertyValue("padding-bottom")).toBe("calc(0.75rem + var(--mobile-floating-player-clearance))");
  });

  it("extends the scroll viewport behind the footer tab without hiding the end of the content", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const context = ".community-dashboard-template--has-player:not(.community-dashboard-template--messenger)";
    expect(ruleFor(css, `${context} .dashboard-template__body`).getPropertyValue("margin-bottom"))
      .toBe("calc(-1 * var(--app-player-tab-height))");
    expect(ruleFor(css, `${context} .app-content`).getPropertyValue("padding-bottom"))
      .toBe("calc(2rem + var(--app-player-tab-height))");
  });

  it("keeps the mobile message input compact", () => {
    const css = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    expect(ruleFor(css, ".messenger__sidebar-head, .chat-panel__header").getPropertyValue("background")).toBe("var(--surface-canvas)");
    const input = mobileRuleFor(css, ".chat-compose input");
    expect(input.getPropertyValue("font-size")).toBe("var(--type-size-body)");
    expect(input.getPropertyValue("min-height")).toBe("2.5rem");
    expect(input.getPropertyValue("padding")).toBe("0.375rem 0.625rem");
    const messages = mobileRuleFor(css, ".chat-message");
    expect(messages.getPropertyValue("margin")).toBe("0 0.75rem");
    expect(messages.getPropertyValue("max-width")).toBe("calc(100% - 1.5rem)");
  });

  it("uses the control surface for shared dub messages without changing text bubbles", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    expect(ruleFor(css, ".shared-dub-message").getPropertyValue("background")).toBe("var(--surface-control)");
    expect(ruleFor(css, ".shared-dub__player").getPropertyValue("background")).toBe("transparent");
    expect(ruleFor(css, ".chat-message__content > p").getPropertyValue("background")).toBe("var(--surface-control)");
  });

  it("uses full-width square conversation rows on mobile", () => {
    const css = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    const sidebar = mobileRuleFor(css, ".messenger__sidebar");
    const row = mobileRuleFor(css, ".conversation-link");
    expect(sidebar.getPropertyValue("padding")).toBe("0");
    expect(row.getPropertyValue("border-radius")).toBe("0");
    expect(ruleFor(readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8"), ".conversation-link").getPropertyValue("width")).toBe("100%");
  });

  it("places the mobile share control below the input and above the floating player", () => {
    const css = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    expect(mobileRuleFor(css, ".chat-compose").getPropertyValue("grid-row")).toBe("3");
    expect(mobileRuleFor(css, ".share-a-dub").getPropertyValue("grid-row")).toBe("4");
    const expanded = ".community-dashboard-template--has-player.community-dashboard-template--messenger";
    expect(mobileRuleFor(css, `${expanded} .share-a-dub`).getPropertyValue("padding-bottom")).toBe("calc(0.5rem + var(--app-player-tab-height))");
    const context = ".community-dashboard-template--has-player.community-dashboard-template--messenger.community-dashboard-template--player-docked";
    expect(mobileRuleFor(css, `${context} .share-a-dub`).getPropertyValue("min-height")).toBe("var(--mobile-floating-player-clearance)");
    const moved = ".community-dashboard-template--has-player.community-dashboard-template--messenger.community-dashboard-template--player-minimized";
    expect(mobileRuleFor(css, `${moved} .share-a-dub`).getPropertyValue("padding")).toBe("0.5rem 0.75rem");
    expect(ruleFor(css, ".shared-dub__player.audio-player--inline .audio-player__timeline").getPropertyValue("grid-column"))
      .toBe("2 / -1");
    expect(ruleFor(css, ".shared-dub__metadata").getPropertyValue("flex")).toBe("1");
  });

  it("stacks a compact identity and adaptable waveform between mobile controls", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const prefix = ".app-player.audio-player--minimized";
    expect(mobileRuleFor(css, `${prefix} .now-playing__copy`).getPropertyValue("flex-direction")).toBe("column");
    const text = mobileRuleFor(css, `${prefix} .now-playing__title, ${prefix} .now-playing__artist`);
    expect(text.getPropertyValue("text-overflow")).toBe("ellipsis");
    expect(text.getPropertyValue("white-space")).toBe("nowrap");
    expect(mobileRuleFor(css, `${prefix} .now-playing__artwork`).getPropertyValue("width")).toBe("1.75rem");
    expect(mobileRuleFor(css, `${prefix} .now-playing__artwork--custom > *`).getPropertyValue("width")).toBe("100%");
    expect(mobileRuleFor(css, `${prefix} .transport-controls__play`).getPropertyValue("width")).toBe("2rem");
    expect(mobileRuleFor(css, `${prefix} .audio-player__waveform`).getPropertyValue("max-width")).toBe("100%");
    expect(mobileRuleFor(css, `${prefix} .audio-player__time`).getPropertyValue("display")).toBe("none");
  });
});
