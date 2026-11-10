import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { NotificationMessage } from "../../molecules/notificationTypes";
import { NotificationCenter } from "./NotificationCenter";

const notifications: NotificationMessage[] = [{
  id: "notification-1",
  message: "Your dub was added.",
  type: "success",
  createdAt: "2026-11-07T22:00:00.000Z",
  read: false,
}];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it("uses the mobile modal for notifications and supports all actions", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const onClear = vi.fn();
    const onDismiss = vi.fn();
    const onActivate = vi.fn();
    const onOpen = vi.fn();
    const message = { ...notifications[0], conversationId: "buddy", message: "New message" };
    render(<NotificationCenter notifications={[message]} unreadCount={1} onOpen={onOpen} onDismiss={onDismiss} onClear={onClear} onActivate={onActivate} pushSettings={<button>Push settings</button>} />);
    const trigger = screen.getByRole("button", { name: "Notifications, 1 unread" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Notifications" });
    expect(dialog).toHaveClass("modal", "notification-center__dialog");
    expect(onOpen).toHaveBeenCalledOnce();
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Dismiss notification: New message" }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledWith(message.id);
    expect(within(dialog).getByRole("button", { name: "Push settings" })).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: /^New message/ }));
    expect(onActivate).toHaveBeenCalledWith(message);
    expect(screen.queryByRole("dialog", { name: "Notifications" })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("dialog", { name: "Notifications" })).getByRole("button", { name: "Close" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("switches between desktop and mobile layouts without closing the menu", () => {
    let mobile = false;
    let listener: (() => void) | undefined;
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: mobile,
      addEventListener: (_event: string, callback: () => void) => { listener = callback; },
      removeEventListener: vi.fn(),
    })));
    render(<NotificationCenter notifications={[]} unreadCount={0} onOpen={vi.fn()} onDismiss={vi.fn()} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
    act(() => { mobile = true; listener?.(); });
    expect(screen.getByRole("dialog", { name: "Notifications" })).toHaveTextContent("You’re all caught up.");
    act(() => { mobile = false; listener?.(); });
    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });
});
