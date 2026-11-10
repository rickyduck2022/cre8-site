import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DubPackCard, type DubPack } from "./DubPackCard";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const pack: DubPack = {
  id: "pack", title: "Night Sessions", description: "", kind: "sample", status: "published",
  distribution: "worldwide", aListPublic: false, licence: "Original productions only.",
  ownerUsername: "amber", ownerDisplayName: "Amber", totalBytes: 1200, createdAt: "2026-11-10", updatedAt: "2026-11-10",
  items: ["Opening", "Closing"].map((title, index) => ({ key: "F minor", dub: {
    id: String(index), title, artist: "Amber", uploader: "amber", uploaderDisplayName: "Amber",
    uploadedAt: "2026-11-10", duration: "01:00", bpm: 174, genre: "Jungle", likes: 0,
    downloads: 0, artwork: "", message: "", audioUrl: `/api/dubs/${index}/audio`,
  } })),
};
const props = {
  pack, likedDubIds: new Set<string>(), nowPlayingId: null, isPlaying: false,
  onPlay: vi.fn(), onDownload: vi.fn(), onPlayAll: vi.fn(), onOpenPack: vi.fn(),
};

it.each(["dub", "sample"] as const)("marks A-List %s packs independently of their contents or publication status", (kind) => {
  const { rerender } = render(<DubPackCard {...props} pack={{ ...pack, kind, distribution: "alist", aListPublic: true }} />);
  expect(screen.getByRole("article", { name: `${kind === "sample" ? "Sample" : "Dub"} Pack: Night Sessions` }))
    .toHaveClass("dub-card--alist", `media-kind--${kind}`);
  expect(screen.getByText("Public A-List")).toHaveClass("badge--accent");
  expect(screen.getByText("A-List release")).toBeVisible();
  rerender(<DubPackCard {...props} pack={{ ...pack, kind, distribution: "alist", status: "draft", items: [] }} />);
  expect(screen.getByRole("article")).toHaveClass("dub-card--alist");
  expect(screen.getByText("A-List")).toHaveClass("badge--accent");
  rerender(<DubPackCard {...props} pack={{ ...pack, kind }} />);
  expect(screen.getByRole("article")).not.toHaveClass("dub-card--alist");
  expect(screen.getByText("Worldwide")).not.toHaveClass("badge--accent");
});

it.each(["dub", "sample"] as const)("uses %s media colors and pauses/resumes without restarting the active pack", (kind) => {
  const onActivateQueue = vi.fn(() => true);
  const { rerender } = render(<DubPackCard {...props} pack={{ ...pack, kind }} activePackId="pack" nowPlayingId="1"
    isPlaying onActivateQueue={onActivateQueue} />);
  const pause = screen.getByRole("button", { name: "Pause pack" });
  expect(pause).toHaveClass("button--audio", `media-kind--${kind}`);
  fireEvent.click(pause);
  expect(props.onPlay).toHaveBeenLastCalledWith(pack.items[1].dub);
  expect(props.onPlayAll).not.toHaveBeenCalled();
  rerender(<DubPackCard {...props} pack={{ ...pack, kind }} activePackId="pack" nowPlayingId="1"
    isPlaying={false} onActivateQueue={onActivateQueue} />);
  fireEvent.click(screen.getByRole("button", { name: "Play all" }));
  expect(props.onPlay).toHaveBeenLastCalledWith(pack.items[1].dub);
  rerender(<DubPackCard {...props} pack={{ ...pack, kind }} activePackId="overlapping" nowPlayingId="1"
    isPlaying onActivateQueue={onActivateQueue} />);
  fireEvent.click(screen.getByRole("button", { name: "Play all" }));
  expect(props.onPlayAll).toHaveBeenLastCalledWith(pack.items.map(({ dub }) => dub), pack.id);
  fireEvent.click(screen.getByRole("button", { name: kind === "sample" ? "Show 2 samples" : "Show 2 tracks" }));
  const rows = screen.getByRole("list");
  expect(within(rows).getAllByRole("region").every((player) => player.classList.contains(`media-kind--${kind}`))).toBe(true);
});

it("keeps packs compact until expanded and uses ordered shared playlist cards", () => {
  render(<DubPackCard {...props} />);
  expect(screen.getByRole("heading", { name: pack.title })).toBeVisible();
  expect(screen.queryByRole("list", { name: "Night Sessions playlist" })).not.toBeInTheDocument();
  const toggle = screen.getByRole("button", { name: "Show 2 samples" });
  expect(toggle).toHaveClass("button--secondary");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(toggle).toHaveClass("button--audio", "media-kind--sample");
  const playlist = screen.getByRole("list", { name: "Night Sessions playlist" });
  expect(within(playlist).getAllByRole("article").map((card) => card.getAttribute("aria-label"))).toEqual(["Opening", "Closing"]);
  expect(within(playlist).getAllByText("F minor")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Play all" }));
  expect(props.onPlayAll).toHaveBeenCalledWith(pack.items.map(({ dub }) => dub), pack.id);
  const openPack = screen.getByRole("button", { name: "Open pack" });
  expect(openPack).toHaveClass("button--primary");
  fireEvent.click(openPack);
  expect(props.onOpenPack).toHaveBeenCalledWith(pack);
  fireEvent.click(screen.getByRole("button", { name: "Hide playlist" }));
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveClass("button--secondary");
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

it("shows only matching files while retaining pack order and an explicit full-pack action", () => {
  render(<DubPackCard {...props} matchingDubIds={new Set(["1"])} />);
  fireEvent.click(screen.getByRole("button", { name: "Show 2 samples" }));
  expect(screen.getByText(/1 sample matches your filters/)).toBeVisible();
  const playlist = screen.getByRole("list");
  expect(within(playlist).queryByRole("article", { name: "Opening" })).not.toBeInTheDocument();
  expect(within(playlist).getByLabelText("Track 2")).toBeVisible();
});

it("surfaces archive errors and blocks duplicate download requests", async () => {
  let fail!: (error: Error) => void;
  const onDownloadPack = vi.fn(() => new Promise<void>((_, reject) => { fail = reject; }));
  render(<DubPackCard {...props} onDownloadPack={onDownloadPack} />);
  const button = screen.getByRole("button", { name: "Download ZIP" });
  fireEvent.click(button); fireEvent.click(button);
  expect(onDownloadPack).toHaveBeenCalledOnce();
  expect(button).toBeDisabled();
  fail(new Error("Access has changed. Refresh this pack."));
  expect(await screen.findByRole("alert")).toHaveTextContent("Access has changed.");
  await waitFor(() => expect(button).not.toBeDisabled());
});

it.each(["dub", "sample"] as const)("activates the %s pack for all playlist controls, direct playback and seeking", (kind) => {
  const onActivateQueue = vi.fn().mockReturnValue(true);
  const onNext = vi.fn();
  const onPrevious = vi.fn();
  const onShuffleChange = vi.fn();
  const onRepeatChange = vi.fn();
  const onSeekProgress = vi.fn();
  render(<DubPackCard {...props} pack={{ ...pack, kind }} onActivateQueue={onActivateQueue}
    onNext={onNext} onPrevious={onPrevious} onShuffleChange={onShuffleChange} onRepeatChange={onRepeatChange}
    onSeekProgress={onSeekProgress} />);
  fireEvent.click(screen.getByRole("button", { name: kind === "sample" ? "Show 2 samples" : "Show 2 tracks" }));
  const controls = screen.getByRole("group", { name: "Night Sessions playback controls" });
  fireEvent.click(within(controls).getByRole("button", { name: "Next track" }));
  expect(onActivateQueue).toHaveBeenLastCalledWith(pack.items.map(({ dub }) => dub), pack.id);
  expect(onNext).toHaveBeenCalledOnce();
  fireEvent.click(within(controls).getByRole("button", { name: "Previous track" }));
  expect(onPrevious).toHaveBeenCalledOnce();
  fireEvent.click(within(controls).getByRole("button", { name: "Enable shuffle" }));
  expect(onShuffleChange).toHaveBeenCalledWith(true);
  fireEvent.click(within(controls).getByRole("button", { name: "Enable repeat" }));
  expect(onRepeatChange).toHaveBeenCalledWith(true);
  const track = screen.getByRole("article", { name: "Closing" });
  fireEvent.click(within(track).getByRole("button", { name: "Play" }));
  expect(props.onPlay).toHaveBeenCalledWith(pack.items[1].dub);
  fireEvent.keyDown(within(track).getByRole("slider", { name: "Closing playback progress" }), { key: "End" });
  expect(onSeekProgress).toHaveBeenCalledWith(1, pack.items[1].dub);
  expect(onActivateQueue).toHaveBeenCalledTimes(6);
});

it("does not run pack controls if queue activation reports unavailable files", () => {
  const onNext = vi.fn();
  render(<DubPackCard {...props} onActivateQueue={() => false} onNext={onNext} />);
  fireEvent.click(screen.getByRole("button", { name: "Show 2 samples" }));
  fireEvent.click(screen.getByRole("button", { name: "Next track" }));
  fireEvent.click(within(screen.getByRole("article", { name: "Closing" })).getByRole("button", { name: "Play" }));
  expect(onNext).not.toHaveBeenCalled();
  expect(props.onPlay).not.toHaveBeenCalled();
});

it.each(["dub", "sample"] as const)("composes a %s pack from DubCard with full controls while collapsed", (kind) => {
  const onActivateQueue = vi.fn(() => true);
  const onSeekProgress = vi.fn();
  const onVolumeChange = vi.fn();
  const { rerender } = render(<DubPackCard {...props} pack={{ ...pack, kind }} onActivateQueue={onActivateQueue}
    onSeekProgress={onSeekProgress} onVolumeChange={onVolumeChange} volume={0.4} />);
  const card = screen.getByRole("article", { name: `${kind === "sample" ? "Sample" : "Dub"} Pack: ${pack.title}` });
  expect(card).toHaveClass("dub-card", "dub-card--collection", "dub-pack-card");
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  const controls = screen.getByRole("group", { name: "Night Sessions playback controls" });
  expect(within(controls).getByRole("region", { name: "Audio player: Opening" })).toHaveClass("audio-player--full");
  for (const name of ["Previous track", "Next track", "Enable shuffle", "Enable repeat"]) {
    expect(within(controls).getByRole("button", { name })).toBeVisible();
  }
  fireEvent.click(within(controls).getByRole("button", { name: "Play" }));
  expect(props.onPlayAll).toHaveBeenCalledWith(pack.items.map(({ dub }) => dub), pack.id);
  fireEvent.keyDown(within(controls).getByRole("slider", { name: "Opening playback progress" }), { key: "End" });
  expect(onActivateQueue).toHaveBeenCalledTimes(2);
  expect(onSeekProgress).toHaveBeenCalledWith(1, pack.items[0].dub);
  const volume = within(controls).getByRole("slider", { name: "Volume" });
  expect(volume).toHaveValue("40");
  fireEvent.change(volume, { target: { value: "80" } });
  expect(onVolumeChange).toHaveBeenCalledWith(0.8);

  rerender(<DubPackCard {...props} pack={{ ...pack, kind }} nowPlayingId="1" isPlaying currentTimeSeconds={15}
    durationSeconds={60} onActivateQueue={onActivateQueue} onSeekProgress={onSeekProgress} />);
  expect(within(controls).getByRole("region", { name: "Audio player: Closing" })).toBeVisible();
  expect(within(controls).getByRole("slider", { name: "Closing playback progress" })).toHaveAttribute("aria-valuenow", "25");
  fireEvent.click(within(controls).getByRole("button", { name: "Pause" }));
  expect(props.onPlay).toHaveBeenCalledWith(pack.items[1].dub);
  fireEvent.click(screen.getByRole("button", { name: "Show 2 " + (kind === "sample" ? "samples" : "tracks") }));
  expect(screen.getAllByRole("button", { name: "Next track" })).toHaveLength(1);
});

it("disables draft controls, seeking and downloads without losing the playlist", () => {
  const onSeekProgress = vi.fn();
  render(<DubPackCard {...props} pack={{ ...pack, status: "draft" }} onSeekProgress={onSeekProgress}
    onActivateQueue={() => true} onDownloadPack={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Play all" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Download ZIP" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
  expect(screen.queryByRole("slider", { name: "Opening playback progress" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show 2 samples" }));
  const playlist = screen.getByRole("list");
  for (const button of within(playlist).getAllByRole("button")) expect(button).toBeDisabled();
  expect(onSeekProgress).not.toHaveBeenCalled();
});

it("retains empty packs without fabricating a track or player", () => {
  render(<DubPackCard {...props} pack={{ ...pack, items: [] }} />);
  expect(screen.getByRole("heading", { name: pack.title })).toBeVisible();
  expect(screen.getByRole("button", { name: "Play all" })).toBeDisabled();
  expect(screen.queryByRole("group", { name: "Night Sessions playback controls" })).not.toBeInTheDocument();
});
