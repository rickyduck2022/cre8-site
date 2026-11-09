import { useState, type ReactNode } from "react";
import { ChevronDown, Volume2 } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import type { NowPlayingProps } from "../../molecules/NowPlaying/NowPlaying";
import { NowPlaying } from "../../molecules/NowPlaying/NowPlaying";
import { TransportControls } from "../../molecules/TransportControls/TransportControls";
import { Waveform } from "../../molecules/Waveform/Waveform";
import type { Dub } from "../../types/domain";
import "../Organisms.css";
import "../../foundations/DistributionSurfaces.css";

export interface AudioPlayerTrack extends NowPlayingProps {
  duration?: string;
  peaks?: number[];
}

export interface AudioPlayerProps {
  track?: AudioPlayerTrack | null;
  variant?: "full" | "compact" | "mini" | "docked" | "inline";
  distribution?: Dub["distribution"];
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
  onSeekProgress?: (progress: number) => void;
  onVolumeChange?: (volume: number) => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
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

function EmptyPlayerPlaceholder() {
  return (
    <div className="audio-player__empty-state">
      <p>No track loaded</p>
      <p className="audio-player__empty-state-subtitle">Select a dub to get started</p>
    </div>
  );
}

export function AudioPlayer({
  className,
  currentTimeSeconds = 0,
  durationSeconds,
  distribution,
  endAction,
  metadata,
  minimized = false,
  onMinimizedChange,
  onNext,
  onPlayChange,
  onPrevious,
  onRepeatChange,
  onSeek,
  onSeekProgress,
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

  const hasTrack = track != null;
  const trackDuration = hasTrack
    ? durationSeconds && durationSeconds > 0
      ? durationSeconds
      : durationFromLabel(track.duration)
    : 0;
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
      aria-label={hasTrack ? `Audio player: ${track.title}` : "Audio player"}
      className={[
        "organism-card",
        "audio-player",
        `audio-player--${variant}`,
        hasTrack && distribution === "alist" && "audio-player--alist",
        hasTrack && distribution === "private" && "audio-player--private",
        hasTrack && distribution === "worldwide" && "audio-player--worldwide",
        minimized && "audio-player--minimized",
        !hasTrack && "audio-player--empty",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {hasTrack ? (
        <>
          <NowPlaying
            artist={track.artist || "Artist"}
            artistAListApproved={track.artistAListApproved}
            artwork={track.artwork}
            artworkContent={track.artworkContent}
            isPlaying={currentPlaying}
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
              onSeek={onSeekProgress ?? (
                onSeek && trackDuration > 0
                  ? (nextProgress) => onSeek(nextProgress * trackDuration)
                  : undefined
              )}
              peaks={track.peaks}
              progress={progress}
            />
            <span className="audio-player__time">
              {durationSeconds !== undefined && durationSeconds > 0
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
        </>
      ) : (
        <EmptyPlayerPlaceholder />
      )}
      {playbackError && (
        <span className="audio-player__error" role="status">
          {playbackError}
        </span>
      )}
      {onMinimizedChange && (
        <Button
          aria-expanded={!minimized}
          aria-label={minimized ? "Expand audio player" : "Minimize audio player"}
          className="audio-player__minimize"
          leadingIcon={<ChevronDown />}
          onClick={() => onMinimizedChange(!minimized)}
          size="small"
          variant="tertiary"
        />
      )}
    </section>
  );
}