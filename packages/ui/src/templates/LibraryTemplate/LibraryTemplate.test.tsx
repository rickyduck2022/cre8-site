import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryTemplate } from "./LibraryTemplate";

afterEach(cleanup);

describe("LibraryTemplate", () => {
  it("searches and filters downloads across distributions, tags, ranges and formats", () => {
    const dub = {
      id: "one", title: "Night Drive", artist: "Amber", uploader: "amber",
      uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00Z", bpm: 174,
      genre: "Jungle", tags: ["Jungle"], duration: "03:30", likes: 1,
      downloads: 1, artwork: "whitelabel", message: "", audioFileName: "track.wav",
      bitrateKbps: 320, distribution: "private" as const,
    };
    const other = { ...dub, id: "two", title: "Sunrise", distribution: "alist" as const, audioFileName: "track.mp3", bitrateKbps: 128, tags: ["Liquid"] };
    render(<LibraryTemplate downloads={[{ dub, downloadedAt: "2026-11-02T12:00:00Z" }, { dub: other, downloadedAt: "2026-11-03T12:00:00Z" }]} onDownload={vi.fn()} onPlay={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    for (const label of ["Worldwide", "Private", "A-List"]) expect(screen.getByRole("checkbox", { name: label })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "A-List" }));
    fireEvent.click(screen.getByRole("button", { name: "Jungle" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum BPM" }), { target: { value: "170" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum Bitrate" }), { target: { value: "300" } });
    fireEvent.change(screen.getByRole("combobox", { name: "File type" }), { target: { value: "WAV" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).toBeVisible();
    expect(screen.getByText(/^Downloaded /)).toHaveAttribute("datetime", "2026-11-02T12:00:00Z");
    expect(screen.queryByRole("region", { name: "Audio player: Sunrise" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: /Search tracks/ }), { target: { value: "missing" } });
    expect(screen.getByText("No downloaded dubs match your filters")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("region", { name: "Audio player: Sunrise" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum BPM" }), { target: { value: "180" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum BPM" }), { target: { value: "160" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Minimum BPM must not exceed the maximum.");
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Audio player: Sunrise" })).toBeVisible();
  });

  it("retains all library entries without introducing pagination", () => {
    const dub = {
      id: "one", title: "Track", artist: "Amber", uploader: "amber", uploaderDisplayName: "Amber",
      uploadedAt: "2026-11-01T12:00:00Z", bpm: 0, genre: "Jungle", duration: "00:00", likes: 0, downloads: 0, artwork: "", message: "",
    };
    const downloads = Array.from({ length: 7 }, (_, index) => ({ dub: { ...dub, id: String(index), title: `Track ${index}` }, downloadedAt: "2026-11-02T12:00:00Z" }));
    render(<LibraryTemplate downloads={downloads} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Audio player: Track 6" })).toBeVisible();
    expect(screen.queryByRole("group", { name: /pagination/ })).not.toBeInTheDocument();
  });

  it("shows each dub once with its latest download date without mutating download history", () => {
    const dub = {
      id: "one", title: "Night Drive", artist: "Amber", uploader: "amber", uploaderDisplayName: "Amber",
      uploadedAt: "2026-11-01T12:00:00Z", bpm: 174, genre: "Jungle", duration: "03:30",
      likes: 1, downloads: 3, artwork: "", message: "",
    };
    const history = [
      { dub, downloadedAt: "2026-11-02T12:00:00Z" },
      { dub, downloadedAt: "2026-11-04T12:00:00Z" },
      { dub, downloadedAt: "2026-11-03T12:00:00Z" },
    ];
    const onDownload = vi.fn();
    render(<LibraryTemplate downloads={history} onDownload={onDownload} onPlay={vi.fn()} />);
    expect(screen.getAllByRole("region", { name: "Audio player: Night Drive" })).toHaveLength(1);
    expect(screen.getByText("1 dub")).toBeInTheDocument();
    expect(screen.getByText(/^Downloaded /)).toHaveAttribute("datetime", "2026-11-04T12:00:00Z");
    fireEvent.click(screen.getByRole("button", { name: "Download again" }));
    expect(onDownload).toHaveBeenCalledWith(dub);
    expect(history).toHaveLength(3);
    expect(history[0].downloadedAt).toBe("2026-11-02T12:00:00Z");
  });

  it("lists saved downloads and supports downloading a dub again", () => {
    const onDownload = vi.fn();
    const onOpenProfile = vi.fn();
    const dub = {
      id: "dub-1", title: "Night Drive", artist: "Amber", uploader: "amber",
      uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z", bpm: 174,
      genre: "Jungle", tags: ["Jungle", "Rollers"], duration: "03:30", likes: 1,
      downloads: 1, artwork: "whitelabel", message: "Fresh dub", audioFileName: "night-drive.mp3",
      bitrateKbps: 320,
    };
    const onPlay = vi.fn();
    render(<LibraryTemplate downloads={[{ dub, downloadedAt: "2026-11-02T12:00:00.000Z" }]} onDownload={onDownload} onPlay={onPlay} onOpenProfile={onOpenProfile} />);
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).toBeVisible();
    expect(screen.getByText("MP3")).toBeInTheDocument();
    expect(screen.getByText("320 kbps avg")).toBeInTheDocument();
    expect(screen.getByText(/^Downloaded /)).toHaveAttribute("datetime", "2026-11-02T12:00:00.000Z");
    fireEvent.click(screen.getByRole("button", { name: "View Amber's profile" }));
    expect(onOpenProfile).toHaveBeenCalledWith("amber");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onPlay).toHaveBeenCalledWith(dub);
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
      onPlay={vi.fn()}
      currentUsername="amber"
      onEditDub={onEditDub}
      onDeleteDub={onDeleteDub}
    />);
    expect(screen.queryByRole("button", { name: "Edit Owned track" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions for Other track" })).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Actions for Owned track" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Edit Owned track" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Delete Owned track" }));
    expect(onEditDub).toHaveBeenCalledWith(ownDub);
    expect(onDeleteDub).toHaveBeenCalledWith(ownDub);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("offers sharing for public and owned private dubs, but not received private dubs", () => {
    const onShareWithFriend = vi.fn();
    const dub = {
      id: "public", title: "Public", artist: "Amber", uploader: "amber",
      uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00Z", bpm: 174,
      genre: "Jungle", duration: "03:30", likes: 0, downloads: 0, artwork: "whitelabel", message: "",
    };
    const received = { ...dub, id: "private", title: "Private", distribution: "private" as const };
    const owned = { ...received, id: "owned", title: "Mine", uploader: "meladee" };
    render(<LibraryTemplate downloads={[dub, received, owned].map((item) => ({ dub: item, downloadedAt: "2026-11-02T12:00:00Z" }))} onDownload={vi.fn()} onPlay={vi.fn()} currentUsername="meladee" onShareWithFriend={onShareWithFriend} />);
    fireEvent.click(screen.getByRole("button", { name: "Share Public" }));
    fireEvent.click(screen.getByRole("button", { name: "Share Mine" }));
    expect(screen.queryByRole("button", { name: "Share Private" })).not.toBeInTheDocument();
    expect(onShareWithFriend).toHaveBeenNthCalledWith(1, dub);
    expect(onShareWithFriend).toHaveBeenNthCalledWith(2, owned);
  });
});
