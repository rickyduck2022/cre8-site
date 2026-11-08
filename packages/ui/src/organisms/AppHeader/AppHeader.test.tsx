import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
