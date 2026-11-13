import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardTemplate } from "./DashboardTemplate";
import { LibraryTemplate } from "../LibraryTemplate/LibraryTemplate";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DashboardTemplate", () => {
  it.each([false, true])("keeps collection controls in content on desktop and in the header on mobile (%s)", (mobile) => {
    vi.stubGlobal("matchMedia", () => ({
      matches: mobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container } = render(
      <DashboardTemplate header={<div />} navigation={<div />} scrollContent>
        <LibraryTemplate downloads={[]} />
      </DashboardTemplate>,
    );
    const search = screen.getByRole("searchbox", { name: /Search tracks/ });
    const viewport = screen.getByRole("region", { name: "Page content" });
    if (mobile) {
      expect(viewport).not.toContainElement(search);
      expect(container.querySelector(".dashboard-template__header")).toContainElement(search);
    } else {
      expect(viewport).toContainElement(search);
      expect(container.querySelector(".dashboard-template__header")).not.toContainElement(search);
      expect(search.closest(".dub-search-toolbar")).toBeInTheDocument();
    }
  });

  it("omits the footer player when none is provided", () => {
    const { rerender } = render(<DashboardTemplate audioPlayer={null} header={<div />} navigation={<div />}>Content</DashboardTemplate>);
    expect(screen.queryByRole("region", { name: /Audio player/ })).not.toBeInTheDocument();
    rerender(<DashboardTemplate header={<div />} navigation={<div />}>Content</DashboardTemplate>);
    expect(screen.queryByRole("region", { name: /Audio player/ })).not.toBeInTheDocument();
  });

  it("provides a reusable content viewport and resets it when the page changes", () => {
    const { rerender } = render(
      <DashboardTemplate audioPlayer={<div />} header={<div />} navigation={<div />} scrollContent scrollResetKey="first">
        First page
      </DashboardTemplate>,
    );
    const viewport = screen.getByRole("region", { name: "Page content" });
    expect(viewport).toHaveClass("scroll-viewport");
    expect(viewport).toHaveAttribute("tabindex", "0");
    viewport.scrollTop = 300;
    Object.defineProperty(document, "scrollingElement", { configurable: true, value: document.documentElement });
    document.documentElement.scrollTop = 400;
    rerender(
      <DashboardTemplate audioPlayer={<div />} header={<div />} navigation={<div />} scrollContent scrollResetKey="second">
        Second page
      </DashboardTemplate>,
    );
    expect(viewport.scrollTop).toBe(0);
    expect(document.documentElement.scrollTop).toBe(0);
  });

  it("renders a supplied footer outside the scrollable content", () => {
    render(
      <DashboardTemplate footer={<footer aria-label="Media and navigation">Footer</footer>} header={<div />} navigation={<div />} scrollContent>
        Content
      </DashboardTemplate>,
    );
    expect(screen.getByRole("contentinfo", { name: "Media and navigation" })).toHaveTextContent("Footer");
    expect(screen.getByRole("region", { name: "Page content" })).not.toContainElement(screen.getByRole("contentinfo"));
  });

  it("takes over only the content viewport and restores scroll on cancel but resets on apply", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container, unmount } = render(<DashboardTemplate header={<div>App header</div>} navigation={<div />} scrollContent>
      <LibraryTemplate downloads={[]} />
    </DashboardTemplate>);
    const viewport = screen.getByRole("region", { name: "Page content" });
    viewport.scrollTop = 350;
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("button", { name: "Filters" })).toHaveFocus();
    expect(container.querySelector(".dashboard-template__filter-host")).toContainElement(screen.getByRole("button", { name: "Apply filters" }));
    expect(viewport.inert).toBe(true);
    expect(viewport.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
    expect(viewport.inert).toBeFalsy();
    expect(viewport.style.overflow).toBe("");
    expect(viewport.scrollTop).toBe(350);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(viewport.scrollTop).toBe(0);
    viewport.scrollTop = 180;
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Apply filters" }), { key: "Escape" });
    expect(viewport.scrollTop).toBe(180);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    unmount();
    expect(viewport.inert).toBeFalsy();
    expect(viewport.style.overflow).toBe("");
  });

  it("compacts mobile browsing only after deliberate scrolling and reveals chrome upward", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container } = render(<DashboardTemplate header={<div>App header</div>} navigation={<div />} scrollContent>Content</DashboardTemplate>);
    const viewport = screen.getByRole("region", { name: "Page content" });
    viewport.scrollTop = 100;
    fireEvent.scroll(viewport);
    expect(container.querySelector("main")).not.toHaveClass("dashboard-template--browse-compact");
    fireEvent.touchMove(viewport);
    viewport.scrollTop = 200;
    fireEvent.scroll(viewport);
    expect(container.querySelector("main")).toHaveClass("dashboard-template--browse-compact");
    viewport.scrollTop = 130;
    fireEvent.scroll(viewport);
    expect(container.querySelector("main")).not.toHaveClass("dashboard-template--browse-compact");
  });

  it("releases filter scroll locks and resets position when navigating to another collection", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { rerender } = render(<DashboardTemplate header={<div />} navigation={<div />} scrollContent scrollResetKey="library">
      <LibraryTemplate downloads={[]} />
    </DashboardTemplate>);
    const viewport = screen.getByRole("region", { name: "Page content" });
    viewport.scrollTop = 300;
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    rerender(<DashboardTemplate header={<div />} navigation={<div />} scrollContent scrollResetKey="other">Another collection</DashboardTemplate>);
    expect(viewport.inert).toBeFalsy();
    expect(viewport.style.overflow).toBe("");
    expect(viewport.scrollTop).toBe(0);
    expect(screen.queryByRole("button", { name: "Apply filters" })).not.toBeInTheDocument();
  });

  it("does not hide keyboard-focused header controls during mobile browsing", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container } = render(<DashboardTemplate header={<button>Header action</button>} navigation={<div />} scrollContent>Content</DashboardTemplate>);
    screen.getByRole("button", { name: "Header action" }).focus();
    const viewport = screen.getByRole("region", { name: "Page content" });
    fireEvent.wheel(viewport);
    viewport.scrollTop = 100;
    fireEvent.scroll(viewport);
    expect(container.querySelector("main")).not.toHaveClass("dashboard-template--browse-compact");
    expect(screen.getByRole("button", { name: "Header action" })).toHaveFocus();
  });
});
