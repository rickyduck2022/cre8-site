import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayback } from "../../../apps/web/src/hooks/useAudioPlayback";
import type { Dub } from "./templates/communityTypes";
import { AudioPlayer, type DubPack } from "@craft/ui";
import { PackWindows } from "../../../apps/web/src/components/PackWindows";
import { useCommunity } from "../../../apps/web/src/hooks/useCommunity";

vi.mock("../../../apps/web/src/hooks/useChatConnection", () => ({
  useChatConnection: () => "connected",
}));

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
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useAudioPlayback", () => {
  it("reports tutorial playback only after audio starts and an explicit pause of that track", async () => {
    const report = vi.fn();
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null, undefined, { onTutorialActivity: report }));
    expect(report).not.toHaveBeenCalled();
    const play = vi.spyOn(FakeAudio.latest, "play").mockRejectedValueOnce(new Error("Blocked"));
    await act(async () => result.current.togglePlayback(dubs[0]));
    expect(report).not.toHaveBeenCalled();
    play.mockRestore();
    await act(async () => result.current.togglePlayback(dubs[0]));
    expect(report).toHaveBeenLastCalledWith({ type: "playback-started", subjectId: "one" });
    act(() => result.current.togglePlayback(dubs[0]));
    expect(report).toHaveBeenLastCalledWith({ type: "playback-paused", subjectId: "one" });
    report.mockClear();
    act(() => result.current.pausePlayback());
    expect(report).not.toHaveBeenCalled();
  });
  it("plays owner-only draft files from the community catalog and stops when access disappears", async () => {
    let draftDubs = [dubs[1], dubs[2]];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      member: { id: "owner", username: "artist" },
      artists: [], dubs: [dubs[0]], draftDubs, packs: [], buddies: [], conversations: [],
      sharedDubIds: [], sharedPackIds: [], likedDubIds: [], suggestedMembers: [], crates: [], library: [], notifications: [],
      lastPlayback: null, windowWorkspace: null, aListApplication: null,
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const { result } = renderHook(() => useCommunity());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.dubs.map((dub) => dub.id)).toEqual(["one"]);
    act(() => result.current.playPack(draftDubs, "owner-draft"));
    expect(result.current.state).toMatchObject({ nowPlayingId: "two", isPlaying: true, queuePackId: "owner-draft" });
    act(() => result.current.playNextDub());
    expect(result.current.state).toMatchObject({ nowPlayingId: "three", isPlaying: true, queuePackId: "owner-draft" });
    draftDubs = [];
    await act(async () => { await result.current.refreshCommunity(); });
    expect(result.current.state.isPlaying).toBe(false);
    expect(FakeAudio.latest.paused).toBe(true);
  });

  it("selects the window queue in the main controller on playback and seek, preserving independent progress", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.activateWindowQueue([dubs[0], dubs[1]], "first"));
    act(() => result.current.togglePlayback(dubs[0]));
    act(() => FakeAudio.latest.loadMetadata(180));
    act(() => result.current.seekPlayback(42));
    act(() => result.current.selectPlayerContext("second", [dubs[2]], "second"));
    act(() => result.current.activateWindowQueue([dubs[0], dubs[1]], "first"));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "one", currentTime: 42, isPlaying: true, queuePackId: "first" });
    act(() => result.current.activateWindowQueue([dubs[2]], "second"));
    act(() => result.current.seekPlaybackProgress(0.5, dubs[2]));
    act(() => FakeAudio.latest.loadMetadata(180));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "three", currentTime: 90, queuePackId: "second" });
    act(() => result.current.activateWindowQueue([dubs[0], dubs[1]], "first"));
    act(() => FakeAudio.latest.loadMetadata(180));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "one", currentTime: 42, queuePackId: "first" });
  });

  it("selects window settings in the main player without interrupting another audible queue", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.activateWindowQueue([dubs[0]], "first"));
    act(() => result.current.togglePlayback(dubs[0]));
    act(() => result.current.setWindowSettings("second", { repeat: true, shuffle: true }, [dubs[1], dubs[2]]));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "one", repeat: false, shuffle: false, isPlaying: true });
    expect(result.current.state).toMatchObject({ nowPlayingId: "one", audibleContextId: "first", isPlaying: true });
    act(() => result.current.activateWindowQueue([dubs[1], dubs[2]], "second"));
    act(() => result.current.mainPlayer.togglePlayback(dubs[1]));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "two", queuePackId: "second", isPlaying: true, repeat: true });
  });

  it("suspends audible playback idempotently without clearing position or switching context", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.activateWindowQueue([dubs[0], dubs[1]], "studio"));
    act(() => result.current.togglePlayback(dubs[0]));
    act(() => FakeAudio.latest.loadMetadata(180));
    act(() => result.current.seekPlayback(42));
    act(() => { result.current.pausePlayback(); result.current.pausePlayback(); });
    expect(FakeAudio.latest.paused).toBe(true);
    expect(result.current.state).toMatchObject({ nowPlayingId: "one", currentTime: 42, isPlaying: false, audibleContextId: "studio" });
    expect(FakeAudio.latest.src).toBe("/audio/one");
  });

  it("keeps the global player on audible playback when focus moves between groups and outside", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.togglePlayback(dubs[2]));
    act(() => FakeAudio.latest.loadMetadata(180));
    act(() => result.current.seekPlayback(37));
    act(() => result.current.selectPlayerContext("first", [dubs[0], dubs[1]], "first"));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "three", isPlaying: true, queuePackId: null });
    expect(result.current.state).toMatchObject({ nowPlayingId: "three", isPlaying: true });
    expect(FakeAudio.latest.src).toBe("/audio/three");
    act(() => result.current.activateWindowQueue([dubs[0], dubs[1]], "first"));
    act(() => result.current.mainPlayer.togglePlayback(dubs[0]));
    act(() => FakeAudio.latest.loadMetadata(180));
    act(() => result.current.mainPlayer.seekPlayback(12));
    expect(result.current.state).toMatchObject({ nowPlayingId: "one", audibleContextId: "first", isPlaying: true });
    act(() => result.current.selectPlayerContext("second", [dubs[1]], "second"));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "one", currentTime: 12, isPlaying: true });
    expect(FakeAudio.latest.src).toBe("/audio/one");
    expect(FakeAudio.latest.paused).toBe(false);
    act(() => result.current.selectPlayerContext(null));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "one", currentTime: 12, isPlaying: true });
    expect(FakeAudio.latest.paused).toBe(false);
    act(() => result.current.activateGlobalContext());
    act(() => result.current.mainPlayer.togglePlayback(dubs[2]));
    act(() => FakeAudio.latest.loadMetadata(180));
    expect(FakeAudio.latest.currentTime).toBe(37);
    expect(result.current.state.audibleContextId).toBeNull();
    act(() => result.current.selectPlayerContext("first", [dubs[0], dubs[1]], "first"));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "three", currentTime: 37, isPlaying: true });
  });

  it("keeps tracklist queues and settings separate when switching the group controller", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.selectPlayerContext("first", [dubs[0], dubs[1]], "first"));
    act(() => result.current.mainPlayer.setRepeat(true));
    act(() => result.current.mainPlayer.togglePlayback(dubs[0]));
    act(() => result.current.mainPlayer.playNextDub());
    expect(result.current.state.nowPlayingId).toBe("two");
    act(() => result.current.mainPlayer.playNextDub());
    expect(result.current.state.nowPlayingId).toBe("one");
    act(() => result.current.selectPlayerContext("second", [dubs[2]], "second"));
    act(() => result.current.activateWindowQueue([dubs[2]], "second"));
    expect(result.current.mainPlayer.state.repeat).toBe(false);
    act(() => result.current.mainPlayer.togglePlayback(dubs[2]));
    act(() => result.current.mainPlayer.playNextDub());
    expect(result.current.state.nowPlayingId).toBe("three");
    act(() => result.current.selectPlayerContext("first", [dubs[0], dubs[1]], "first"));
    act(() => result.current.activateWindowQueue([dubs[0], dubs[1]], "first"));
    expect(result.current.mainPlayer.state.repeat).toBe(true);
    expect(result.current.mainPlayer.state.nowPlayingId).toBe("one");
    expect(result.current.mainPlayer.state.isPlaying).toBe(false);
  });

  it("does not confuse global pack playback with a window playing the same track", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.playQueue([dubs[0]], "pack"));
    act(() => FakeAudio.latest.loadMetadata(180));
    act(() => result.current.seekPlayback(40));
    act(() => result.current.activateWindowQueue([dubs[0]], "pack"));
    expect(result.current.state.currentTime).toBe(0);
    act(() => FakeAudio.latest.loadMetadata(180));
    act(() => result.current.seekPlayback(15));
    act(() => result.current.activateGlobalContext());
    act(() => FakeAudio.latest.loadMetadata(180));
    expect(FakeAudio.latest.currentTime).toBe(40);
    expect(result.current.state.queuePackId).toBe("pack");
    expect(result.current.state.audibleContextId).toBeNull();
    act(() => result.current.activateWindowQueue([dubs[0]], "pack"));
    act(() => FakeAudio.latest.loadMetadata(180));
    expect(FakeAudio.latest.currentTime).toBe(15);
  });

  it("clears pack identity when playing a standalone file that is also in the loaded pack", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.playQueue([dubs[0], dubs[1]], "pack"));
    expect(result.current.mainPlayer.state.queuePackId).toBe("pack");
    act(() => result.current.toggleSinglePlayback(dubs[1]));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "two", queuePackId: null, isPlaying: true });
    expect(result.current.state.audibleContextId).toBeNull();
    act(() => result.current.playNextDub());
    expect(result.current.state.nowPlayingId).toBe("three");
  });

  it("edits inactive global settings without hiding the window's audible player", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.togglePlayback(dubs[2]));
    act(() => result.current.activateWindowQueue([dubs[0]], "first"));
    act(() => result.current.togglePlayback(dubs[0]));
    act(() => result.current.setGlobalShuffle(true));
    act(() => result.current.setGlobalRepeat(true));
    act(() => result.current.selectPlayerContext(null));
    expect(result.current.mainPlayer.state).toMatchObject({ nowPlayingId: "one", shuffle: false, repeat: false, isPlaying: true });
    expect(result.current.state).toMatchObject({ nowPlayingId: "one", shuffle: false, repeat: false, isPlaying: true });
    expect(FakeAudio.latest.paused).toBe(false);
    expect(FakeAudio.latest.src).toBe("/audio/one");
  });

  it("synchronizes window players and the main controller without losing inactive window progress", () => {
    vi.stubGlobal("innerWidth", 1440);
    const packs: DubPack[] = ["first", "second"].map((id, index) => ({
      id, title: id, description: "", kind: index ? "sample" : "dub", status: "published",
      distribution: "worldwide", aListPublic: false, licence: "", ownerUsername: "artist",
      ownerDisplayName: "Artist", items: [{ dub: dubs[index] }, { dub: dubs[2] }],
      totalBytes: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01",
    }));
    function Players() {
      const engine = useAudioPlayback(dubs, vi.fn(), "user", null);
      const state = engine.state;
      const mainState = engine.mainPlayer.state;
      const track = dubs.find((dub) => dub.id === mainState.nowPlayingId);
      return <>
        <section aria-label="Main controller"><AudioPlayer track={track} playing={mainState.isPlaying}
          currentTimeSeconds={mainState.currentTime} durationSeconds={mainState.duration}
          onSeekProgress={(progress) => { if (track) engine.mainPlayer.seekPlaybackProgress(progress, track); }}
          onPlayChange={() => { if (track) engine.mainPlayer.togglePlayback(track); }} /></section>
        <PackWindows windows={packs.map((pack) => ({ pack, openRequest: 0 }))} stack={["first", "second"]}
          username="artist" authenticated playback={state} activePackId={state.queuePackId}
          contexts={state.packContexts} onActivateWindowQueue={engine.activateWindowQueue}
          onWindowSettingsChange={engine.setWindowSettings}
          onPlay={engine.togglePlayback} onPlayAll={engine.playQueue} onSeek={engine.seekPlaybackProgress}
          onVolume={engine.setVolume} onPrevious={engine.playPreviousDub} onNext={engine.playNextDub}
          shuffle={state.shuffle} repeat={state.repeat} onShuffleChange={engine.setShuffle} onRepeatChange={engine.setRepeat}
          onDownloadDub={async () => {}} onCommunityChange={async () => {}}
          onActivate={vi.fn()} onClose={vi.fn()} onEdit={vi.fn()} />
      </>;
    }
    render(<Players />);
    const first = within(screen.getByRole("region", { name: "first window player" }));
    const second = within(screen.getByRole("region", { name: "second window player" }));
    const main = within(screen.getByRole("region", { name: "Main controller" }));
    expect(first.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    expect(second.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    fireEvent.click(first.getByRole("button", { name: "Play", exact: true }));
    act(() => FakeAudio.latest.loadMetadata(180));
    act(() => { FakeAudio.latest.currentTime = 42; FakeAudio.latest.dispatchEvent(new Event("timeupdate")); });
    expect(main.getByRole("region", { name: "Audio player: one" })).toBeVisible();
    expect(first.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    fireEvent.click(second.getByRole("button", { name: "Enable repeat" }));
    expect(first.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    expect(second.getByRole("button", { name: "Disable repeat" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Play audio in Sample Pack: second", exact: true }));
    expect(main.getByRole("region", { name: "Audio player: two" })).toBeVisible();
    expect(first.getByText("00:42")).toBeVisible();
    expect(first.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    expect(screen.getByRole("status", { name: "Playing audio in Sample Pack: second or its tabs" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Play audio in Dub Pack: first", exact: true }));
    act(() => FakeAudio.latest.loadMetadata(180));
    expect(FakeAudio.latest.currentTime).toBe(42);
    fireEvent.keyDown(main.getByRole("slider", { name: "one playback progress" }), { key: "ArrowRight" });
    expect(FakeAudio.latest.currentTime).toBeCloseTo(43.8);
    expect(screen.getByRole("region", { name: "Minimized window: Dub Pack: first" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Restore Dub Pack: first", exact: true }));
    expect(first.getByText("00:43")).toBeVisible();
    fireEvent.click(main.getByRole("button", { name: "Pause", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Restore Dub Pack: first", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Restore Sample Pack: second", exact: true }));
    expect(first.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    expect(second.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    fireEvent.click(first.getByRole("button", { name: "Next track" }));
    expect(main.getByRole("region", { name: "Audio player: three" })).toBeVisible();
    expect(first.getByRole("region", { name: "Audio player: three" })).toBeVisible();
  });
  it("remembers each window's track, position and modes while sharing one audible engine", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => {
      result.current.activateWindowQueue([dubs[0], dubs[1]], "first");
      result.current.togglePlayback(dubs[0]);
    });
    const audio = FakeAudio.latest;
    act(() => audio.loadMetadata(180));
    act(() => result.current.seekPlayback(42));
    act(() => result.current.setShuffle(true));
    act(() => result.current.setRepeat(true));
    act(() => {
      result.current.activateWindowQueue([dubs[0], dubs[2]], "second");
      result.current.togglePlayback(dubs[0]);
    });
    expect(FakeAudio.latest).toBe(audio);
    expect(result.current.state.queuePackId).toBe("second");
    expect(result.current.state.shuffle).toBe(false);
    expect(result.current.state.repeat).toBe(false);
    expect(result.current.state.packContexts.first).toMatchObject({
      nowPlayingId: "one", currentTime: 42, isPlaying: false, shuffle: true, repeat: true,
    });
    act(() => audio.loadMetadata(180));
    act(() => result.current.seekPlayback(12));
    act(() => {
      result.current.activateWindowQueue([dubs[0], dubs[1]], "first");
      result.current.togglePlayback(dubs[0]);
    });
    act(() => audio.loadMetadata(180));
    expect(audio.currentTime).toBe(42);
    expect(result.current.state).toMatchObject({ queuePackId: "first", isPlaying: true, shuffle: true, repeat: true });
    expect(result.current.state.packContexts.second).toMatchObject({ currentTime: 12, isPlaying: false });
    act(() => result.current.togglePlayback(dubs[0]));
    expect(result.current.state.isPlaying).toBe(false);
    act(() => result.current.togglePlayback(dubs[0]));
    expect(audio.currentTime).toBe(42);
    expect(result.current.state.isPlaying).toBe(true);
  });

  it("resumes a window after standalone playback and drops inaccessible remembered tracks", () => {
    const error = vi.fn();
    const { result } = renderHook(() => useAudioPlayback(dubs, error, "user", null));
    act(() => {
      result.current.activateWindowQueue([dubs[0], dubs[1]], "pack");
      result.current.togglePlayback(dubs[0]);
    });
    act(() => FakeAudio.latest.loadMetadata(180));
    act(() => result.current.seekPlayback(30));
    act(() => result.current.togglePlayback(dubs[2]));
    expect(result.current.state.queuePackId).toBeNull();
    act(() => result.current.activateWindowQueue([dubs[0], dubs[1]], "pack"));
    act(() => FakeAudio.latest.loadMetadata(180));
    expect(result.current.state.nowPlayingId).toBe("one");
    expect(FakeAudio.latest.currentTime).toBe(30);
    act(() => result.current.togglePlayback(dubs[2]));
    act(() => result.current.activateWindowQueue([dubs[1]], "pack"));
    expect(result.current.state.nowPlayingId).toBe("two");
    expect(result.current.state.currentTime).toBe(0);
    act(() => result.current.reset());
    expect(result.current.state.packContexts).toEqual({});
    expect(error).not.toHaveBeenCalled();
  });
  it("keeps standalone Next/Previous and shuffle inside the current media kind without changing pack scope", () => {
    const sample = { ...dubs[1], mediaKind: "sample" as const };
    const { result } = renderHook(() => useAudioPlayback([dubs[0], sample, dubs[2]], vi.fn(), "user", null));
    act(() => result.current.togglePlayback(dubs[0]));
    act(() => result.current.playNextDub());
    expect(result.current.state.nowPlayingId).toBe("three");
    act(() => result.current.playPreviousDub());
    expect(result.current.state.nowPlayingId).toBe("one");
    act(() => result.current.togglePlayback(sample));
    act(() => result.current.setShuffle(true));
    act(() => result.current.playNextDub());
    expect(result.current.state.nowPlayingId).toBe("two");
    act(() => result.current.setShuffle(false));
    act(() => result.current.playQueue([dubs[0], sample], "mixed"));
    act(() => result.current.playNextDub());
    expect(result.current.state.nowPlayingId).toBe("two");
  });
  it("tracks the selected pack identity even for overlapping packs and clears it outside the queue", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.playQueue([dubs[0], dubs[2]], "first"));
    expect(result.current.state.queuePackId).toBe("first");
    act(() => result.current.activateQueue([dubs[0], dubs[2]], "second"));
    expect(result.current.state.queuePackId).toBe("second");
    act(() => result.current.togglePlayback(dubs[1]));
    expect(result.current.state.queuePackId).toBeNull();
    act(() => result.current.playQueue([dubs[0]], "first"));
    act(() => result.current.closePlayer());
    expect(result.current.state.queuePackId).toBeNull();
  });
  it("preserves shuffle selected before Play all and starts inside the pack", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.setShuffle(true));
    act(() => result.current.playQueue([dubs[0], dubs[2]]));
    expect(result.current.state.shuffle).toBe(true);
    expect(FakeAudio.latest.src).toBe("/audio/three");
    act(() => FakeAudio.latest.dispatchEvent(new Event("ended")));
    expect(FakeAudio.latest.src).toBe("/audio/one");
  });

  it("keeps a single-file pack scoped when shuffled and stops without repeat", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.playQueue([dubs[2]]));
    act(() => result.current.setShuffle(true));
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.src).toBe("/audio/three");
    act(() => {
      FakeAudio.latest.paused = true;
      FakeAudio.latest.dispatchEvent(new Event("ended"));
    });
    expect(result.current.state.isPlaying).toBe(false);
    act(() => result.current.setRepeat(true));
    act(() => FakeAudio.latest.dispatchEvent(new Event("ended")));
    expect(result.current.state.isPlaying).toBe(true);
    expect(FakeAudio.latest.loop).toBe(false);
    expect(FakeAudio.latest.src).toBe("/audio/three");
  });

  it("rejects incomplete queues explicitly without replacing a valid active pack", () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useAudioPlayback(dubs, onError, "user", null));
    act(() => result.current.playQueue([dubs[0], dubs[2]]));
    act(() => {
      expect(result.current.activateQueue([dubs[0], { ...dubs[1], id: "removed" }])).toBe(false);
      expect(result.current.activateWindowQueue([dubs[0], { ...dubs[1], id: "removed" }], "missing")).toBe(false);
    });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("Some pack files are unavailable"), "error");
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.src).toBe("/audio/three");
  });

  it("activates a queue when seeking into a pack track and retains its scope", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => {
      result.current.activateQueue([dubs[0], dubs[2]]);
      result.current.seekPlaybackProgress(0.5, dubs[0]);
    });
    act(() => FakeAudio.latest.loadMetadata(100));
    expect(FakeAudio.latest.currentTime).toBe(50);
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.src).toBe("/audio/three");
  });

  it("scopes direct track playback and manual navigation without starting at the first track", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => {
      result.current.activateQueue([dubs[0], dubs[2]]);
      result.current.togglePlayback(dubs[2]);
    });
    expect(FakeAudio.latest.src).toBe("/audio/three");
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.src).toBe("/audio/one");
    act(() => result.current.playPreviousDub());
    expect(FakeAudio.latest.src).toBe("/audio/three");
  });

  it("loops the whole pack instead of setting native single-track looping", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.playQueue([dubs[0], dubs[2]]));
    act(() => result.current.setRepeat(true));
    expect(FakeAudio.latest.loop).toBe(false);
    act(() => FakeAudio.latest.dispatchEvent(new Event("ended")));
    expect(FakeAudio.latest.src).toBe("/audio/three");
    act(() => FakeAudio.latest.dispatchEvent(new Event("ended")));
    expect(FakeAudio.latest.src).toBe("/audio/one");
    act(() => result.current.togglePlayback(dubs[1]));
    expect(FakeAudio.latest.loop).toBe(true);
  });

  it("shuffles every pack track once, supports history, and stops without looping", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => {
      result.current.activateQueue([dubs[0], dubs[2]]);
      result.current.togglePlayback(dubs[2]);
    });
    act(() => result.current.setShuffle(true));
    act(() => FakeAudio.latest.dispatchEvent(new Event("ended")));
    expect(FakeAudio.latest.src).toBe("/audio/one");
    act(() => {
      FakeAudio.latest.paused = true;
      FakeAudio.latest.dispatchEvent(new Event("ended"));
    });
    expect(result.current.state.isPlaying).toBe(false);
    expect(FakeAudio.latest.src).toBe("/audio/one");
    act(() => result.current.playPreviousDub());
    expect(FakeAudio.latest.src).toBe("/audio/three");
  });

  it("loops shuffled packs and can switch between packs sharing the current dub", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.playQueue([dubs[0], dubs[2]]));
    act(() => result.current.setShuffle(true));
    act(() => result.current.setRepeat(true));
    act(() => FakeAudio.latest.dispatchEvent(new Event("ended")));
    expect(FakeAudio.latest.src).toBe("/audio/three");
    act(() => FakeAudio.latest.dispatchEvent(new Event("ended")));
    expect(FakeAudio.latest.src).toBe("/audio/one");
    act(() => result.current.activateQueue([dubs[0], dubs[1]]));
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.src).toBe("/audio/two");
  });

  it("does not silently start a partial pack queue", () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useAudioPlayback([dubs[0]], notify, "user", null));
    act(() => result.current.playQueue([dubs[0], dubs[1]]));
    expect(result.current.state.nowPlayingId).toBeNull();
    expect(notify).toHaveBeenCalledWith("Some pack files are unavailable. Refresh the pack before playing it.", "error");
  });
  it("plays an explicit pack queue in order and stops after its last file", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.playQueue([dubs[2], dubs[0]]));
    expect(FakeAudio.latest.src).toBe("/audio/three");
    act(() => FakeAudio.latest.dispatchEvent(new Event("ended")));
    expect(FakeAudio.latest.src).toBe("/audio/one");
    act(() => {
      FakeAudio.latest.paused = true;
      FakeAudio.latest.dispatchEvent(new Event("ended"));
    });
    expect(FakeAudio.latest.src).toBe("/audio/one");
    expect(result.current.state.isPlaying).toBe(false);
    act(() => result.current.togglePlayback(dubs[1]));
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.src).toBe("/audio/three");
  });
  it.each(["seconds", "progress"])("clears the pack queue when seeking outside it using %s", (mode) => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", null));
    act(() => result.current.playQueue([dubs[0]]));
    act(() => {
      if (mode === "seconds") result.current.seekPlayback(20, dubs[1]);
      else result.current.seekPlaybackProgress(0.5, dubs[1]);
    });
    expect(FakeAudio.latest.src).toBe("/audio/two");
    act(() => result.current.playNextDub());
    expect(FakeAudio.latest.src).toBe("/audio/three");
  });
  it("supports standalone playback without persistence or automatic queue advancement", async () => {
    const notify = vi.fn();
    const { result, unmount } = renderHook(() => useAudioPlayback(dubs, notify, undefined, null, undefined, { autoAdvance: false }));
    await act(async () => result.current.togglePlayback(dubs[0]));
    act(() => FakeAudio.latest.loadMetadata(180));
    act(() => {
      FakeAudio.latest.currentTime = 180;
      FakeAudio.latest.paused = true;
      FakeAudio.latest.dispatchEvent(new Event("ended"));
    });
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.nowPlayingId).toBe("one");
    expect(FakeAudio.latest.src).toBe("/audio/one");
    expect(notify).not.toHaveBeenCalled();
    unmount();
    expect(FakeAudio.latest.paused).toBe(true);
    expect(FakeAudio.latest.src).toBe("");
  });

  it("closes playback without restoring it on refresh and preserves listening preferences", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const savedPosition = { dubId: "one", positionSeconds: 42 };
    const { result, rerender } = renderHook(
      ({ tracks }) => useAudioPlayback(tracks, vi.fn(), "user", savedPosition, save),
      { initialProps: { tracks: dubs } },
    );
    act(() => FakeAudio.latest.loadMetadata(180));
    act(() => {
      result.current.setVolume(0.4);
      result.current.setShuffle(true);
      result.current.setRepeat(true);
      result.current.togglePlayback(dubs[0]);
    });
    await act(async () => result.current.closePlayer());
    expect(FakeAudio.latest.paused).toBe(true);
    expect(FakeAudio.latest.src).toBe("");
    expect(result.current.state).toMatchObject({
      nowPlayingId: null, isPlaying: false, volume: 0.4, shuffle: true, repeat: true,
    });
    expect(save).toHaveBeenLastCalledWith(savedPosition);
    rerender({ tracks: [...dubs] });
    expect(result.current.state.nowPlayingId).toBeNull();
    act(() => result.current.togglePlayback(dubs[1]));
    expect(result.current.state.nowPlayingId).toBe("two");
    expect(FakeAudio.latest.paused).toBe(false);
  });

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

  it("preserves restored playback progress when restoring the same window track", () => {
    const { result } = renderHook(() => useAudioPlayback(dubs, vi.fn(), "user", { dubId: "two", positionSeconds: 42 }));
    act(() => result.current.restoreWindowTrack(dubs[1]));
    act(() => FakeAudio.latest.loadMetadata(100));
    expect(FakeAudio.latest.currentTime).toBe(42);
    expect(result.current.state.currentTime).toBe(42);
    expect(FakeAudio.latest.paused).toBe(true);
    act(() => result.current.restoreWindowTrack(dubs[0]));
    expect(result.current.state.nowPlayingId).toBe("one");
    expect(result.current.state.currentTime).toBe(0);
    expect(FakeAudio.latest.paused).toBe(true);
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
