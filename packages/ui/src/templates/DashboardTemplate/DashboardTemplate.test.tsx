import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardTemplate } from "./DashboardTemplate";

afterEach(cleanup);

describe("DashboardTemplate", () => {
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
});
