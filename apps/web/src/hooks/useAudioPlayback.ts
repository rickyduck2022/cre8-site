import { useEffect, useRef, useState } from "react";
import type { Dub } from "@craft/ui";

export interface PlaybackPosition {
  dubId: string;
  positionSeconds: number;
}

interface PlaybackState {
  nowPlayingId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  playbackError: string | null;
}

const initialPlaybackState: PlaybackState = {
  nowPlayingId: null, isPlaying: false, currentTime: 0, duration: 0,
  volume: 0.7, shuffle: false, repeat: false, playbackError: null,
};

export function useAudioPlayback(
  dubs: Dub[],
  onError: (message: string, type?: "error") => void,
  userId: string | undefined,
  savedPosition: PlaybackPosition | null,
  savePosition: (position: PlaybackPosition) => Promise<void>,
) {
  const [playback, setPlayback] = useState(initialPlaybackState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dubsRef = useRef(dubs);
  const stateRef = useRef(playback);
  const onErrorRef = useRef(onError);
  const saveRef = useRef(savePosition);
  const pendingSeek = useRef<number | null>(null);
  const pendingProgress = useRef<number | null>(null);
  const restoredUser = useRef<string | undefined>(undefined);
  const history = useRef<string[]>([]);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const sessionGeneration = useRef(0);
  const trackGeneration = useRef(0);
  dubsRef.current = dubs;
  stateRef.current = playback;
  onErrorRef.current = onError;
  saveRef.current = savePosition;

  function persistPosition() {
    const audio = audioRef.current;
    const dubId = audio?.dataset.dubId;
    if (!audio || !dubId || pendingProgress.current !== null || !Number.isFinite(audio.currentTime)) return saveQueue.current;
    const position = { dubId, positionSeconds: Math.max(0, pendingSeek.current ?? audio.currentTime) };
    const generation = sessionGeneration.current;
    saveQueue.current = saveQueue.current.then(() => {
      if (generation === sessionGeneration.current) return saveRef.current(position);
    }).catch((error: unknown) => {
      if (generation !== sessionGeneration.current) return;
      onErrorRef.current(`Unable to save playback position: ${error instanceof Error ? error.message : "Request failed."}`, "error");
    });
    return saveQueue.current;
  }

  function startTrack(dub: Dub, positionSeconds = 0, autoplay = true, progress: number | null = null) {
    const audio = audioRef.current;
    if (!audio) { onErrorRef.current("Audio playback is not ready yet. Please try again.", "error"); return; }
    if (!dub.audioUrl) {
      const message = `The audio file for ${dub.title} is unavailable.`;
      setPlayback((current) => ({ ...current, playbackError: message }));
      onErrorRef.current(message, "error");
      return;
    }
    const generation = ++trackGeneration.current;
    audio.pause();
    audio.dataset.dubId = dub.id;
    pendingSeek.current = positionSeconds;
    pendingProgress.current = progress;
    audio.src = dub.audioUrl;
    setPlayback((current) => ({
      ...current, nowPlayingId: dub.id, isPlaying: false,
      currentTime: positionSeconds, duration: 0, playbackError: null,
    }));
    if (autoplay) {
      void audio.play().catch(() => {
        if (generation !== trackGeneration.current) return;
        const message = `Unable to play ${dub.title}. Check that the audio file is available.`;
        setPlayback((current) => ({ ...current, playbackError: message, isPlaying: false }));
        onErrorRef.current(message, "error");
      });
      void persistPosition();
    }
  }

  function playAdjacentDub(direction: -1 | 1) {
    const playable = dubsRef.current.filter((dub) => dub.audioUrl);
    if (!playable.length) {
      onErrorRef.current("There are no playable audio files available.", "error");
      return;
    }
    const currentId = audioRef.current?.dataset.dubId;
    const currentIndex = playable.findIndex((dub) => dub.id === currentId);
    let target: Dub | undefined;
    if (stateRef.current.shuffle && direction === -1) {
      while (history.current.length && !target) {
        const previousId = history.current.pop();
        target = playable.find((dub) => dub.id === previousId);
      }
    }
    if (!target && stateRef.current.shuffle && direction === 1 && playable.length > 1) {
      const candidates = playable.filter((dub) => dub.id !== currentId);
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }
    target ??= playable[currentIndex === -1
      ? direction === 1 ? 0 : playable.length - 1
      : (currentIndex + direction + playable.length) % playable.length];
    if (direction === 1 && currentId && target.id !== currentId) history.current.push(currentId);
    startTrack(target);
  }

  const nextRef = useRef(() => playAdjacentDub(1));
  nextRef.current = () => playAdjacentDub(1);

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
    const ended = () => { updatePlaying(); nextRef.current(); };
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
    if (audio) { audio.volume = playback.volume; audio.loop = playback.repeat; }
  }, [playback.repeat, playback.volume]);

  function togglePlayback(dub: Dub) {
    const audio = audioRef.current;
    if (!audio) { onErrorRef.current("Audio playback is not ready yet. Please try again.", "error"); return; }
    if (audio.dataset.dubId !== dub.id) { history.current = []; startTrack(dub); return; }
    if (!audio.paused) { audio.pause(); void persistPosition(); return; }
    const generation = trackGeneration.current;
    void audio.play().catch(() => {
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
      history.current = [];
      startTrack(dub, 0, true, safeProgress);
    } else if (Number.isFinite(audio.duration) && audio.readyState >= 1) {
      seekPlayback(safeProgress * audio.duration);
    } else {
      pendingProgress.current = safeProgress;
    }
  }
  function setVolume(volume: number) { setPlayback((current) => ({ ...current, volume: Math.max(0, Math.min(1, volume)) })); }
  function setShuffle(shuffle: boolean) { setPlayback((current) => ({ ...current, shuffle })); }
  function setRepeat(repeat: boolean) { setPlayback((current) => ({ ...current, repeat })); }
  function reset() {
    trackGeneration.current++;
    sessionGeneration.current++;
    audioRef.current?.pause();
    audioRef.current?.removeAttribute("src");
    if (audioRef.current) delete audioRef.current.dataset.dubId;
    pendingSeek.current = null;
    pendingProgress.current = null;
    restoredUser.current = undefined;
    history.current = [];
    setPlayback(initialPlaybackState);
  }
  return {
    state: playback, togglePlayback, seekPlayback, seekPlaybackProgress, setVolume, setShuffle, setRepeat,
    playNextDub: () => playAdjacentDub(1), playPreviousDub: () => playAdjacentDub(-1),
    flushPosition: persistPosition, reset,
  };
}
