import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function shadowFor(path, selector) {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", ...path), "utf8");
  document.head.append(style);
  try {
    const rule = Array.from(style.sheet.cssRules).find(
      (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === selector,
    );
    if (!rule) throw new Error(`Missing CSS rule: ${selector}`);
    return rule.style.getPropertyValue("box-shadow");
  } finally {
    style.remove();
  }
}

describe("surface elevation", () => {
  it.each([
    [["organisms", "Organisms.css"], ".organism-card", "var(--shadow-card)"],
    [["organisms", "Organisms.css"], ".modal__surface", "var(--shadow-floating)"],
    [["organisms", "DubCard", "DubCard.css"], ".dub-card", "var(--shadow-card)"],
    [["organisms", "DubCard", "DubCard.css"], ".dub-card .organism-card.audio-player", "var(--shadow-media-inset)"],
    [["templates", "CommunityPageTemplates.css"], ".shared-dub-message", "var(--shadow-card)"],
    [["templates", "CommunityPageTemplates.css"], ".share-a-dub__popover", "var(--shadow-floating)"],
    [["molecules", "Molecules.css"], ".account-menu__popover", "var(--shadow-floating)"],
    [["molecules", "DubActionsMenu", "DubActionsMenu.css"], ".dub-actions-menu__popover", "var(--shadow-floating)"],
    [["organisms", "NotificationCenter", "NotificationCenter.css"], ".notification-center__panel", "var(--shadow-floating)"],
    [["organisms", "ShareDubDialog", "ShareDubDialog.css"], ".share-dub-dialog__track", "var(--shadow-media-inset)"],
    [["atoms", "Button", "Button.css"], ".button--primary", "var(--shadow-control-accent)"],
    [["atoms", "Button", "Button.css"], ".button--primary:not(:disabled):hover", "var(--shadow-control-accent-hover)"],
    [["atoms", "Button", "Button.css"], ".button--secondary", "var(--shadow-control)"],
    [["atoms", "Action", "Action.css"], ".action", "var(--shadow-control)"],
    [["atoms", "Action", "Action.css"], ".action--primary", "var(--shadow-control-accent)"],
    [["atoms", "Action", "Action.css"], ".action--audio", "var(--shadow-control-audio)"],
    [["atoms", "Action", "Action.css"], ".action--audio:hover:not(:disabled)", "var(--shadow-control-audio-hover)"],
    [["atoms", "TrackTag", "TrackTag.css"], ".track-tag", "var(--shadow-tag)"],
    [["atoms", "TrackTag", "TrackTag.css"], ".track-tag--accent", "var(--shadow-control-accent)"],
    [["atoms", "TrackTag", "TrackTag.css"], ".track-tag--audio", "var(--shadow-control-audio)"],
    [["atoms", "TrackTag", "TrackTag.css"], ".track-tag--audio:hover", "var(--shadow-control-audio-hover)"],
    [["atoms", "Badge", "Badge.css"], ".badge--audio", "var(--shadow-control-audio)"],
    [["atoms", "Badge", "Badge.css"], ".badge--accent", "var(--shadow-control-accent)"],
    [["atoms", "FilterTab", "FilterTab.css"], ".filter-tab--active", "var(--shadow-control-accent)"],
    [["organisms", "DubSearch", "DubSearch.css"], ".dub-search__distribution:has(input:checked)", "var(--shadow-control-accent)"],
    [["molecules", "FriendPicker", "FriendPicker.css"], ".friend-picker__friend:has(input:checked)", "var(--shadow-control-accent)"],
    [["molecules", "Molecules.css"], ".search-field", "var(--shadow-input)"],
    [["molecules", "Molecules.css"], ".crate-form__field input", "var(--shadow-input)"],
    [["molecules", "Molecules.css"], ".artist-registration-form__field input", "var(--shadow-input)"],
    [["molecules", "Molecules.css"], ".pagination__page-size select", "var(--shadow-input)"],
    [["templates", "CommunityPageTemplates.css"], ".chat-compose input", "var(--shadow-input)"],
    [["organisms", "ShareDubDialog", "ShareDubDialog.css"], ".share-dub-dialog__message textarea", "var(--shadow-input)"],
  ])("applies the appropriate shadow to %s %s", (path, selector, shadow) => {
    expect(shadowFor(path, selector)).toBe(shadow);
  });

  it("defines the shared elevation tokens", () => {
    const theme = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
    for (const token of ["glow-amber", "glow-teal", "glow-navy", "shadow-card", "shadow-media-inset", "shadow-floating", "shadow-control", "shadow-control-accent", "shadow-control-accent-hover", "shadow-control-audio", "shadow-control-audio-hover", "shadow-control-blue", "shadow-input", "shadow-tag"]) {
      expect(theme).toMatch(new RegExp(`--${token}:\\s*[^;]+;`));
    }
    expect(theme).toMatch(/--shadow-media-inset:\s*inset 0 0\.125rem 0\.5rem rgb\(0 0 0 \/ 35%\), 0 0 0\.625rem #242d3c;/);
  });
});
