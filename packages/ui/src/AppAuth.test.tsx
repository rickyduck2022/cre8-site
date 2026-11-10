import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/app/App";

const mocks = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn() }));
vi.mock("../../../apps/web/src/hooks/useCommunity", () => ({
  useCommunity: () => ({
    loading: false,
    login: mocks.login,
    registerArtist: mocks.register,
    unreadCount: 0,
    state: { member: null, dubs: [], sharedDubIds: new Set(), suggestedMembers: [], buddies: [] },
  }),
}));
vi.mock("../../../apps/web/src/hooks/useDubSearch", () => ({ useDubSearch: () => ({ results: [] }) }));
vi.mock("../../../apps/web/src/hooks/useMemberSearch", () => ({ useMemberSearch: () => ({ members: [], isSearching: false }) }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("authentication screens", () => {
  it("keeps sign-in and registration flows working in the same full-screen shell", async () => {
    mocks.login.mockResolvedValue(undefined);
    mocks.register.mockResolvedValue(undefined);
    render(<App />);
    expect(screen.getByRole("main")).toHaveClass("app-login--auth");
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "amber" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith("amber", "password"));
    fireEvent.click(screen.getByRole("button", { name: "Sign up as an artist" }));
    expect(screen.getByRole("main")).toHaveClass("app-login--auth");
    fireEvent.change(screen.getByLabelText("Artist"), { target: { value: "Amber" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create artist account" }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith({ displayName: "Amber", password: "long-password" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByLabelText("Username")).toHaveValue("amber");
  });

  it("uses a full-height borderless mobile surface and preserves the desktop card", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(resolve("..", "..", "apps", "web", "src", "app", "App.css"), "utf8");
    document.head.append(style);
    try {
      const rules = Array.from(style.sheet?.cssRules ?? []);
      const desktop = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".app-login__card") as CSSStyleRule;
      const mobile = rules.find((rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px)") as CSSMediaRule;
      const card = Array.from(mobile.cssRules).find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".app-login--auth .app-login__card") as CSSStyleRule;
      const shell = Array.from(mobile.cssRules).find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".app-login--auth") as CSSStyleRule;
      expect(desktop.style.getPropertyValue("max-width")).toBe("24rem");
      expect(desktop.style.getPropertyValue("border-radius")).toBe("1rem");
      expect(shell.style.getPropertyValue("min-height")).toBe("100dvh");
      expect(card.style.getPropertyValue("min-height")).toBe("100dvh");
      expect(card.style.getPropertyValue("border")).toBe("0");
      expect(card.style.getPropertyValue("border-radius")).toBe("0");
      expect(card.style.getPropertyValue("max-width")).toBe("none");
      expect(card.style.getPropertyValue("padding")).toContain("safe-area-inset-bottom");
    } finally {
      style.remove();
    }
  });
});
