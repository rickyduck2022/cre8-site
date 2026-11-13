import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DubManagementDialogs } from "./DubManagementDialogs";
import type { Dub } from "../../types/domain";

afterEach(cleanup);
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
});

const dub: Dub = {
  id: "dub-1", title: "Night Drive", artist: "Amber", artistId: "artist-1",
  uploader: "amber", uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z",
  bpm: 174, genre: "Jungle", tags: ["Jungle"], duration: "03:30",
  likes: 0, downloads: 0, artwork: "whitelabel", message: "Fresh dub",
};

describe("DubManagementDialogs", () => {
  it("blocks dismissal while editing, preserves fields on rejection and closes only after retry succeeds", async () => {
    let reject!: (error: Error) => void;
    const update = vi.fn()
      .mockImplementationOnce(() => new Promise<Dub>((_resolve, rejectPromise) => { reject = rejectPromise; }))
      .mockResolvedValueOnce(dub);
    const close = vi.fn();
    const { container } = render(<DubManagementDialogs
      editingDub={dub} deletingDub={null} artists={[{ id: "artist-1", name: "Amber" }]}
      onCloseEdit={close} onCloseDelete={vi.fn()} onUpdateDub={update} onDeleteDub={vi.fn()}
    />);
    fireEvent.change(screen.getByLabelText("Track title"), { target: { value: "Keep my title" } });
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(update).toHaveBeenCalledOnce();
    const dialog = screen.getByRole("dialog");
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog);
    expect(close).not.toHaveBeenCalled();
    await act(async () => { reject(new Error("Track service unavailable.")); });
    expect(screen.getByRole("alert")).toHaveTextContent("Track service unavailable.");
    expect(screen.getByLabelText("Track title")).toHaveValue("Keep my title");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(update).toHaveBeenLastCalledWith(dub.id, expect.objectContaining({ title: "Keep my title" }));
  });

  it("shows failed saves inline even when the API reports null instead of throwing", async () => {
    const close = vi.fn();
    render(<DubManagementDialogs
      editingDub={dub} deletingDub={null} artists={[{ id: "artist-1", name: "Amber" }]}
      onCloseEdit={close} onCloseDelete={vi.fn()} onUpdateDub={vi.fn(async () => null)} onDeleteDub={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The dub could not be saved.");
    expect(close).not.toHaveBeenCalled();
  });

  it.each(["dub", "sample", "vocal"] as const)("guards %s deletion, shows failure inline, and permits retry", async (mediaKind) => {
    let finish!: (value: boolean) => void;
    const remove = vi.fn()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(true);
    const close = vi.fn();
    render(<DubManagementDialogs
      editingDub={null} deletingDub={{ ...dub, mediaKind }} artists={[]}
      onCloseEdit={vi.fn()} onCloseDelete={close} onUpdateDub={vi.fn()} onDeleteDub={remove}
    />);
    fireEvent.click(screen.getByRole("button", { name: `Delete ${mediaKind}` }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    const dialog = screen.getByRole("dialog");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog);
    expect(close).not.toHaveBeenCalled();
    await act(async () => { finish(false); });
    expect(screen.getByRole("alert")).toHaveTextContent(`The ${mediaKind} could not be deleted.`);
    fireEvent.click(screen.getByRole("button", { name: `Delete ${mediaKind}` }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("uses the existing dub form and closes after a successful edit", async () => {
    const onUpdateDub = vi.fn(async () => dub);
    const onCloseEdit = vi.fn();
    render(<DubManagementDialogs
      editingDub={dub}
      deletingDub={null}
      artists={[{ id: "artist-1", name: "Amber" }]}
      onCloseEdit={onCloseEdit}
      onCloseDelete={vi.fn()}
      onUpdateDub={onUpdateDub}
      onDeleteDub={vi.fn(async () => true)}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onUpdateDub).toHaveBeenCalledWith("dub-1", expect.objectContaining({ title: "Night Drive" })));
    expect(onCloseEdit).toHaveBeenCalled();
  });

  it("lets an editor select friends, explicitly reshare and passes them with the saved track", async () => {
    const onUpdateDub = vi.fn(async () => dub);
    render(<DubManagementDialogs
      editingDub={{ ...dub, distribution: "private", sharedBuddyIds: ["friend-1"] }}
      deletingDub={null}
      artists={[{ id: "artist-1", name: "Amber" }]}
      buddies={[
        { id: "friend-1", username: "meladee", displayName: "Meladee", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] },
        { id: "friend-2", username: "holik", displayName: "Holik", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] },
      ]}
      onCloseEdit={vi.fn()} onCloseDelete={vi.fn()} onUpdateDub={onUpdateDub}
      onDeleteDub={vi.fn(async () => true)}
    />);
    expect(screen.getByRole("checkbox", { name: /Meladee/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Share again with Meladee" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Holik/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onUpdateDub).toHaveBeenCalledWith("dub-1", expect.objectContaining({ buddyIds: ["friend-1", "friend-2"] })));
  });

  it("confirms deletion through the shared confirmation dialog", async () => {
    const onDeleteDub = vi.fn(async () => true);
    const onCloseDelete = vi.fn();
    render(<DubManagementDialogs
      editingDub={null}
      deletingDub={dub}
      artists={[]}
      onCloseEdit={vi.fn()}
      onCloseDelete={onCloseDelete}
      onUpdateDub={vi.fn(async () => dub)}
      onDeleteDub={onDeleteDub}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Delete dub" }));
    await waitFor(() => expect(onDeleteDub).toHaveBeenCalledWith("dub-1"));
    expect(onCloseDelete).toHaveBeenCalled();
  });
});
