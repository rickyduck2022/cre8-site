import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LatestDubsTemplate } from "../LatestDubsTemplate/LatestDubsTemplate";
import { LibraryTemplate } from "../LibraryTemplate/LibraryTemplate";
import { SharedWithMeTemplate } from "../SharedWithMeTemplate/SharedWithMeTemplate";
import { createEmptyDubSearchFilters } from "../../organisms/DubSearch/DubSearch";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function ControlledFeed() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(createEmptyDubSearchFilters);
  return <LatestDubsTemplate dubs={[]} likedDubIds={new Set()} nowPlayingId={null} isPlaying={false} onDownload={vi.fn()} onOpenProfile={vi.fn()} onPlay={vi.fn()} query={query} onQueryChange={setQuery} filters={filters} onFiltersChange={setFilters} />;
}

const collections = [
  { name: "feed", title: "Dub Vault", element: <ControlledFeed /> },
  { name: "library", title: "My Library", element: <LibraryTemplate downloads={[]} onDownload={vi.fn()} onPlay={vi.fn()} /> },
  { name: "shared dubs", title: "Shared With Me", element: <SharedWithMeTemplate dubs={[]} onDownload={vi.fn()} onPlay={vi.fn()} /> },
];

describe.each(collections)("$name search positioning", ({ element, title }) => {
  it.each([false, true])("aligns after query and filter searches (mobile: %s)", (mobile) => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const { container } = render(<div className="scroll-viewport">{element}</div>);
    const viewport = container.querySelector<HTMLElement>(".scroll-viewport")!;
    const toolbar = container.querySelector<HTMLElement>(".dub-search-toolbar")!;
    Object.defineProperty(viewport, "clientHeight", { value: 600 });
    Object.defineProperty(toolbar, "offsetHeight", { value: 100 });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ top: 50 } as DOMRect);
    vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue({ top: 250 } as DOMRect);

    fireEvent.change(screen.getByRole("searchbox", { name: /Search tracks/ }), { target: { value: "jungle" } });
    expect(viewport.scrollTop).toBe(200);
    expect(toolbar.parentElement?.style.getPropertyValue("--dub-search-results-min-height")).toBe("500px");
    viewport.scrollTop = 0;
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(viewport.scrollTop).toBe(200);
  });

  it("keeps search and filter controls working while minimized on mobile", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const { container } = render(<div className="scroll-viewport">{element}</div>);
    const viewport = container.querySelector<HTMLElement>(".scroll-viewport")!;
    const toolbar = container.querySelector<HTMLElement>(".dub-search-toolbar")!;
    const heading = screen.getByRole("heading", { name: title });
    expect(heading).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Minimize search controls", hidden: true }));
    expect(toolbar).toHaveClass("dub-search-toolbar--minimized");
    expect(viewport.scrollTop).toBe(0);
    expect(heading).toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: /Search tracks/ });
    fireEvent.change(search, { target: { value: "jungle" } });
    expect(search).toHaveValue("jungle");
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect(screen.getByRole("dialog", { name: "Filter dubs" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Private" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(screen.getByRole("button", { name: /Filters, 1 active/ })).toBeInTheDocument();
    expect(toolbar).toHaveClass("dub-search-toolbar--minimized");
    fireEvent.click(screen.getByRole("button", { name: "Expand search controls", hidden: true }));
    expect(toolbar).not.toHaveClass("dub-search-toolbar--minimized");
    expect(heading).toBeInTheDocument();
  });
});
