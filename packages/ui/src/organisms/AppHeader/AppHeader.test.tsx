import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";

afterEach(cleanup);

describe("AppHeader", () => {
  it("passes the member's profile picture to the account menu", () => {
    render(<AppHeader userName="Amber" userAvatarUrl="/amber.png" onEditProfile={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Amber" }).querySelector("img")).toHaveAttribute("src", "/amber.png");
  });

  it("keeps the share button's accessible label", () => {
    render(<AppHeader />);
    expect(screen.getByRole("button", { name: "Share a dub" })).toBeInTheDocument();
  });
});
