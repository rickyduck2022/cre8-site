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
  expect(screen.getByText(/Short previews only/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Edit pack" })).not.toBeInTheDocument();
  const controls = screen.getByRole("group", { name: "Toolkit playback controls" });
  fireEvent.click(within(controls).getByRole("button", { name: "Next track" }));
  expect(playback.activateQueue).toHaveBeenCalledWith([expect.objectContaining({ id: "one" })]);
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
