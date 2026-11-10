import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("uses the inverse palette for notification toasts and controls", () => {
  const css = readFileSync(resolve("src", "molecules", "NotificationToast", "NotificationToast.css"), "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  try {
    const rule = (selector) => {
      const found = Array.from(style.sheet?.cssRules ?? []).find(
        (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText.replace(/\s+/g, " ") === selector,
      );
      if (!found) throw new Error(`Missing CSS rule: ${selector}`);
      return found.style;
    };
    expect(rule(".notification-toast").getPropertyValue("background")).toBe("var(--surface-inverse)");
    expect(rule(".notification-toast").getPropertyValue("border")).toContain("var(--border-inverse)");
    expect(rule(".notification-toast").getPropertyValue("color")).toBe("var(--text-inverse)");
    expect(rule(".notification-toast").getPropertyValue("box-shadow")).toContain("0.75rem 2rem");
    expect(rule(".notification-toast__marker").getPropertyValue("background")).toBe("var(--audio-inverse-active)");
    expect(rule(".notification-toast--error .notification-toast__marker").getPropertyValue("background")).toBe("var(--status-inverse-error)");
    expect(rule(".notification-toast__dismiss").getPropertyValue("color")).toBe("var(--text-inverse-secondary)");
    expect(rule(".notification-toast__dismiss:hover, .notification-toast__dismiss:focus-visible").getPropertyValue("outline")).toContain("var(--audio-inverse-active)");
  } finally {
    style.remove();
  }
});
