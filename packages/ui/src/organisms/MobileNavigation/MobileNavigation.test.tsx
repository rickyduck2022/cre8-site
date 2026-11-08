import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MobileNavigation } from "./MobileNavigation";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

describe("MobileNavigation", () => {
  it("shows primary links and opens the complete menu with badges and active state", () => {
    const openProfile = vi.fn();
    render(<MobileNavigation activeItem="A-List" primaryHrefs={["#dubs", "#library", "#profile", "#messenger"]} sections={[{ items: [
      { label: "Dub Vault", href: "#dubs", icon: <span />, badge: "12" },
      { label: "A-List", href: "#alist", icon: <span />, badge: "2", variant: "alist" },
      { label: "Shared With Me", href: "#shared", icon: <span />, badge: "3", variant: "private" },
      { label: "Messenger", href: "#messenger", icon: <span /> },
      { label: "My Library", href: "#library", icon: <span /> },
      { label: "My Profile", href: "#profile", icon: <span />, onClick: openProfile },
    ] }]} />);
    expect(screen.getByRole("link", { name: /Dub Vault/ })).toHaveTextContent("12");
    expect(screen.getByRole("link", { name: "My Library" })).toBeVisible();
    expect(screen.getByRole("link", { name: "My Profile" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /A-List/ })).not.toBeInTheDocument();
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-current", "page");
    fireEvent.click(more);
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();
    expect(screen.getByRole("link", { name: /A-List/, current: "page" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Shared With Me/ })).toBeVisible();
    fireEvent.click(screen.getAllByRole("link", { name: "My Profile" })[1]);
    expect(openProfile).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  });
});
