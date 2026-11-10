import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoModeNotice } from "../../../apps/web/src/components/DemoModeNotice";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("persists dismissal across remounts", () => {
  const { unmount } = render(<DemoModeNotice />);
  expect(screen.getByRole("note")).toHaveTextContent("Local backend");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss local backend notice" }));
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
  expect(window.localStorage.getItem("cre8:local-backend-notice-dismissed")).toBe("true");
  unmount();
  render(<DemoModeNotice />);
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
});

it("reports storage failure and leaves the notice available to retry", () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); });
  render(<DemoModeNotice />);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss local backend notice" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to save your preference");
  expect(screen.getByRole("note")).toBeInTheDocument();
  expect(warning).toHaveBeenCalled();
});
