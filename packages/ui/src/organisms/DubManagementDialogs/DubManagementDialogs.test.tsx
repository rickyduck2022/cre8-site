import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DubManagementDialogs } from "./DubManagementDialogs";
import type { Dub } from "../../templates/communityTypes";

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
