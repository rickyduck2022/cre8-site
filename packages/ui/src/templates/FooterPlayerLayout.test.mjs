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
  it("keeps the expanded empty player aligned with the reserved footer space", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const player = ruleFor(css, ".community-dashboard-template .app-player.audio-player--empty:not(.audio-player--minimized)");
    expect(player.getPropertyValue("box-sizing")).toBe("border-box");
    expect(player.getPropertyValue("min-height")).toBe("var(--app-player-height)");
    const organismCss = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
    expect(ruleFor(organismCss, ".audio-player__empty-state").getPropertyValue("grid-column")).toBe("1 / -1");
  });

  it("floats the minimized desktop player without reserving the footer and keeps the message composer accessible", () => {
    const shellCss = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const messengerCss = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    const desktop = "(min-width: 761px)";
    const player = mediaRuleFor(shellCss, ".community-dashboard-template .app-player.audio-player--minimized", desktop);
    expect(player.getPropertyValue("bottom")).toBe("1rem");
    expect(player.getPropertyValue("right")).toBe("1rem");
    expect(player.getPropertyValue("left")).toBe("auto");
    expect(player.getPropertyValue("width")).toBe("min(22rem, calc(100vw - var(--app-sidebar-width) - 2rem))");
    expect(mediaRuleFor(shellCss, ".community-dashboard-template--player-minimized", desktop).getPropertyValue("--app-player-height").trim()).toBe("0rem");
    const context = ".community-dashboard-template--has-player.community-dashboard-template--messenger.community-dashboard-template--player-minimized";
    expect(mediaRuleFor(messengerCss, `${context} .chat-compose`, desktop).getPropertyValue("padding-bottom"))
      .toBe("calc(0.75rem + 5.5rem + var(--app-player-tab-height))");
    expect(mobileRuleFor(shellCss, ".app-player").getPropertyValue("width")).toBe("100%");
  });

  it("places the tab above the player and reserves its height in minimized Messenger", () => {
    const shellCss = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const messengerCss = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    const tab = ruleFor(shellCss, ".app-player .audio-player__minimize");
    const height = ruleFor(shellCss, ":root").getPropertyValue("--app-player-tab-height").trim();
    const context = ".community-dashboard-template--has-player.community-dashboard-template--messenger.community-dashboard-template--player-minimized";

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

  it("uses full-width square conversation rows on mobile", () => {
    const css = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    const sidebar = mobileRuleFor(css, ".messenger__sidebar");
    const row = mobileRuleFor(css, ".conversation-link");
    expect(sidebar.getPropertyValue("padding")).toBe("0");
    expect(row.getPropertyValue("border-radius")).toBe("0");
    expect(ruleFor(readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8"), ".conversation-link").getPropertyValue("width")).toBe("100%");
  });

  it("places the mobile share control below the input while reserving the player tab space below it", () => {
    const css = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    expect(mobileRuleFor(css, ".chat-compose").getPropertyValue("grid-row")).toBe("3");
    expect(mobileRuleFor(css, ".share-a-dub").getPropertyValue("grid-row")).toBe("4");
    expect(mobileRuleFor(css, ".share-a-dub__trigger").getPropertyValue("padding")).toBe("0.25rem 0.75rem");
    const context = ".community-dashboard-template--has-player.community-dashboard-template--messenger.community-dashboard-template--player-minimized";
    expect(mobileRuleFor(css, `${context} .share-a-dub`).getPropertyValue("padding-bottom")).toBe("0");
    expect(mobileRuleFor(css, `${context} .share-a-dub__trigger`).getPropertyValue("min-height"))
      .toBe("calc(1.5em + 0.5rem + var(--app-player-tab-height))");
    expect(ruleFor(css, ".shared-dub__player.audio-player--inline .audio-player__timeline").getPropertyValue("grid-column"))
      .toBe("2 / -1");
    expect(ruleFor(css, ".shared-dub__metadata").getPropertyValue("flex")).toBe("1");
  });

  it("uses a compact inline identity only in the minimized mobile player", () => {
    const css = readFileSync(resolve("src", "templates", "CommunityPageTemplates.css"), "utf8");
    const prefix = ".app-player.audio-player--minimized";
    expect(mobileRuleFor(css, `${prefix} .now-playing__copy`).getPropertyValue("flex-direction")).toBe("row");
    const text = mobileRuleFor(css, `${prefix} .now-playing__title, ${prefix} .now-playing__artist`);
    expect(text.getPropertyValue("text-overflow")).toBe("ellipsis");
    expect(text.getPropertyValue("white-space")).toBe("nowrap");
    expect(mobileRuleFor(css, `${prefix} .now-playing__artwork`).getPropertyValue("width")).toBe("2rem");
    expect(mobileRuleFor(css, `${prefix} .now-playing__artwork--custom > *`).getPropertyValue("width")).toBe("100%");
    expect(mobileRuleFor(css, `${prefix} .transport-controls__play`).getPropertyValue("width")).toBe("1.75rem");
  });
});
