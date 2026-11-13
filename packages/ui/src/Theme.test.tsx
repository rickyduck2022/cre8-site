import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPortal } from "react-dom";
import { ThemeProvider, initializeTheme } from "./foundations/Theme";
import { ThemeToggle } from "./molecules/ThemeToggle/ThemeToggle";
import { AppHeader } from "./organisms/AppHeader/AppHeader";

beforeEach(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { entries.set(key, value); }),
  });
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("defaults to dark and persists the header switch across remounts", () => {
  const view = render(<ThemeProvider><AppHeader /></ThemeProvider>);
  const toggle = screen.getByRole("button", { name: "Light theme" });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(window.localStorage.getItem("cre8:theme")).toBe("light");
  view.unmount();
  render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  fireEvent.click(screen.getByRole("button", { name: "Light theme" }));
  expect(window.localStorage.getItem("cre8:theme")).toBe("dark");
});

it("initializes before render, syncs tabs, and keeps portal controls in the same theme", () => {
  window.localStorage.setItem("cre8:theme", "light");
  expect(initializeTheme()).toBe("light");
  render(<ThemeProvider>{createPortal(<ThemeToggle />, document.body)}</ThemeProvider>);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "cre8:theme", newValue: "dark" })));
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "false");
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "cre8:theme", newValue: "light" })));
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
});

it("changes theme but reports when persistence is unavailable", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  vi.mocked(window.localStorage.setItem).mockImplementation(() => { throw new Error("Blocked"); });
  fireEvent.click(screen.getByRole("button", { name: "Light theme" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  expect(screen.getByRole("alert")).toHaveTextContent("could not save");
  expect(log).toHaveBeenCalled();
});

it("offers the same setting through the keyboard-accessible account menu", () => {
  render(<ThemeProvider><AppHeader userName="Artist" onEditProfile={vi.fn()} onLogout={vi.fn()} /></ThemeProvider>);
  const trigger = screen.getByRole("button", { name: "Account menu for Artist" });
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const item = screen.getByRole("menuitemcheckbox", { name: "Light theme (off)" });
  expect(item).toHaveFocus();
  fireEvent.click(item);
  expect(item).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.keyDown(item, { key: "ArrowDown" });
  expect(screen.getByRole("menuitem", { name: "Edit profile" })).toHaveFocus();
  fireEvent.keyDown(item, { key: "Escape" });
  expect(trigger).toHaveFocus();
});

it("keeps dark as the safe default if reading preferences is blocked", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(window.localStorage.getItem).mockImplementation(() => { throw new Error("Blocked"); });
  expect(initializeTheme()).toBe("dark");
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(log).toHaveBeenCalled();
});
