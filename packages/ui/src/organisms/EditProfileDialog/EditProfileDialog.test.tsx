import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EditProfileDialog } from "./EditProfileDialog";

const profile = { displayName: "Amber", role: "DJ", bio: "Music", genre: "Jungle" };
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(cleanup);

describe("EditProfileDialog", () => {
  it("blocks all dismissal and duplicate submission while saving, then closes on confirmed success", async () => {
    let finish!: (value: boolean) => void;
    const save = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const close = vi.fn();
    const { container } = render(<EditProfileDialog profile={profile} onSubmit={save} onClose={close} />);
    fireEvent.change(screen.getByLabelText("Artist name"), { target: { value: "New name" } });
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(save).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Artist name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving profile" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    const dialog = screen.getByRole("dialog");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Please wait");
    await act(async () => { finish(true); });
    expect(close).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ displayName: "New name" }));
  });

  it.each(["false", "rejection"])("preserves values after %s and permits retry", async (failure) => {
    const save = vi.fn()
      .mockImplementationOnce(() => failure === "false" ? false : Promise.reject(new Error("Profile service unavailable.")))
      .mockResolvedValueOnce(true);
    const close = vi.fn();
    render(<EditProfileDialog profile={profile} onSubmit={save} onClose={close} />);
    fireEvent.change(screen.getByLabelText("Artist name"), { target: { value: "Keep my name" } });
    fireEvent.change(screen.getByLabelText("About me"), { target: { value: "Keep my bio" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(failure === "false" ? "Profile could not be updated" : "Profile service unavailable.");
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Artist name")).toHaveValue("Keep my name");
    expect(screen.getByLabelText("About me")).toHaveValue("Keep my bio");
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
