import { useEffect, useRef, useState } from "react";
import type { Dub } from "@craft/ui";

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

export function useAudioPlayback(dubs: Dub[], onError: (message: string, type?: "error") => void) {
  const [playback, setPlayback] = useState(initialPlaybackState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;
    const updatePosition = () => setPlayback((current) => ({
      ...current, currentTime: audio.currentTime || 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    }));
    const updatePlaying = () => setPlayback((current) => ({ ...current, isPlaying: !audio.paused }));
    const reportError = () => setPlayback((current) => ({
      ...current, playbackError: "This audio file could not be loaded.", isPlaying: false,
    }));
    audio.addEventListener("timeupdate", updatePosition);
    audio.addEventListener("loadedmetadata", updatePosition);
    audio.addEventListener("play", updatePlaying);
    audio.addEventListener("pause", updatePlaying);
    audio.addEventListener("ended", updatePlaying);
    audio.addEventListener("error", reportError);
    return () => {
      audio.removeEventListener("timeupdate", updatePosition);
      audio.removeEventListener("loadedmetadata", updatePosition);
      audio.removeEventListener("play", updatePlaying);
      audio.removeEventListener("pause", updatePlaying);
      audio.removeEventListener("ended", updatePlaying);
      audio.removeEventListener("error", reportError);
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) { audio.volume = playback.volume; audio.loop = playback.repeat; }
  }, [playback.repeat, playback.volume]);

  function togglePlayback(dub: Dub) {
    const audio = audioRef.current;
    if (!audio) { onErrorRef.current("Audio playback is not ready yet. Please try again.", "error"); return; }
    if (!dub.audioUrl) {
      const message = `The audio file for ${dub.title} is unavailable.`;
      setPlayback((current) => ({ ...current, playbackError: message }));
      onErrorRef.current(message, "error");
      return;
    }
    const isCurrentTrack = audio.dataset.dubId === dub.id;
    if (isCurrentTrack && !audio.paused) { audio.pause(); return; }
    if (!isCurrentTrack) {
      audio.pause(); audio.dataset.dubId = dub.id; audio.src = dub.audioUrl; audio.currentTime = 0;
      setPlayback((current) => ({ ...current, nowPlayingId: dub.id, isPlaying: false, currentTime: 0, duration: 0, playbackError: null }));
    }
    void audio.play().catch(() => {
      const message = `Unable to play ${dub.title}. Check that the audio file is available.`;
      setPlayback((current) => ({ ...current, playbackError: message, isPlaying: false }));
      onErrorRef.current(message, "error");
    });
  }
  function seekPlayback(timeSeconds: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(timeSeconds, audio.duration));
  }
  function setVolume(volume: number) { setPlayback((current) => ({ ...current, volume: Math.max(0, Math.min(1, volume)) })); }
  function setShuffle(shuffle: boolean) { setPlayback((current) => ({ ...current, shuffle })); }
  function setRepeat(repeat: boolean) { setPlayback((current) => ({ ...current, repeat })); }
  function playAdjacentDub(direction: -1 | 1) {
    if (!dubs.length) return;
    const currentIndex = dubs.findIndex((dub) => dub.id === playback.nowPlayingId);
    const candidates = dubs.map((_, index) => index).filter((index) => index !== currentIndex);
    const nextIndex = playback.shuffle && direction === 1 && dubs.length > 1
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : currentIndex === -1 ? direction === 1 ? 0 : dubs.length - 1
        : (currentIndex + direction + dubs.length) % dubs.length;
    togglePlayback(dubs[nextIndex]);
  }
  function reset() {
    audioRef.current?.pause();
    audioRef.current?.removeAttribute("src");
    setPlayback(initialPlaybackState);
  }
  return {
    state: playback, togglePlayback, seekPlayback, setVolume, setShuffle, setRepeat,
    playNextDub: () => playAdjacentDub(1), playPreviousDub: () => playAdjacentDub(-1), reset,
  };
}
