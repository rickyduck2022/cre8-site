import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { WindowMaximize as Maximize2, WindowMinimize as Minimize2, VolumeSolid as Volume2, MuteSolid as VolumeX, CloseSolid as X } from "@craft/icons";
import { PlayerTab } from "../../atoms/PlayerTab/PlayerTab";
import type { NowPlayingProps } from "../../molecules/NowPlaying/NowPlaying";
import { NowPlaying } from "../../molecules/NowPlaying/NowPlaying";
import { TransportControls } from "../../molecules/TransportControls/TransportControls";
import { Waveform } from "../../molecules/Waveform/Waveform";
import type { Dub, MediaKind } from "../../types/domain";
import "../../foundations/MediaPalette.css";
import "../Organisms.css";
import "../../foundations/DistributionSurfaces.css";

export interface AudioPlayerTrack extends NowPlayingProps {
  duration?: string;
  peaks?: number[];
}

export interface AudioPlayerProps {
  track?: AudioPlayerTrack | null;
  variant?: "full" | "compact" | "mini" | "docked" | "inline" | "window";
  colorVariant?: "default" | "playable" | "controller";
  mediaKind?: MediaKind;
  transportVariant?: "full" | "minimal";
  contextLabel?: string;
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
  style?: CSSProperties;
  dragHandle?: ReactNode;
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  minimizeLabel?: string;
  minimizeIcon?: "maximize" | "minimize";
  positionMenu?: ReactNode;
  onClose?: () => void;
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

export const AudioPlayer = forwardRef<HTMLElement, AudioPlayerProps>(function AudioPlayer({
  className,
  colorVariant = "default",
  mediaKind = "dub",
  contextLabel,
  currentTimeSeconds = 0,
  durationSeconds,
  distribution,
  dragHandle,
  endAction,
  metadata,
  minimized = false,
  minimizeLabel,
  minimizeIcon,
  onMinimizedChange,
  onClose,
  onNext,
  onPlayChange,
  onPrevious,
  onRepeatChange,
  onSeek,
  onSeekProgress,
  onShuffleChange,
  onVolumeChange,
  playbackError,
  positionMenu,
  playing,
  repeat,
  shuffle,
  style,
  track,
  transportVariant = "full",
  variant = "full",
  volume,
}, ref) {
  const [internalPlaying, setInternalPlaying] = useState(false);
  const [internalVolume, setInternalVolume] = useState(0.7);
  const isControlled = playing !== undefined;
  const currentPlaying = isControlled ? playing : internalPlaying;
  const volumeLevel = volume ?? internalVolume;
  const audibleVolume = useRef(volumeLevel > 0 ? volumeLevel : 0.7);
  useEffect(() => {
    if (volumeLevel > 0) audibleVolume.current = volumeLevel;
  }, [volumeLevel]);

  const trackDuration = track
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
    if (nextVolume > 0) audibleVolume.current = nextVolume;
    if (volume === undefined) setInternalVolume(nextVolume);
    onVolumeChange?.(nextVolume);
  }

  if (!track) return null;

  return (
    <section
      ref={ref}
      style={style}
      aria-label={`Audio player: ${track.title}`}
      className={[
        "organism-card",
        "audio-player",
        `media-kind--${mediaKind}`,
        `audio-player--${variant}`,
        colorVariant !== "default" && "audio-player--playable",
        colorVariant === "controller" && "audio-player--controller",
        distribution === "alist" && "audio-player--alist",
        distribution === "private" && "audio-player--private",
        distribution === "worldwide" && "audio-player--worldwide",
        minimized && "audio-player--minimized",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {(onMinimizedChange || positionMenu || onClose || (minimized && dragHandle)) && <div className="audio-player__chrome" role="group" aria-label="Audio player layout controls">
        {minimized && dragHandle}
        {onMinimizedChange && (
          <PlayerTab
            aria-expanded={!minimized}
            aria-label={minimizeLabel ?? (minimized ? "Expand audio player" : "Minimize audio player")}
            className="audio-player__minimize"
            leadingIcon={minimizeIcon === "minimize" || (!minimizeIcon && !minimized) ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            onClick={() => onMinimizedChange(!minimized)}
          />
        )}
        {positionMenu}
        {onClose && (
          <PlayerTab aria-label="Close audio player" className="audio-player__close" leadingIcon={<X aria-hidden="true" />} onClick={onClose} />
        )}
      </div>}
      <NowPlaying
        contextLabel={distribution === "alist" ? [contextLabel, "A-List release"].filter(Boolean).join(" · ") : contextLabel}
        artist={track.artist || "Artist"}
        artistAListApproved={track.artistAListApproved}
        artwork={track.artwork}
        artworkContent={track.artworkContent}
        isPlaying={currentPlaying}
        onArtistClick={track.onArtistClick}
        title={track.title}
        />
      <TransportControls
        variant={transportVariant}
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
          insetShadow
          onSeek={onSeekProgress ?? (
            onSeek && trackDuration > 0
              ? (nextProgress) => onSeek(nextProgress * trackDuration)
              : undefined
          )}
          peaks={track.peaks}
          progress={progress}
          variant="smooth"
        />
        <span className="audio-player__time">
          {durationSeconds !== undefined && durationSeconds > 0
            ? formatTime(durationSeconds)
            : track.duration ?? "00:00"}
        </span>
      </div>
      <div className="audio-player__volume" role="group" aria-label="Volume controls">
        <button type="button" className="audio-player__mute" aria-label={volumeLevel === 0 ? "Unmute" : "Mute"}
          aria-pressed={volumeLevel === 0} title={volumeLevel === 0 ? "Unmute" : "Mute"}
          onClick={() => handleVolumeChange(volumeLevel === 0 ? audibleVolume.current : 0)}>
          {volumeLevel === 0 ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
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
      </div>
      {endAction && (
        <div className="audio-player__end-action">{endAction}</div>
      )}
      {metadata && <div className="audio-player__metadata">{metadata}</div>}
      {playbackError && (
        <span className="audio-player__error" role="status" title={playbackError}>
          {playbackError}
        </span>
      )}
    </section>
  );
});