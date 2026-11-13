import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Navigation } from "./Navigation";

afterEach(cleanup);

describe("Navigation", () => {
  it("collapses media menus independently and reveals a newly active destination", () => {
    const sections = (["dub", "sample", "vocal"] as const).map((mediaKind) => ({
      label: `${mediaKind}s`, mediaKind, items: [{ label: `${mediaKind} vault`, href: `#${mediaKind}`, icon: <span /> }],
    }));
    const app = render(<Navigation sections={sections} activeItem="dub vault" />);
    expect(screen.getByRole("button", { name: "dubs menu" })).toHaveAttribute("aria-expanded", "true");
    const samples = screen.getByRole("button", { name: "samples menu" });
    expect(samples).toHaveAttribute("aria-expanded", "false");
    expect(samples).toHaveClass("button--audio", "media-kind--sample");
    expect(screen.queryByRole("link", { name: "sample vault" })).not.toBeInTheDocument();
    fireEvent.click(samples);
    expect(screen.getByRole("link", { name: "sample vault" })).toBeVisible();
    fireEvent.click(samples);
    app.rerender(<Navigation sections={sections} activeItem="sample vault" />);
    expect(screen.getByRole("link", { name: "sample vault", current: "page" })).toBeVisible();
    expect(screen.getByRole("button", { name: "vocals menu" })).toHaveAttribute("aria-expanded", "false");
  });
  it("keeps the brand and navigation labels when opting into a vault descriptor", () => {
    render(<Navigation brandDescriptor="Dub Vault" activeItem="Sample Vault" sections={[{ items: [
      { label: "Sample Vault", href: "#samples", icon: <span />, mediaKind: "sample" },
    ] }]} />);
    expect(screen.getByText("Dub Vault")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sample Vault", current: "page" })).toHaveAttribute("href", "#samples");
  });
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
