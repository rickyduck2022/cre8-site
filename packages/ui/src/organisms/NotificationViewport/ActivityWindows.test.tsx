import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ActivityWindows } from "./ActivityWindows";
import { useNotifications } from "../../../../../apps/web/src/hooks/useNotifications";
import { useUploadResults } from "../../../../../apps/web/src/hooks/useUploadResults";

afterEach(() => { cleanup(); vi.useRealTimers(); });

function Harness() {
  const state = useNotifications();
  const uploads = useUploadResults(state.notify, "test");
  return <>
    <button onClick={() => state.notify("New message", "info")}>Notify</button>
    <button onClick={() => state.notify("Failure", "error")}>Fail</button>
    <button onClick={() => uploads.finishUpload("Dub uploaded")}>Finish upload</button>
    <button onClick={() => uploads.finishUpload("Upload failed", "error")}>Fail upload</button>
    <ActivityWindows notifications={state.notifications} activeNotifications={state.activeNotifications}
      unreadCount={state.unreadNotificationCount} onRead={state.markNotificationsRead} onDismiss={state.dismissNotification}
      onClear={state.clearNotifications} uploadResults={uploads.uploadResults} onDismissUpload={uploads.dismissUploadResult} />
  </>;
}

it("shows each notification for five seconds then retains unread history until opened or dismissed", () => {
  vi.useFakeTimers();
  render(<Harness />);
  fireEvent.click(screen.getByText("Notify"));
  fireEvent.click(screen.getByText("Fail"));
  expect(screen.getAllByRole("dialog", { name: "Notification", exact: true })).toHaveLength(2);
  act(() => vi.advanceTimersByTime(4999));
  expect(screen.getAllByRole("dialog", { name: "Notification", exact: true })).toHaveLength(2);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("dialog", { name: "Notification", exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Notifications, 2 unread", exact: true }));
  expect(screen.getByRole("button", { name: "Notifications, 0 unread", exact: true })).toHaveTextContent("[0] notifications");
  const history = screen.getByRole("dialog", { name: "Notification history", exact: true });
  expect(history).toHaveTextContent("New message");
  expect(history).toHaveTextContent("Failure");
  fireEvent.click(within(history).getByRole("button", { name: "Clear all notifications" }));
  expect(history).toHaveTextContent("No notifications.");
});

it.each(["Finish upload", "Fail upload"])("retains upload results for thirty seconds then shows a five-second notification: %s", (action) => {
  vi.useFakeTimers();
  render(<Harness />);
  fireEvent.click(screen.getByText(action));
  const uploads = screen.getByRole("dialog", { name: "Uploads", exact: true });
  expect(uploads).toHaveTextContent(action === "Finish upload" ? "Dub uploaded" : "Upload failed");
  act(() => vi.advanceTimersByTime(29999));
  expect(uploads).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Notification", exact: true })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("dialog", { name: "Uploads", exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Notification", exact: true })).toBeVisible();
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.queryByRole("dialog", { name: "Notification", exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
});

it("supports minimization and explicit dismissal without reopening a dismissed upload result", () => {
  vi.useFakeTimers();
  render(<Harness />);
  fireEvent.click(screen.getByText("Finish upload"));
  fireEvent.click(screen.getByRole("button", { name: "Minimize Uploads" }));
  expect(screen.queryByText("Dub uploaded")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Restore Uploads" }));
  fireEvent.click(screen.getByRole("button", { name: "Close upload result: Dub uploaded" }));
  act(() => vi.advanceTimersByTime(35000));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("keeps an active upload visible beyond all result timers and does not offer a close action", () => {
  vi.useFakeTimers();
  render(<ActivityWindows notifications={[]} activeNotifications={[]} unreadCount={0} onRead={vi.fn()} onDismiss={vi.fn()}
    onClear={vi.fn()} onDismissUpload={vi.fn()} uploadProgress={{ phase: "uploading", fileName: "dub.wav", progress: 10 }} />);
  act(() => vi.advanceTimersByTime(60000));
  const uploads = screen.getByRole("dialog", { name: "Uploads", exact: true });
  expect(uploads).toHaveTextContent("Uploading dub.wav");
  expect(within(uploads).getByRole("button", { name: "Close Uploads", exact: true })).toBeDisabled();
});

it("cleans up upload-result timers on account changes and unmount", () => {
  vi.useFakeTimers();
  const notify = vi.fn();
  const { result, rerender, unmount } = renderHook(({ owner }) => useUploadResults(notify, owner), { initialProps: { owner: "one" } });
  act(() => result.current.finishUpload("First"));
  rerender({ owner: "two" });
  expect(result.current.uploadResults).toEqual([]);
  act(() => vi.advanceTimersByTime(30000));
  expect(notify).not.toHaveBeenCalled();
  act(() => result.current.finishUpload("Second"));
  unmount();
  act(() => vi.advanceTimersByTime(30000));
  expect(notify).not.toHaveBeenCalled();
});
