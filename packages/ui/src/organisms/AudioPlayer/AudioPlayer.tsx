import { useState, type ReactNode } from "react";
import { Volume2 } from "@craft/icons";
import type { NowPlayingProps } from "../../molecules/NowPlaying/NowPlaying";
import { NowPlaying } from "../../molecules/NowPlaying/NowPlaying";
import { TransportControls } from "../../molecules/TransportControls/TransportControls";
import { Waveform } from "../../molecules/Waveform/Waveform";
import "../Organisms.css";

export interface AudioPlayerTrack extends NowPlayingProps {
  duration?: string;
  peaks?: number[];
}

export interface AudioPlayerProps {
  track: AudioPlayerTrack;
  variant?: "full" | "compact" | "mini" | "docked" | "inline";
  endAction?: ReactNode;
  metadata?: ReactNode;
  playing?: boolean;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  volume?: number;
  shuffle?: boolean;
  repeat?: boolean;
  playbackError?: string | null;
  onPlayChange?: (playing: boolean) => void;
  onSeek?: (timeSeconds: number) => void;
  onVolumeChange?: (volume: number) => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
}

function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function durationFromLabel(duration?: string) {
  if (!duration) return 0;
  const [minutes, seconds] = duration.split(":").map(Number);
  return Number.isFinite(minutes) && Number.isFinite(seconds)
    ? minutes * 60 + seconds
    : 0;
}

export function AudioPlayer({
  className,
  currentTimeSeconds = 0,
  durationSeconds,
  endAction,
  metadata,
  onNext,
  onPlayChange,
  onPrevious,
  onRepeatChange,
  onSeek,
  onShuffleChange,
  onVolumeChange,
  playbackError,
  playing,
  repeat,
  shuffle,
  track,
  variant = "full",
  volume,
}: AudioPlayerProps) {
  const [internalPlaying, setInternalPlaying] = useState(false);
  const [internalVolume, setInternalVolume] = useState(0.7);
  const isControlled = playing !== undefined;
  const currentPlaying = isControlled ? playing : internalPlaying;
  const volumeLevel = volume ?? internalVolume;
  const trackDuration = durationSeconds ?? durationFromLabel(track.duration);
  const progress =
    trackDuration > 0
      ? Math.max(0, Math.min(1, currentTimeSeconds / trackDuration))
      : 0;

  function handlePlayChange(nextPlaying: boolean) {
    if (!isControlled) setInternalPlaying(nextPlaying);
    onPlayChange?.(nextPlaying);
  }

  function handleVolumeChange(nextVolume: number) {
    if (volume === undefined) setInternalVolume(nextVolume);
    onVolumeChange?.(nextVolume);
  }

  return (
    <section
      aria-label={`Audio player: ${track.title}`}
      className={[
        "organism-card",
        "audio-player",
        `audio-player--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <NowPlaying
        artist={track.artist}
        artwork={track.artwork}
        artworkContent={track.artworkContent}
        onArtistClick={track.onArtistClick}
        title={track.title}
      />
      <TransportControls
        onNext={onNext}
        onPlayChange={handlePlayChange}
        onPrevious={onPrevious}
        onRepeatChange={onRepeatChange}
        onShuffleChange={onShuffleChange}
        playing={currentPlaying}
        repeat={repeat}
        shuffle={shuffle}
      />
      <div className="audio-player__timeline">
        <span className="audio-player__time">{formatTime(currentTimeSeconds)}</span>
        <Waveform
          className="audio-player__waveform"
          durationSeconds={trackDuration}
          label={`${track.title} playback progress`}
          onSeek={
            onSeek && trackDuration > 0
              ? (nextProgress) => onSeek(nextProgress * trackDuration)
              : undefined
          }
          peaks={track.peaks}
          progress={progress}
        />
        <span className="audio-player__time">
          {durationSeconds !== undefined
            ? formatTime(durationSeconds)
            : track.duration ?? "00:00"}
        </span>
      </div>
      <label className="audio-player__volume">
        <span className="sr-only">Volume</span>
        <Volume2 aria-hidden="true" />
        <input
          aria-label="Volume"
          max="100"
          min="0"
          onChange={(event) =>
            handleVolumeChange(Number(event.currentTarget.value) / 100)
          }
          type="range"
          value={Math.round(volumeLevel * 100)}
        />
      </label>
      {endAction && (
        <div className="audio-player__end-action">{endAction}</div>
      )}
      {metadata && <div className="audio-player__metadata">{metadata}</div>}
      {playbackError && (
        <span className="audio-player__error" role="status">
          {playbackError}
        </span>
      )}
    </section>
  );
}
