import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardTemplate } from "./DashboardTemplate";

afterEach(cleanup);

describe("DashboardTemplate", () => {
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
