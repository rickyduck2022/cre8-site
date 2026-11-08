import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayback } from "../../../apps/web/src/hooks/useAudioPlayback";
import type { Dub } from "./templates/communityTypes";

class FakeAudio extends EventTarget {
  static latest: FakeAudio;
  dataset: Record<string, string> = {};
  preload = "";
  volume = 1;
  loop = false;
  paused = true;
  currentTime = 0;
  duration = NaN;
  readyState = 0;
  private source = "";
  constructor() { super(); FakeAudio.latest = this; }
  set src(value: string) { this.source = value; this.currentTime = 0; this.duration = NaN; this.readyState = 0; }
  get src() { return this.source; }
  play() { this.paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
  pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
  removeAttribute(name: string) { if (name === "src") this.source = ""; }
  loadMetadata(duration: number) {
    this.duration = duration;
    this.readyState = 1;
    this.dispatchEvent(new Event("loadedmetadata"));
  }
}

const dubs: Dub[] = ["one", "two", "three"].map((id) => ({
  id, title: id, artist: "artist", uploader: "artist", uploaderDisplayName: "Artist",
  uploadedAt: "2026-01-01", bpm: 0, genre: "Jungle", duration: "03:00",
  likes: 0, downloads: 0, artwork: "whitelabel", message: "", audioUrl: `/audio/${id}`,
}));

beforeEach(() => {
  vi.stubGlobal("Audio", FakeAudio);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useAudioPlayback", () => {
  it("keeps adjacent playback within the current tier and stops when access is revoked", () => {
    const tracks: Dub[] = [
      { ...dubs[0], distribution: "worldwide" },
      { ...dubs[1], distribution: "private" },
      { ...dubs[2], distribution: "worldwide" },
    ];
    const notify = vi.fn();
    const { result, rerender } = renderHook(
      ({ available }: { available: Dub[] }) => useAudioPlayback(available, notify, "user", null, vi.fn().mockResolvedValue(undefined)),
      { initialProps: { available: tracks } },
    );
    act(() => result.current.togglePlayback(tracks[0]));
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.src).toBe("/audio/three");
    act(() => result.current.togglePlayback(tracks[1]));
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.src).toBe("/audio/two");
    rerender({ available: [tracks[0], tracks[2]] });
    expect(FakeAudio.latest.paused).toBe(true);
    expect(FakeAudio.latest.src).toBe("");
    expect(result.current.state.nowPlayingId).toBeNull();
    expect(notify).toHaveBeenCalledWith("Playback stopped because this dub is no longer available.", "error");
    act(() => result.current.togglePlayback(tracks[1]));
    expect(FakeAudio.latest.src).toBe("");
  });

  it("restores a saved track paused and seeks after metadata loads", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", { dubId: "two", positionSeconds: 42 }, save));
    const audio = FakeAudio.latest;
    expect(result.current.state.nowPlayingId).toBe("two");
    expect(result.current.state.currentTime).toBe(42);
    expect(audio.paused).toBe(true);
    act(() => audio.loadMetadata(100));
    expect(audio.currentTime).toBe(42);
    expect(save).not.toHaveBeenCalled();
  });

  it("seeks a different track, navigates, shuffles with history and advances on end", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null, save));
    const audio = FakeAudio.latest;
    act(() => result.current.seekPlayback(80, dubs[1]));
    expect(audio.src).toBe("/audio/two");
    expect(result.current.state.currentTime).toBe(80);
    act(() => audio.loadMetadata(60));
    expect(audio.currentTime).toBe(60);
    act(() => result.current.playNextDub());
    expect(audio.src).toBe("/audio/three");
    act(() => result.current.playPreviousDub());
    expect(audio.src).toBe("/audio/two");
    act(() => result.current.setShuffle(true));
    vi.spyOn(Math, "random").mockReturnValue(0);
    act(() => result.current.playNextDub());
    expect(audio.src).toBe("/audio/one");
    act(() => result.current.playPreviousDub());
    expect(audio.src).toBe("/audio/two");
    act(() => audio.dispatchEvent(new Event("ended")));
    expect(audio.src).toBe("/audio/one");
    await act(async () => { await result.current.flushPosition(); });
    expect(save).toHaveBeenLastCalledWith({ dubId: "one", positionSeconds: 0 });
  });

  it("saves pause and reports persistence failures", async () => {
    const notify = vi.fn();
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAudioPlayback(dubs, notify, "user", null, save));
    act(() => result.current.togglePlayback(dubs[0]));
    act(() => FakeAudio.latest.loadMetadata(120));
    act(() => { FakeAudio.latest.currentTime = 15; result.current.togglePlayback(dubs[0]); });
    await act(async () => { await result.current.flushPosition(); });
    expect(save).toHaveBeenCalledWith({ dubId: "one", positionSeconds: 15 });
    expect(notify).toHaveBeenCalledWith("Unable to save playback position: offline", "error");
  });

  it("uses the actual duration for a waveform seek even when it was unknown", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null, save));
    const audio = FakeAudio.latest;
    act(() => result.current.seekPlaybackProgress(0.75, dubs[2]));
    expect(audio.src).toBe("/audio/three");
    expect(audio.paused).toBe(false);
    expect(save).not.toHaveBeenCalled();
    act(() => audio.loadMetadata(100.8));
    expect(audio.currentTime).toBeCloseTo(75.6);
    await act(async () => { await result.current.flushPosition(); });
    expect(save).toHaveBeenLastCalledWith({ dubId: "three", positionSeconds: expect.closeTo(75.6) });
  });

  it("applies repeat and skips unavailable tracks", () => {
    const tracks = [{ ...dubs[0], audioUrl: undefined }, dubs[1]];
    const { result } = renderHook(() => useAudioPlayback(tracks, vi.fn(), "user", null, vi.fn().mockResolvedValue(undefined)));
    act(() => result.current.setRepeat(true));
    expect(FakeAudio.latest.loop).toBe(true);
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.src).toBe("/audio/two");
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.paused).toBe(false);
    expect(FakeAudio.latest.src).toBe("/audio/two");
  });

  it("reports an unavailable audio file without replacing the current track", () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useAudioPlayback(dubs, notify, "user", null, vi.fn().mockResolvedValue(undefined)));
    act(() => result.current.togglePlayback(dubs[0]));
    act(() => result.current.togglePlayback({ ...dubs[1], audioUrl: undefined }));
    expect(FakeAudio.latest.src).toBe("/audio/one");
    expect(notify).toHaveBeenCalledWith("The audio file for two is unavailable.", "error");
  });

  it("does not send queued saves after the player is reset", async () => {
    let finishSave: () => void = () => undefined;
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve; }))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null, save));
    act(() => result.current.togglePlayback(dubs[0]));
    await act(async () => { await Promise.resolve(); });
    act(() => result.current.playNextDub());
    act(() => result.current.reset());
    await act(async () => { finishSave(); await result.current.flushPosition(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ dubId: "one", positionSeconds: 0 });
  });
});
