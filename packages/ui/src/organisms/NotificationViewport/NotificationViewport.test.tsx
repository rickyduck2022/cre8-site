import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotificationMessage } from "../../molecules/notificationTypes";
import { NotificationViewport } from "./NotificationViewport";

afterEach(() => {
  cleanup();
  document.querySelectorAll("dialog.notification-test-modal").forEach((dialog) => dialog.remove());
});

const notifications: NotificationMessage[] = [{
  id: "crate-updated",
  message: "Crate updated.",
  type: "success",
  createdAt: "2026-11-08T10:00:00.000Z",
  read: false,
}];

describe("NotificationViewport", () => {
  it("renders notifications inside the open modal top layer", async () => {
    const modal = document.createElement("dialog");
    modal.className = "modal notification-test-modal";
    modal.setAttribute("open", "");
    document.body.append(modal);

    render(<NotificationViewport notifications={notifications} onDismiss={vi.fn()} />);

    expect(await within(modal).findByRole("status")).toHaveTextContent("Crate updated.");
    expect(modal.querySelector(".notification-viewport")).toBeTruthy();

    modal.removeAttribute("open");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Crate updated."));
  });
});
