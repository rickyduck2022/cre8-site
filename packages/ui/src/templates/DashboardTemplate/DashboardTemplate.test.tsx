import { cleanup, render, screen } from "@testing-library/react";
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
    rerender(
      <DashboardTemplate audioPlayer={<div />} header={<div />} navigation={<div />} scrollContent scrollResetKey="second">
        Second page
      </DashboardTemplate>,
    );
    expect(viewport.scrollTop).toBe(0);
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
});
