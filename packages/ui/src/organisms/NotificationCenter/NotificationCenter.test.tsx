import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotificationMessage } from "../../molecules/notificationTypes";
import { NotificationCenter } from "./NotificationCenter";

const notifications: NotificationMessage[] = [{
  id: "notification-1",
  message: "Your dub was added.",
  type: "success",
  createdAt: "2026-11-07T22:00:00.000Z",
  read: false,
}];

afterEach(cleanup);

describe("NotificationCenter", () => {
  it("shows unread activity and marks it read when opened", () => {
    const onOpen = vi.fn();
    render(
      <NotificationCenter
        notifications={notifications}
        unreadCount={1}
        onClear={vi.fn()}
        onDismiss={vi.fn()}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));

    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("Your dub was added.")).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("dismisses a notification and clears the notification history", () => {
    const onDismiss = vi.fn();
    const onClear = vi.fn();
    render(
      <NotificationCenter
        notifications={notifications}
        unreadCount={1}
        onClear={onClear}
        onDismiss={onDismiss}
        onOpen={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification: Your dub was added." }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onDismiss).toHaveBeenCalledWith("notification-1");
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("opens a conversation from its message notification", () => {
    const onActivate = vi.fn();
    const messageNotification = {
      ...notifications[0],
      message: "Holik sent you a message: Hello",
      conversationId: "buddy-holik",
    };
    render(
      <NotificationCenter
        notifications={[messageNotification]}
        unreadCount={1}
        onActivate={onActivate}
        onClear={vi.fn()}
        onDismiss={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
    fireEvent.click(screen.getByRole("button", { name: /^Holik sent you a message: Hello/ }));

    expect(onActivate).toHaveBeenCalledWith(messageNotification);
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });
});
