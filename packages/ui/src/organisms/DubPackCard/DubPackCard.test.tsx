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

it("keeps packs compact until expanded and uses ordered shared playlist cards", () => {
  render(<DubPackCard {...props} />);
  expect(screen.getByRole("heading", { name: pack.title })).toBeVisible();
  expect(screen.queryByRole("list", { name: "Night Sessions playlist" })).not.toBeInTheDocument();
  const toggle = screen.getByRole("button", { name: "Show 2 samples" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  const playlist = screen.getByRole("list", { name: "Night Sessions playlist" });
  expect(within(playlist).getAllByRole("article").map((card) => card.getAttribute("aria-label"))).toEqual(["Opening", "Closing"]);
  expect(within(playlist).getAllByText("F minor")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Play all" }));
  expect(props.onPlayAll).toHaveBeenCalledWith(pack.items.map(({ dub }) => dub));
  fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
  expect(props.onOpenPack).toHaveBeenCalledWith(pack);
  fireEvent.click(screen.getByRole("button", { name: "Hide playlist" }));
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
  expect(onActivateQueue).toHaveBeenLastCalledWith(pack.items.map(({ dub }) => dub));
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
