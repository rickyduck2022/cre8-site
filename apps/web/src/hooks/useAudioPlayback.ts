import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import type { Dub, TutorialActivity } from "@craft/ui";

export interface PlaybackPosition {
  dubId: string;
  positionSeconds: number;
}

export interface PlaybackState {
  queuePackId: string | null;
  nowPlayingId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  playbackError: string | null;
}

interface PackPlaybackContext {
  playback: PlaybackState;
  queue: string[] | null;
  history: string[];
  visited: string[];
  progress: number | null;
}

const initialPlaybackState: PlaybackState = {
  queuePackId: null,
  nowPlayingId: null, isPlaying: false, currentTime: 0, duration: 0,
  volume: 0.7, shuffle: false, repeat: false, playbackError: null,
};

export function useAudioPlayback(
  dubs: Dub[],
  onError: (message: string, type?: "error") => void,
  userId: string | undefined,
  savedPosition: PlaybackPosition | null,
  savePosition?: (position: PlaybackPosition) => Promise<void>,
  { autoAdvance = true, onTutorialActivity }: { autoAdvance?: boolean; onTutorialActivity?: (activity: TutorialActivity) => void } = {},
) {
  const [playback, setPlaybackState] = useState(initialPlaybackState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dubsRef = useRef(dubs);
  const stateRef = useRef(playback);
  const onErrorRef = useRef(onError);
  const saveRef = useRef(savePosition);
  const autoAdvanceRef = useRef(autoAdvance);
  const tutorialActivity = useRef(onTutorialActivity);
  tutorialActivity.current = onTutorialActivity;
  const pendingSeek = useRef<number | null>(null);
  const pendingProgress = useRef<number | null>(null);
  const restoredUser = useRef<string | undefined>(undefined);
  const history = useRef<string[]>([]);
  const queue = useRef<string[] | null>(null);
  const queuePackId = useRef<string | null>(null);
  const contexts = useRef<Record<string, PackPlaybackContext>>({});
  const globalContext = useRef<PackPlaybackContext | null>(null);
  const [globalPlayback, setGlobalPlayback] = useState<PlaybackState | null>(null);
  const activeWindowId = useRef<string | null>(null);
  const [audibleContextId, setAudibleContextId] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<{ id: string | null; tracks: Dub[]; packId?: string }>({ id: null, tracks: [] });
  const selectedContextId = playback.nowPlayingId ? audibleContextId : selectedContext.id;
  const [packContexts, setPackContexts] = useState<Record<string, PlaybackState>>({});
  const visited = useRef(new Set<string>());
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const sessionGeneration = useRef(0);
  const trackGeneration = useRef(0);
  dubsRef.current = dubs;
  stateRef.current = playback;
  const setPlayback = useCallback((update: SetStateAction<PlaybackState>) => {
    const next = typeof update === "function" ? update(stateRef.current) : update;
    stateRef.current = next;
    setPlaybackState(next);
  }, []);
  onErrorRef.current = onError;
  saveRef.current = savePosition;
  autoAdvanceRef.current = autoAdvance;

  function rememberPack() {
    const id = activeWindowId.current;
    const audio = audioRef.current;
    const snapshot = { ...stateRef.current, queuePackId: queuePackId.current,
      nowPlayingId: audio?.dataset.dubId ?? null,
      currentTime: pendingSeek.current ?? audio?.currentTime ?? 0, isPlaying: false };
    const context = { playback: snapshot, queue: queue.current ? [...queue.current] : null,
      history: [...history.current], visited: [...visited.current], progress: pendingProgress.current };
    if (id) {
      contexts.current[id] = context;
      setPackContexts((current) => ({ ...current, [id]: snapshot }));
    } else {
      globalContext.current = context;
      setGlobalPlayback(snapshot);
    }
  }

  function persistPosition() {
    if (!saveRef.current) return saveQueue.current;
    const audio = audioRef.current;
    const dubId = audio?.dataset.dubId;
    if (!audio || !dubId || pendingProgress.current !== null || !Number.isFinite(audio.currentTime)) return saveQueue.current;
    const position = { dubId, positionSeconds: Math.max(0, pendingSeek.current ?? audio.currentTime) };
    const generation = sessionGeneration.current;
    saveQueue.current = saveQueue.current.then(() => {
      if (generation === sessionGeneration.current) return saveRef.current?.(position);
    }).catch((error: unknown) => {
      if (generation !== sessionGeneration.current) return;
      onErrorRef.current(`Unable to save playback position: ${error instanceof Error ? error.message : "Request failed."}`, "error");
    });
    return saveQueue.current;
  }

  function startTrack(dub: Dub, positionSeconds = 0, autoplay = true, progress: number | null = null) {
    const audio = audioRef.current;
    if (!audio) { onErrorRef.current("Audio playback is not ready yet. Please try again.", "error"); return; }
    if (!dubsRef.current.some((item) => item.id === dub.id)) {
      onErrorRef.current("This dub is no longer available.", "error");
      return;
    }
    if (!dub.audioUrl) {
      const message = `The audio file for ${dub.title} is unavailable.`;
      setPlayback((current) => ({ ...current, playbackError: message }));
      onErrorRef.current(message, "error");
      return;
    }
    const generation = ++trackGeneration.current;
    audio.pause();
    audio.dataset.dubId = dub.id;
    if (queue.current) visited.current.add(dub.id);
    pendingSeek.current = positionSeconds;
    pendingProgress.current = progress;
    audio.src = dub.audioUrl;
    setPlayback((current) => ({
      ...current, nowPlayingId: dub.id, isPlaying: false,
      currentTime: positionSeconds, duration: 0, playbackError: null,
    }));
    if (autoplay) {
      void audio.play().then(() => {
        if (generation === trackGeneration.current && !audio.paused) tutorialActivity.current?.({ type: "playback-started", subjectId: dub.id });
      }).catch(() => {
        if (generation !== trackGeneration.current) return;
        const message = `Unable to play ${dub.title}. Check that the audio file is available.`;
        setPlayback((current) => ({ ...current, playbackError: message, isPlaying: false }));
        onErrorRef.current(message, "error");
      });
      void persistPosition();
    }
  }

  function playAdjacentDub(direction: -1 | 1, automatic = false) {
    const currentId = audioRef.current?.dataset.dubId;
    const currentTrack = dubsRef.current.find((dub) => dub.id === currentId);
    const currentDistribution = currentTrack?.distribution ?? "worldwide";
    const currentMediaKind = currentTrack?.mediaKind ?? "dub";
    const playable = queue.current
      ? queue.current.map((id) => dubsRef.current.find((dub) => dub.id === id)).filter((dub): dub is Dub => Boolean(dub?.audioUrl))
      : dubsRef.current.filter((dub) => dub.audioUrl && (dub.distribution ?? "worldwide") === currentDistribution
        && (dub.mediaKind ?? "dub") === currentMediaKind);
    if (!playable.length) {
      onErrorRef.current("There are no playable audio files available.", "error");
      return;
    }
    const currentIndex = playable.findIndex((dub) => dub.id === currentId);
    if (queue.current && automatic && !stateRef.current.repeat) {
      if (stateRef.current.shuffle
        ? playable.every((dub) => visited.current.has(dub.id))
        : currentIndex === playable.length - 1) return;
    }
    let target: Dub | undefined;
    if (stateRef.current.shuffle && direction === -1) {
      while (history.current.length && !target) {
        const previousId = history.current.pop();
        target = playable.find((dub) => dub.id === previousId);
      }
    }
    if (!target && stateRef.current.shuffle && direction === 1 && playable.length > 1) {
      let candidates = playable.filter((dub) => dub.id !== currentId && (!queue.current || !visited.current.has(dub.id)));
      if (!candidates.length) {
        visited.current.clear();
        candidates = playable.filter((dub) => dub.id !== currentId);
      }
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }
    target ??= playable[currentIndex === -1
      ? direction === 1 ? 0 : playable.length - 1
      : (currentIndex + direction + playable.length) % playable.length];
    if (direction === 1 && currentId && target.id !== currentId) history.current.push(currentId);
    startTrack(target);
  }

  const nextRef = useRef(() => playAdjacentDub(1, true));
  nextRef.current = () => playAdjacentDub(1, true);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = initialPlaybackState.volume;
    audioRef.current = audio;
    const updatePosition = () => setPlayback((current) => ({
      ...current, currentTime: pendingSeek.current ?? audio.currentTime,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    }));
    const metadataLoaded = () => {
      if (pendingProgress.current !== null && Number.isFinite(audio.duration)) {
        pendingSeek.current = pendingProgress.current * audio.duration;
        pendingProgress.current = null;
        void persistPosition();
      }
      if (pendingSeek.current !== null && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(pendingSeek.current, audio.duration);
        pendingSeek.current = null;
      }
      updatePosition();
    };
    const updatePlaying = () => setPlayback((current) => ({ ...current, isPlaying: !audio.paused }));
    const ended = () => {
      updatePlaying();
      if (autoAdvanceRef.current) nextRef.current();
    };
    const reportError = () => {
      const message = "This audio file could not be loaded.";
      setPlayback((current) => ({ ...current, playbackError: message, isPlaying: false }));
      onErrorRef.current(message, "error");
    };
    audio.addEventListener("timeupdate", updatePosition);
    audio.addEventListener("loadedmetadata", metadataLoaded);
    audio.addEventListener("play", updatePlaying);
    audio.addEventListener("pause", updatePlaying);
    audio.addEventListener("ended", ended);
    audio.addEventListener("error", reportError);
    const timer = window.setInterval(() => {
      if (!audio.paused) void persistPosition();
    }, 5000);
    const pageHide = () => { void persistPosition(); };
    window.addEventListener("pagehide", pageHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", pageHide);
      audio.removeEventListener("timeupdate", updatePosition);
      audio.removeEventListener("loadedmetadata", metadataLoaded);
      audio.removeEventListener("play", updatePlaying);
      audio.removeEventListener("pause", updatePlaying);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("error", reportError);
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
      restoredUser.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (!userId || restoredUser.current === userId) return;
    restoredUser.current = userId;
    const dub = dubs.find((item) => item.id === savedPosition?.dubId);
    if (dub && savedPosition) startTrack(dub, savedPosition.positionSeconds, false);
  }, [userId, dubs, savedPosition]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) { audio.volume = playback.volume; audio.loop = playback.repeat && !queue.current; }
  }, [playback.repeat, playback.volume]);

  useEffect(() => {
    const currentId = audioRef.current?.dataset.dubId;
    if (userId && currentId && !dubs.some((dub) => dub.id === currentId)) {
      reset();
      onErrorRef.current("Playback stopped because this dub is no longer available.", "error");
    }
  }, [dubs, userId]);

  function togglePlayback(dub: Dub) {
    const audio = audioRef.current;
    if (!audio) { onErrorRef.current("Audio playback is not ready yet. Please try again.", "error"); return; }
    if (audio.dataset.dubId !== dub.id) {
      if (!queue.current?.includes(dub.id)) clearQueue();
      history.current = []; startTrack(dub); return;
    }
    if (!audio.paused) { audio.pause(); tutorialActivity.current?.({ type: "playback-paused", subjectId: dub.id }); void persistPosition(); return; }
    const generation = trackGeneration.current;
    void audio.play().then(() => {
      if (generation === trackGeneration.current && !audio.paused) tutorialActivity.current?.({ type: "playback-started", subjectId: dub.id });
    }).catch(() => {
      if (generation !== trackGeneration.current) return;
      const message = `Unable to play ${dub.title}. Check that the audio file is available.`;
      setPlayback((current) => ({ ...current, playbackError: message, isPlaying: false }));
      onErrorRef.current(message, "error");
    });
  }

  function seekPlayback(timeSeconds: number, dub?: Dub) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(timeSeconds)) return;
    const time = Math.max(0, timeSeconds);
    if (dub && audio.dataset.dubId !== dub.id) {
      if (!queue.current?.includes(dub.id)) clearQueue();
      history.current = [];
      startTrack(dub, time);
      return;
    }
    if (!audio.dataset.dubId) return;
    pendingProgress.current = null;
    if (Number.isFinite(audio.duration) && audio.readyState >= 1) {
      audio.currentTime = Math.min(time, audio.duration);
      pendingSeek.current = null;
    } else {
      pendingSeek.current = time;
    }
    setPlayback((current) => ({ ...current, currentTime: pendingSeek.current ?? audio.currentTime }));
    void persistPosition();
  }
  function seekPlaybackProgress(progress: number, dub: Dub) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(progress)) return;
    const safeProgress = Math.max(0, Math.min(1, progress));
    if (audio.dataset.dubId !== dub.id) {
      if (!queue.current?.includes(dub.id)) clearQueue();
      history.current = [];
      startTrack(dub, 0, true, safeProgress);
    } else if (Number.isFinite(audio.duration) && audio.readyState >= 1) {
      seekPlayback(safeProgress * audio.duration);
    } else {
      pendingProgress.current = safeProgress;
    }
  }
  function setVolume(volume: number) { setPlayback((current) => ({ ...current, volume: Math.max(0, Math.min(1, volume)) })); }
  function setShuffle(shuffle: boolean) {
    visited.current = new Set(audioRef.current?.dataset.dubId ? [audioRef.current.dataset.dubId] : []);
    setPlayback((current) => ({ ...current, shuffle }));
  }
  function setRepeat(repeat: boolean) {
    if (audioRef.current) audioRef.current.loop = repeat && !queue.current;
    setPlayback((current) => ({ ...current, repeat }));
  }
  function clearQueue() {
    rememberPack();
    queue.current = null;
    queuePackId.current = null;
    setPlayback((current) => ({ ...current, queuePackId: null }));
    visited.current.clear();
    if (audioRef.current) audioRef.current.loop = stateRef.current.repeat;
  }
  function prepareQueue(tracks: Dub[], packId?: string) {
    const available = tracks.map((track) => dubsRef.current.find((dub) => dub.id === track.id)).filter((dub): dub is Dub => Boolean(dub?.audioUrl));
    if (!available.length) { onErrorRef.current("This pack has no playable files.", "error"); return null; }
    if (available.length !== tracks.length) { onErrorRef.current("Some pack files are unavailable. Refresh the pack before playing it.", "error"); return null; }
    const ids = available.map((dub) => dub.id);
    if (queuePackId.current !== (packId ?? null)) rememberPack();
    if (queue.current?.join("|") !== ids.join("|") || queuePackId.current !== (packId ?? null)) {
      history.current = [];
      visited.current = new Set(audioRef.current?.dataset.dubId && ids.includes(audioRef.current.dataset.dubId) ? [audioRef.current.dataset.dubId] : []);
    }
    queue.current = ids;
    queuePackId.current = packId ?? null;
    setPlayback((current) => current.queuePackId === queuePackId.current ? current : { ...current, queuePackId: queuePackId.current });
    if (audioRef.current) audioRef.current.loop = false;
    return available;
  }
  function closePlayer() {
    clearQueue();
    void persistPosition();
    trackGeneration.current++;
    audioRef.current?.pause();
    audioRef.current?.removeAttribute("src");
    if (audioRef.current) delete audioRef.current.dataset.dubId;
    pendingSeek.current = null;
    pendingProgress.current = null;
    history.current = [];
    setPlayback((current) => ({
      ...current, nowPlayingId: null, isPlaying: false, currentTime: 0,
      duration: 0, playbackError: null,
    }));
  }
  function pausePlayback() {
    audioRef.current?.pause();
    void persistPosition();
  }
  function reset() {
    clearQueue();
    trackGeneration.current++;
    sessionGeneration.current++;
    audioRef.current?.pause();
    audioRef.current?.removeAttribute("src");
    if (audioRef.current) delete audioRef.current.dataset.dubId;
    pendingSeek.current = null;
    pendingProgress.current = null;
    restoredUser.current = undefined;
    history.current = [];
    contexts.current = {};
    globalContext.current = null;
    setGlobalPlayback(null);
    activeWindowId.current = null;
    setAudibleContextId(null);
    setSelectedContext({ id: null, tracks: [] });
    setPackContexts({});
    setPlayback(initialPlaybackState);
  }
  function setWindowSettings(packId: string, settings: Partial<Pick<PlaybackState, "shuffle" | "repeat">>, tracks?: Dub[]) {
    const ids = activeWindowId.current === packId ? queue.current : contexts.current[packId]?.queue;
    const available = tracks ?? (ids ?? []).flatMap((id) => {
      const dub = dubsRef.current.find((entry) => entry.id === id);
      return dub ? [dub] : [];
    });
    if (available.length) selectPlayerContext(packId, available, packId.startsWith("track:") ? undefined : packId);
    if (activeWindowId.current === packId) {
      if (settings.shuffle !== undefined) setShuffle(settings.shuffle);
      if (settings.repeat !== undefined) setRepeat(settings.repeat);
      return;
    }
    const saved = contexts.current[packId] ?? { playback: { ...initialPlaybackState, queuePackId: packId }, queue: null, history: [], visited: [], progress: null };
    const next = { ...saved, playback: { ...saved.playback, ...settings },
      visited: settings.shuffle !== undefined ? saved.playback.nowPlayingId ? [saved.playback.nowPlayingId] : [] : saved.visited };
    contexts.current[packId] = next;
    setPackContexts((current) => ({ ...current, [packId]: next.playback }));
  }
  function activateWindowQueue(tracks: Dub[], packId: string) {
    const switching = activeWindowId.current !== packId;
    const saved = contexts.current[packId];
    if (switching) rememberPack();
    const available = prepareQueue(tracks, packId);
    if (!available) return false;
    selectPlayerContext(packId, available, packId.startsWith("track:") ? undefined : packId);
    activeWindowId.current = packId;
    setAudibleContextId(packId);
    if (!switching && audioRef.current?.dataset.dubId && available.some((dub) => dub.id === audioRef.current?.dataset.dubId)) return true;
    const track = available.find((dub) => dub.id === saved?.playback.nowPlayingId) ?? available[0];
    if (saved) {
      history.current = saved.history.filter((id) => available.some((dub) => dub.id === id));
      visited.current = new Set(saved.visited.filter((id) => available.some((dub) => dub.id === id)));
    }
    const shuffle = saved?.playback.shuffle ?? false;
    const repeat = saved?.playback.repeat ?? false;
    setPlayback((current) => ({ ...current, shuffle, repeat }));
    startTrack(track, track.id === saved?.playback.nowPlayingId ? saved.playback.currentTime : 0, false,
      track.id === saved?.playback.nowPlayingId ? saved.progress : null);
    return true;
  }
  function activateGlobalContext() {
    if (activeWindowId.current === null) return;
    rememberPack();
    activeWindowId.current = null;
    setAudibleContextId(null);
    const saved = globalContext.current;
    queue.current = saved?.queue?.filter((id) => dubsRef.current.some((dub) => dub.id === id)) ?? null;
    queuePackId.current = saved?.playback.queuePackId ?? null;
    history.current = saved?.history ?? [];
    visited.current = new Set(saved?.visited ?? []);
    const track = dubsRef.current.find((dub) => dub.id === saved?.playback.nowPlayingId);
    audioRef.current?.pause();
    setPlayback({ ...(saved?.playback ?? initialPlaybackState), volume: stateRef.current.volume, isPlaying: false });
    if (track) startTrack(track, saved?.playback.currentTime ?? 0, false, saved?.progress ?? null);
    else {
      trackGeneration.current++;
      audioRef.current?.removeAttribute("src");
      if (audioRef.current) delete audioRef.current.dataset.dubId;
      pendingSeek.current = null;
      pendingProgress.current = null;
      setPlayback((current) => ({ ...current, nowPlayingId: null, currentTime: 0, duration: 0 }));
    }
  }
  const selectPlayerContext = useCallback((id: string | null, tracks: Dub[] = [], packId?: string) => {
    setSelectedContext((current) => current.id === id && current.packId === packId
      && current.tracks.map((dub) => dub.id).join("|") === tracks.map((dub) => dub.id).join("|") ? current : { id, tracks, packId });
  }, []);
  function activateSelectedContext() {
    if (playback.nowPlayingId && selectedContextId === activeWindowId.current) return true;
    if (selectedContextId === null) { activateGlobalContext(); return true; }
    return activateWindowQueue(selectedContext.tracks, selectedContextId);
  }
  function setGlobalSettings(settings: Partial<Pick<PlaybackState, "shuffle" | "repeat">>) {
    if (activeWindowId.current === null) {
      if (settings.shuffle !== undefined) setShuffle(settings.shuffle);
      if (settings.repeat !== undefined) setRepeat(settings.repeat);
      return;
    }
    const saved = globalContext.current ?? {
      playback: initialPlaybackState, queue: null, history: [], visited: [], progress: null,
    };
    globalContext.current = { ...saved, playback: { ...saved.playback, ...settings },
      visited: settings.shuffle !== undefined ? saved.playback.nowPlayingId ? [saved.playback.nowPlayingId] : [] : saved.visited };
    setGlobalPlayback(globalContext.current.playback);
  }
  function setMainSettings(settings: Partial<Pick<PlaybackState, "shuffle" | "repeat">>) {
    if (selectedContextId !== null) setWindowSettings(selectedContextId, settings);
    else setGlobalSettings(settings);
  }
  function playQueue(tracks: Dub[], packId?: string) {
    const available = prepareQueue(tracks, packId);
    if (!available) return;
    history.current = [];
    visited.current.clear();
    startTrack(available[stateRef.current.shuffle ? Math.floor(Math.random() * available.length) : 0]);
  }
  const selectedSnapshot = selectedContextId === activeWindowId.current ? playback
    : selectedContextId === null ? globalPlayback : packContexts[selectedContextId];
  const validSnapshot = selectedSnapshot?.nowPlayingId && dubs.some((dub) => dub.id === selectedSnapshot.nowPlayingId)
    && (playback.nowPlayingId || selectedContextId === null || selectedContext.tracks.some((dub) => dub.id === selectedSnapshot.nowPlayingId)) ? selectedSnapshot : undefined;
  const mainState: PlaybackState = {
    ...(validSnapshot ?? { ...initialPlaybackState, shuffle: selectedSnapshot?.shuffle ?? false, repeat: selectedSnapshot?.repeat ?? false }),
    nowPlayingId: validSnapshot?.nowPlayingId ?? selectedContext.tracks[0]?.id ?? null,
    queuePackId: selectedContextId === activeWindowId.current ? playback.queuePackId
      : selectedContextId === null ? selectedSnapshot?.queuePackId ?? null : selectedContext.packId ?? null,
    volume: playback.volume,
    isPlaying: Boolean(validSnapshot && selectedContextId === activeWindowId.current && playback.isPlaying),
  };
  return {
    setWindowSettings, activateWindowQueue, activateGlobalContext, selectPlayerContext, pausePlayback,
    toggleSinglePlayback: (dub: Dub) => { activateGlobalContext(); clearQueue(); togglePlayback(dub); },
    setGlobalShuffle: (shuffle: boolean) => setGlobalSettings({ shuffle }),
    setGlobalRepeat: (repeat: boolean) => setGlobalSettings({ repeat }),
    mainPlayer: {
      state: mainState,
      togglePlayback: (dub: Dub) => { if (activateSelectedContext()) togglePlayback(dub); },
      seekPlayback: (seconds: number, dub?: Dub) => { if (activateSelectedContext()) seekPlayback(seconds, dub); },
      seekPlaybackProgress: (progress: number, dub: Dub) => { if (activateSelectedContext()) seekPlaybackProgress(progress, dub); },
      playNextDub: () => { if (activateSelectedContext()) playAdjacentDub(1); },
      playPreviousDub: () => { if (activateSelectedContext()) playAdjacentDub(-1); },
      setShuffle: (shuffle: boolean) => setMainSettings({ shuffle }),
      setRepeat: (repeat: boolean) => setMainSettings({ repeat }),
      activateQueue: (tracks: Dub[], packId?: string) => activateSelectedContext() && prepareQueue(tracks, packId) !== null,
      playQueue: (tracks: Dub[], packId?: string) => {
        if (activateSelectedContext()) playQueue(tracks, packId);
      },
      closePlayer: () => {
        if (selectedContextId === activeWindowId.current) closePlayer();
        else {
          if (selectedContextId === null) { globalContext.current = null; setGlobalPlayback(null); }
          else {
            delete contexts.current[selectedContextId];
            setPackContexts((current) => {
              const next = { ...current };
              delete next[selectedContextId];
              return next;
            });
          }
        }
      },
    },
    playQueue,
    activateQueue: (tracks: Dub[], packId?: string) => prepareQueue(tracks, packId) !== null,
    restoreWindowTrack: (dub: Dub) => {
      if (audioRef.current?.dataset.dubId === dub.id) return;
      clearQueue();
      startTrack(dub, savedPosition?.dubId === dub.id ? savedPosition.positionSeconds : 0, false);
    },
    state: { ...playback, packContexts, audibleContextId }, togglePlayback, seekPlayback, seekPlaybackProgress, setVolume, setShuffle, setRepeat,
    playNextDub: () => playAdjacentDub(1), playPreviousDub: () => playAdjacentDub(-1),
    flushPosition: persistPosition, reset, closePlayer,
  };
}
