import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MyDubsTemplate } from "./MyDubsTemplate";
import type { Dub } from "../communityTypes";

afterEach(cleanup);
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
});

const dub: Dub = {
  id: "dub-1", title: "Night Drive", artist: "Amber", artistId: "artist-1",
  uploader: "amber", uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z",
  bpm: 174, genre: "Jungle", tags: ["Jungle", "Rollers"], duration: "03:30",
  likes: 1, downloads: 1, artwork: "whitelabel", message: "Fresh dub",
};

function renderPage() {
  const onUpdateDub = vi.fn(async () => dub);
  const onDeleteDub = vi.fn(async () => true);
  render(<MyDubsTemplate
    artists={[{ id: "artist-1", name: "Amber" }]}
    dubs={[dub]}
    likedDubIds={new Set()}
    nowPlayingId={null}
    isPlaying={false}
    onDownload={vi.fn()}
    onPlay={vi.fn()}
    onShareDub={vi.fn()}
    onUpdateDub={onUpdateDub}
    onDeleteDub={onDeleteDub}
  />);
  return { onUpdateDub, onDeleteDub };
}

describe("MyDubsTemplate", () => {
  it("renders the shared dub card and filters the user's tracks", () => {
    renderPage();
    expect(screen.getByText("Night Drive")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search my dubs" }), { target: { value: "bass" } });
    expect(screen.getByText("No dubs found")).toBeInTheDocument();
  });

  it("opens edit and delete flows for an owned track", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit Night Drive" })).toBeInTheDocument();
    expect(screen.getByLabelText("Track title")).toHaveValue("Night Drive");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Delete Night Drive");
  });
});
