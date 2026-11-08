import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DubSearchToolbar } from "./DubSearchToolbar";

afterEach(cleanup);

describe("DubSearchToolbar", () => {
  it("toggles the mobile controls without losing their state", () => {
    const { container, rerender } = render(<DubSearchToolbar query="Jungle" filterCount={1}><input aria-label="Search" defaultValue="Jungle" /></DubSearchToolbar>);
    const input = screen.getByRole("textbox", { name: "Search" });
    const toggle = screen.getByRole("button", { name: "Minimize search controls", hidden: true });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(container.querySelector(".dub-search-toolbar")).toHaveClass("dub-search-toolbar--minimized");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-label", "Expand search controls");
    expect(input).toHaveValue("Jungle");
    expect(screen.getByText("Search: Jungle")).toBeInTheDocument();
    expect(screen.getByText("1 filter active")).toBeInTheDocument();
    rerender(<DubSearchToolbar query="" filterCount={0}><input aria-label="Search" defaultValue="Jungle" /></DubSearchToolbar>);
    expect(screen.getByText("Search: All dubs")).toBeInTheDocument();
    expect(screen.getByText("0 filters active")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveValue("Jungle");
  });

  it("sticks and hides controls only at mobile sizes", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(resolve("src", "templates", "shared", "DubSearchToolbar.css"), "utf8");
    document.head.append(style);
    try {
      const mobile = Array.from(style.sheet?.cssRules ?? []).find(
        (rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px)",
      ) as CSSMediaRule;
      const rules = Array.from(mobile.cssRules);
      const toolbar = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-search-toolbar") as CSSStyleRule;
      const toggle = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-search-toolbar__toggle") as CSSStyleRule;
      const minimized = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText.includes(".dub-search-toolbar--minimized .dub-search__row")) as CSSStyleRule;
      const layouts = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText.includes(".latest-dubs-template,") && rule.selectorText.includes(".library-template")) as CSSStyleRule;
      expect(toolbar.style.getPropertyValue("position")).toBe("sticky");
      expect(toolbar.style.getPropertyValue("top")).toBe("0");
      expect(toggle.style.getPropertyValue("background")).toBe(toolbar.style.getPropertyValue("background"));
      expect(toolbar.style.getPropertyValue("margin-bottom")).toBe("0");
      expect(layouts.style.getPropertyValue("row-gap")).toBe("0");
      expect(toolbar.style.getPropertyValue("margin-left")).toBe("calc(-1 * var(--app-content-inline-padding, 1rem))");
      expect(minimized.style.getPropertyValue("display")).toBe("none");
    } finally {
      style.remove();
    }
  });
});
