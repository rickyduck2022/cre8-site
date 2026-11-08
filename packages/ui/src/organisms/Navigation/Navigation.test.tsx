import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Navigation } from "./Navigation";

afterEach(cleanup);

describe("Navigation", () => {
  it("shows every navigation link without a pagination control", () => {
    const items = ["Dub Vault", "Friend List", "Messenger", "My Profile", "My Library", "My Dubs"]
      .map((label) => ({ label, icon: <span aria-hidden="true" />, href: `#${label}` }));
    render(<Navigation sections={[{ label: "Your space", items }]} />);

    for (const item of items) expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/page \d+ of \d+/i)).not.toBeInTheDocument();
  });

  it("shows the current member's profile picture", () => {
    render(<Navigation sections={[]} userName="Amber" userAvatarUrl="/amber.png" />);
    expect(screen.getByRole("img", { name: "Amber" }).querySelector("img")).toHaveAttribute("src", "/amber.png");
  });

  it("applies the A-List variant while preserving navigation and current-page semantics", () => {
    render(<Navigation activeItem="A-List" sections={[{ items: [
      { label: "A-List", href: "#alist", icon: <span />, variant: "alist" },
      { label: "A-List Submission", href: "#alist-application", icon: <span /> },
    ] }]} />);
    const link = screen.getByRole("link", { name: "A-List", current: "page" });
    expect(link).toHaveClass("navigation__item--alist");
    expect(link).toHaveAttribute("href", "#alist");
    expect(screen.getByRole("link", { name: "A-List Submission" })).not.toHaveClass("navigation__item--alist");
  });

  it("renders a private navigation item with its count, including zero", () => {
    render(<Navigation sections={[{ items: [{ label: "Shared With Me", href: "#shared-with-me", icon: <span />, variant: "private", badge: "0" }] }]} />);
    const link = screen.getByRole("link", { name: /Shared With Me/ });
    expect(link).toHaveClass("navigation__item--private");
    expect(link).toHaveAttribute("href", "#shared-with-me");
    expect(link).toHaveTextContent("0");
  });
});
