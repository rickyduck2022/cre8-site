import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyDubSearchFilters, DubSearch } from "../../organisms/DubSearch/DubSearch";
import { DubSearchToolbar } from "./DubSearchToolbar";

afterEach(cleanup);

describe("DubSearchToolbar", () => {
  it("toggles the mobile controls without losing their state", () => {
    const { container, rerender } = render(<DubSearchToolbar query="Jungle">{() => <input aria-label="Search" defaultValue="Jungle" />}</DubSearchToolbar>);
    const input = screen.getByRole("textbox", { name: "Search" });
    const toggle = screen.getByRole("button", { name: "Minimize search controls", hidden: true });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(container.querySelector(".dub-search-toolbar")).toHaveClass("dub-search-toolbar--minimized");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-label", "Expand search controls");
    expect(input).toHaveValue("Jungle");
    rerender(<DubSearchToolbar query="">{() => <input aria-label="Search" defaultValue="Jungle" />}</DubSearchToolbar>);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveValue("Jungle");
  });

  it("aligns the sticky toolbar after a search or applied filters, not while editing drafts", () => {
    const onFiltersChange = vi.fn();
    const { container } = render(
      <div className="scroll-viewport">
        <div className="library-template">
          <DubSearchToolbar query="">
            {(onSearch) => <DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={onFiltersChange} onSearch={onSearch} resultCount={0} />}
          </DubSearchToolbar>
          <div className="empty-state">No results</div>
        </div>
      </div>,
    );
    const viewport = container.querySelector<HTMLElement>(".scroll-viewport")!;
    const toolbar = container.querySelector<HTMLElement>(".dub-search-toolbar")!;
    const collection = container.querySelector<HTMLElement>(".library-template")!;
    Object.defineProperty(viewport, "clientHeight", { value: 600 });
    Object.defineProperty(toolbar, "offsetHeight", { value: 100 });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ top: 50 } as DOMRect);
    vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue({ top: 250 } as DOMRect);

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Private" }));
    expect(viewport.scrollTop).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onFiltersChange).toHaveBeenCalledOnce();
    expect(viewport.scrollTop).toBe(200);
    expect(collection.style.getPropertyValue("--dub-search-results-min-height")).toBe("500px");
    viewport.scrollTop = 0;
    fireEvent.change(screen.getByRole("searchbox", { name: /Search tracks/ }), { target: { value: "jungle" } });
    expect(viewport.scrollTop).toBe(200);
  });

  it("aligns the toolbar when the shared query changes outside the collection", () => {
    const renderToolbar = (query: string) => (
      <div className="scroll-viewport"><div className="library-template">
        <DubSearchToolbar query={query}>{() => <span>Search controls</span>}</DubSearchToolbar>
      </div></div>
    );
    const { container, rerender } = render(renderToolbar(""));
    const viewport = container.querySelector<HTMLElement>(".scroll-viewport")!;
    const toolbar = container.querySelector<HTMLElement>(".dub-search-toolbar")!;
    Object.defineProperty(viewport, "clientHeight", { value: 600 });
    Object.defineProperty(toolbar, "offsetHeight", { value: 100 });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ top: 50 } as DOMRect);
    vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue({ top: 250 } as DOMRect);
    expect(viewport.scrollTop).toBe(0);
    rerender(renderToolbar("jungle"));
    expect(viewport.scrollTop).toBe(200);
  });

  it("sticks at all sizes and hides controls only at mobile sizes", () => {
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
      const minimized = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-search-toolbar--minimized .feed-toolbar") as CSSStyleRule;
      const compactInput = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-search-toolbar--minimized .search-field") as CSSStyleRule;
      const compactButton = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-search-toolbar--minimized .dub-search__toggle") as CSSStyleRule;
      const layouts = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText.includes(".latest-dubs-template,") && rule.selectorText.includes(".library-template")) as CSSStyleRule;
      const base = Array.from(style.sheet?.cssRules ?? []).find(
        (rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-search-toolbar",
      ) as CSSStyleRule;
      expect(base.style.getPropertyValue("position")).toBe("sticky");
      expect(base.style.getPropertyValue("top")).toBe("0");
      expect(base.style.getPropertyValue("box-shadow")).toBe("");
      expect(toolbar.style.getPropertyValue("box-shadow")).toBe("0 0.25rem 0.5rem rgb(0 0 0 / 45%), 0 0.75rem 2rem rgb(0 0 0 / 40%)");
      expect(toggle.style.getPropertyValue("position")).toBe("absolute");
      const tabCss = readFileSync(resolve("src", "atoms", "EdgeTab", "EdgeTab.css"), "utf8");
      expect(tabCss).toContain("background: var(--surface-canvas)");
      expect(tabCss).toContain("border: 1px solid var(--border-default)");
      expect(tabCss).toContain("border-radius: 0 0 0.5rem 0.5rem");
      expect(toolbar.style.getPropertyValue("margin-bottom")).toBe("0");
      expect(layouts.style.getPropertyValue("row-gap")).toBe("0");
      expect(toolbar.style.getPropertyValue("margin-left")).toBe("calc(-1 * var(--app-content-inline-padding, 1rem))");
      expect(minimized.style.getPropertyValue("display")).toBe("none");
      expect(compactInput.style.getPropertyValue("min-height")).toBe("2rem");
      expect(compactButton.style.getPropertyValue("min-height")).toBe("2rem");
      const intro = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText.includes(".latest-dubs-template:has(> .dub-search-toolbar--minimized) > .page-intro")) as CSSStyleRule;
      expect(intro.selectorText).toContain(".latest-dubs-template__title");
      expect(intro.selectorText).toContain(".latest-dubs-template__priority");
      expect(intro.selectorText).toContain(".library-template:has(> .dub-search-toolbar--minimized) > .page-intro");
      expect(intro.style.getPropertyValue("position")).toBe("absolute");
      expect(intro.style.getPropertyValue("clip-path")).toBe("inset(50%)");
      expect(tabCss).toContain(".button.edge-tab:focus:not(:focus-visible)");
      expect(tabCss).toContain(".button.edge-tab:not(:disabled):hover");
    } finally {
      style.remove();
    }
  });
});
