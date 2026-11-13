import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";

afterEach(cleanup);

describe("AppHeader", () => {
  it("wires Help to the account menu", () => {
    const onHelp = vi.fn();
    render(<AppHeader userName="Amber" onEditProfile={vi.fn()} onLogout={vi.fn()} onHelp={onHelp} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu for Amber" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Help & tutorials" }));
    expect(onHelp).toHaveBeenCalledOnce();
  });
  it("keeps the original controls when showing the Dub Vault descriptor", () => {
    render(<AppHeader brandDescriptor="Dub Vault" onMessages={vi.fn()} />);
    expect(screen.getByText("Dub Vault")).toBeVisible();
    expect(screen.getByRole("link", { name: "cre8 home" })).toHaveAttribute("href", "#dubs");
    expect(screen.getByRole("button", { name: "Messages" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Share a dub" })).toBeVisible();
    expect(screen.getByRole("searchbox")).toBeVisible();
  });
  it("passes the member's profile picture to the account menu", () => {
    render(<AppHeader userName="Amber" userAvatarUrl="/amber.png" onEditProfile={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Amber" }).querySelector("img")).toHaveAttribute("src", "/amber.png");
  });

  it("keeps the share button's accessible label", () => {
    render(<AppHeader />);
    const button = screen.getByRole("button", { name: "Share a dub" });
    expect(button.querySelector("svg")).toBeInTheDocument();
    expect(button).not.toHaveTextContent("Share a dub");
  });

  it("opens messages and displays the unread message count separately from notifications", () => {
    const onMessages = vi.fn();
    const { rerender } = render(<AppHeader onMessages={onMessages} unreadMessageCount={12} unreadNotificationCount={2} />);
    const messages = screen.getByRole("button", { name: "Messages, 12 unread" });
    expect(messages).toHaveTextContent("9+");
    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();
    fireEvent.click(messages);
    expect(onMessages).toHaveBeenCalledOnce();
    rerender(<AppHeader onMessages={onMessages} unreadMessageCount={0} />);
    expect(screen.getByRole("button", { name: "Messages" })).not.toHaveTextContent("0");
  });
});
