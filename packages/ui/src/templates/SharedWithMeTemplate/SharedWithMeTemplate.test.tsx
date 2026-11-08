import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SharedWithMeTemplate } from "./SharedWithMeTemplate";
import type { Dub } from "../communityTypes";

afterEach(cleanup);

const dub: Dub = {
  id: "private", title: "Secret track", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00Z", bpm: 174,
  genre: "Jungle", duration: "03:30", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "", distribution: "private",
};

describe("SharedWithMeTemplate", () => {
  it("filters all distribution types on apply, supports search and restores all types on clear", () => {
    const publicDub: Dub = { ...dub, id: "public", title: "Worldwide", distribution: "worldwide", tags: ["Jungle"], bpm: 170, audioFormat: "MP3", bitrateKbps: 320 };
    const alist: Dub = { ...dub, id: "alist", title: "Exclusive", distribution: "alist" };
    render(<SharedWithMeTemplate dubs={[dub, publicDub, alist]} currentUsername="meladee" onPlay={vi.fn()} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("checkbox", { name: "Private" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Worldwide" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "A-List" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Private" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "A-List" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(screen.getByRole("region", { name: "Audio player: Worldwide" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Audio player: Secret track" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: /Search tracks/ }), { target: { value: "nonexistent" } });
    expect(screen.getByText("No shared dubs match your filters")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("checkbox", { name: "Private" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "A-List" })).toBeChecked();
    expect(screen.getByRole("region", { name: "Audio player: Secret track" })).toBeVisible();
  });

  it("applies tag, BPM, format and bitrate constraints and reports invalid ranges", () => {
    const track: Dub = { ...dub, tags: ["Jungle"], bpm: 174, audioFormat: "WAV", bitrateKbps: 320 };
    render(<SharedWithMeTemplate dubs={[track]} onPlay={vi.fn()} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Jungle" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum BPM" }), { target: { value: "170" } });
    fireEvent.change(screen.getByRole("combobox", { name: "File type" }), { target: { value: "WAV" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum Bitrate" }), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(screen.getByRole("region", { name: "Audio player: Secret track" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum BPM" }), { target: { value: "160" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Minimum values");
  });
  it("renders received public and A-List dubs and allows sharing them", () => {
    const publicDub: Dub = { ...dub, id: "public", title: "Worldwide", distribution: "worldwide" };
    const alist: Dub = { ...dub, id: "alist", title: "Exclusive", distribution: "alist" };
    const onShareWithFriend = vi.fn();
    render(<SharedWithMeTemplate dubs={[dub, publicDub, alist]} currentUsername="meladee" onPlay={vi.fn()} onDownload={vi.fn()} onShareWithFriend={onShareWithFriend} />);
    expect(screen.getByText("3 shared dubs")).toBeVisible();
    expect(screen.getByRole("region", { name: "Audio player: Worldwide" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Audio player: Exclusive" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Share Worldwide with a friend" }));
    fireEvent.click(screen.getByRole("button", { name: "Share Exclusive with a friend" }));
    expect(onShareWithFriend).toHaveBeenNthCalledWith(1, publicDub);
    expect(onShareWithFriend).toHaveBeenNthCalledWith(2, alist);
  });
  it("plays and downloads received private dubs without forwarding or management", () => {
    const onPlay = vi.fn();
    const onDownload = vi.fn();
    render(<SharedWithMeTemplate dubs={[dub]} currentUsername="meladee" onPlay={onPlay} onDownload={onDownload} onShareWithFriend={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("1 shared dub")).toBeVisible();
    expect(screen.getByRole("region", { name: "Audio player: Secret track" }).closest("article")).toHaveClass("dub-card--private");
    expect(screen.queryByRole("button", { name: "Share Secret track with a friend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions for Secret track" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Download · Like" }));
    expect(onPlay).toHaveBeenCalledWith(dub);
    expect(onDownload).toHaveBeenCalledWith(dub);
  });

  it("shows an empty state and paginates larger collections", () => {
    const props = { onPlay: vi.fn(), onDownload: vi.fn() };
    const { rerender } = render(<SharedWithMeTemplate {...props} dubs={[]} />);
    expect(screen.getByText("No dubs shared with you")).toBeVisible();
    const dubs = Array.from({ length: 6 }, (_, index) => ({ ...dub, id: String(index), title: `Track ${index}` }));
    rerender(<SharedWithMeTemplate {...props} dubs={dubs} />);
    expect(screen.getByText("6 shared dubs")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Audio player: Track 5" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next Shared dubs page" }));
    expect(screen.getByRole("region", { name: "Audio player: Track 5" })).toBeVisible();
  });
});
