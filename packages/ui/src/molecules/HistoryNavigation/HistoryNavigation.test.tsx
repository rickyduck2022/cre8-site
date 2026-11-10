import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { HistoryNavigation } from "./HistoryNavigation";

afterEach(cleanup);

it("offers accessible history controls with their availability", () => {
  const back = vi.fn();
  const { rerender } = render(<HistoryNavigation canGoBack={false} onBack={back} />);
  expect(screen.getByRole("navigation", { name: "Page history" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Go back" })).toHaveClass("edge-tab");
  expect(screen.queryByRole("button", { name: "Go forward" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Go back" })).toBeDisabled();
  rerender(<HistoryNavigation canGoBack onBack={back} />);
  fireEvent.click(screen.getByRole("button", { name: "Go back" }));
  expect(back).toHaveBeenCalledOnce();
});

it("keeps the tab background solid when disabled", () => {
  const css = readFileSync(resolve("src", "molecules", "HistoryNavigation", "HistoryNavigation.css"), "utf8");
  expect(css).toContain("color: var(--text-secondary)");
  expect(css).toContain("align-self: stretch;");
  expect(css).toContain("padding-inline: var(--spacing-xl);");
  expect(css).toContain("border: 0;");
  expect(css).toContain("background: var(--surface-canvas);");
  expect(css).not.toContain("opacity:");
});
