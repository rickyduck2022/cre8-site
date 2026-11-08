import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryTemplate } from "./LibraryTemplate";

afterEach(cleanup);

describe("LibraryTemplate", () => {
  it("lists saved downloads and supports downloading a dub again", () => {
    const onDownload = vi.fn();
    const dub = {
      id: "dub-1", title: "Night Drive", artist: "Amber", uploader: "amber",
      uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z", bpm: 174,
      genre: "Jungle", tags: ["Jungle", "Rollers"], duration: "03:30", likes: 1,
      downloads: 1, artwork: "whitelabel", message: "Fresh dub", audioFileName: "night-drive.mp3",
      bitrateKbps: 320,
    };
    render(<LibraryTemplate downloads={[{ dub, downloadedAt: "2026-11-02T12:00:00.000Z" }]} onDownload={onDownload} />);
    expect(screen.getByText("Night Drive")).toBeTruthy();
    expect(screen.getByText("MP3")).toBeInTheDocument();
    expect(screen.getByText("320 kbps avg")).toBeInTheDocument();
    expect(screen.getByText(/Downloaded/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download again" }));
    expect(onDownload).toHaveBeenCalledWith(dub);
  });

  it("shows track management only on dubs uploaded by the signed-in user", () => {
    const onEditDub = vi.fn();
    const onDeleteDub = vi.fn();
    const ownDub = {
      id: "owned", title: "Owned track", artist: "Amber", uploader: "amber",
      uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z", bpm: 174,
      genre: "Jungle", tags: ["Jungle"], duration: "03:30", likes: 0,
      downloads: 1, artwork: "whitelabel", message: "Mine",
    };
    const otherDub = { ...ownDub, id: "other", title: "Other track", uploader: "someone-else" };
    render(<LibraryTemplate
      downloads={[{ dub: ownDub, downloadedAt: "2026-11-02T12:00:00.000Z" }, { dub: otherDub, downloadedAt: "2026-11-02T12:00:00.000Z" }]}
      onDownload={vi.fn()}
      currentUsername="amber"
      onEditDub={onEditDub}
      onDeleteDub={onDeleteDub}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Owned track" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Owned track" }));
    expect(onEditDub).toHaveBeenCalledWith(ownDub);
    expect(onDeleteDub).toHaveBeenCalledWith(ownDub);
    expect(screen.queryByRole("button", { name: "Edit Other track" })).not.toBeInTheDocument();
  });
});
