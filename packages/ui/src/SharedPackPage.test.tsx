import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SharedPackPage } from "../../../apps/web/src/components/SharedPackPage";

const playback = vi.hoisted(() => ({ activateQueue: vi.fn(() => true), playNextDub: vi.fn(), setRepeat: vi.fn() }));
vi.mock("../../../apps/web/src/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    state: { nowPlayingId: null, isPlaying: false, currentTime: 0, duration: 0, volume: 0.7, playbackError: null },
    togglePlayback: vi.fn(), playQueue: vi.fn(), seekPlaybackProgress: vi.fn(), setVolume: vi.fn(),
    ...playback, playPreviousDub: vi.fn(), setShuffle: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

it("shows sample licence and guest previews, then returns downloads through sign-in", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    status: 200, ok: true, json: async () => ({
      authenticated: false, pack: {
        id: "pack", title: "Toolkit", kind: "sample", description: "", status: "published",
        distribution: "worldwide", ownerUsername: "amber", ownerDisplayName: "Amber", totalBytes: 1200,
        licence: "Original productions only; no standalone resale.",
        items: [{ key: "F minor", dub: {
          id: "one", title: "Texture", artist: "Amber", duration: "00:30", bpm: 174,
          audioUrl: "/api/public/dubs/one/audio", artwork: "", distribution: "worldwide",
        } }],
      },
    }),
  }));
  render(<SharedPackPage packId="pack" />);
  expect(await screen.findByRole("heading", { name: "Toolkit" })).toBeVisible();
  expect(screen.getByText("Original productions only; no standalone resale.")).toBeVisible();
  expect(screen.getByRole("region", { name: "Preview limitations" })).toHaveTextContent("First 30 seconds maximum");
  expect(screen.getByText("256 kbps WAV")).toBeVisible();
  expect(screen.getByText(/Preview.*00:30 maximum.*reduced quality/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Sign in to listen in full" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Edit pack" })).not.toBeInTheDocument();
  const controls = screen.getByRole("group", { name: "Toolkit playback controls" });
  fireEvent.click(within(controls).getByRole("button", { name: "Next track" }));
  expect(playback.activateQueue).toHaveBeenCalledWith([expect.objectContaining({ id: "one" })], "pack");
  expect(playback.playNextDub).toHaveBeenCalledOnce();
  fireEvent.click(within(controls).getByRole("button", { name: "Enable repeat" }));
  expect(playback.setRepeat).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Sign in to download pack" }));
  expect(window.location.hash).toBe("#sign-in?pack=pack");
});

it("shows unavailable private packs without leaking their files and offers retry/sign-in", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    status: 404, ok: false, json: async () => ({ error: "Pack not found." }),
  }));
  render(<SharedPackPage packId="private" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Pack not found.");
  expect(screen.queryByRole("list", { name: "Pack tracks" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(window.location.hash).toBe("#sign-in?pack=private");
});

it.each([false, true])("distinguishes per-file preview lengths from original playback (authenticated=%s)", async (authenticated) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    status: 200, ok: true, json: async () => ({
      authenticated, pack: {
        id: "mixed", title: "Mixed lengths", kind: "dub", status: "published",
        distribution: "worldwide", ownerUsername: "amber", ownerDisplayName: "Amber", totalBytes: 1048576,
        items: [
          { dub: { id: "short", title: "Short file", artist: "Amber", duration: "00:02", previewSeconds: 60, artwork: "", distribution: "worldwide" } },
          { dub: { id: "long", title: "Long file", artist: "Amber", duration: authenticated ? "04:00" : "01:30", previewSeconds: 90, artwork: "", distribution: "worldwide" } },
        ],
      },
    }),
  }));
  render(<SharedPackPage packId="mixed" />);
  await screen.findByRole("heading", { name: "Mixed lengths" });
  if (authenticated) {
    expect(screen.getByText("2 tracks · 4:02 · 1.0 MB")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Preview limitations" })).not.toBeInTheDocument();
    expect(screen.queryByText(/maximum.*reduced quality/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download pack (ZIP)" })).toBeVisible();
  } else {
    expect(screen.getByText("2 tracks · 1:32 of previews · 1.0 MB full download")).toBeVisible();
    expect(screen.getByRole("region", { name: "Preview limitations" })).toHaveTextContent("Each file is shortened to its preview length");
    expect(screen.getByText(/Preview.*00:02 maximum.*reduced quality/)).toBeVisible();
    expect(screen.getByText(/Preview.*01:30 maximum.*reduced quality/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sign in to listen in full" }));
    expect(window.location.hash).toBe("#sign-in?pack=mixed");
  }
});
