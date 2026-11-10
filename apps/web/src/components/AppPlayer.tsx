import type { ComponentProps } from "react";
import { ChevronRight, Pause, Play, X } from "@craft/icons";
import { AudioPlayer, Button, PlayerPositionMenu, PlayerTab, SnapPreview, TrackArtwork, type Dub } from "@craft/ui";
import type { PlayerLayoutController } from "../hooks/usePlayerLayout";

type PlaybackProps = Pick<ComponentProps<typeof AudioPlayer>,
  "playing" | "currentTimeSeconds" | "durationSeconds" | "volume" | "shuffle" | "repeat"
  | "playbackError" | "onClose" | "onPlayChange" | "onSeek" | "onSeekProgress"
  | "onVolumeChange" | "onShuffleChange" | "onRepeatChange" | "onPrevious" | "onNext"
>;

interface AppPlayerProps {
  track: Dub | null;
  layout: PlayerLayoutController;
  playback: PlaybackProps;
  onOpenProfile: (username: string) => void;
}

export function AppPlayer({ track, layout, playback, onOpenProfile }: AppPlayerProps) {
  const { floating, mobileEdgeDock } = layout;
  const { playing, onPlayChange, onClose } = playback;

  return (
    <>
      {track && layout.isMinimized && <div aria-hidden="true" className="app-player-footer-target" />}
      {floating.previews.map((target) => (
        <SnapPreview
          key={target.kind}
          active={target.active}
          label={target.kind === "dock" ? (target.active ? "Release to dock player" : "Drop to dock player") : target.kind === "left-edge" || target.kind === "right-edge" ? `${target.active ? "Release" : "Drop"} to dock at ${target.kind === "left-edge" ? "left" : "right"} edge` : `${target.active ? "Release" : "Drop"} to expand at ${target.kind}`}
          icon={target.kind === "left-edge" || target.kind === "right-edge" ? <span className="app-player-edge-preview">{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}<ChevronRight aria-hidden="true" style={target.kind === "right-edge" ? { transform: "rotate(180deg)" } : undefined} /></span> : undefined}
          style={target.style}
        />
      ))}
      {floating.previews.map((target) => target.active && target.previewStyle
        ? <SnapPreview key={`${target.kind}-preview`} active label="" style={target.previewStyle} />
        : null)}
      {track && (
        <AudioPlayer
          {...playback}
          className={`app-player${mobileEdgeDock ? " app-player--edge-collapsed" : ""}`}
          colorVariant="controller"
          contextLabel={playing ? "Now playing" : "Playback paused"}
          ref={layout.playerRef}
          style={layout.style}
          dragHandle={<PlayerTab
            aria-label="Move audio player with arrow keys or drag; Home returns it to its original position"
            title="Drag or use arrow keys to move; press Home to return"
            className="audio-player__drag"
            onPointerDown={floating.onPointerDown}
            onPointerMove={floating.onPointerMove}
            onPointerUp={floating.onPointerUp}
            onPointerCancel={floating.onPointerCancel}
            onLostPointerCapture={floating.onLostPointerCapture}
            onKeyDown={floating.onKeyDown}
          ><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" />
          </svg></PlayerTab>}
          minimized={layout.isMinimized}
          minimizeLabel={layout.popsOutOnMinimize ? "Pop out audio player" : undefined}
          minimizeIcon={layout.popsOutOnMinimize ? "minimize" : undefined}
          positionMenu={<PlayerPositionMenu
            positions={layout.positions}
            current={layout.currentPosition}
            opacityControl={layout.opacityControl}
            onSelect={layout.selectPosition}
          />}
          onMinimizedChange={layout.changeMinimized}
          distribution={track.distribution ?? "worldwide"}
          track={{
            title: track.title,
            artist: track.artist,
            artistAListApproved: track.artistAListApproved,
            onArtistClick: () => onOpenProfile(track.uploader),
            artworkContent: <TrackArtwork dub={track} />,
            duration: track.duration,
          }}
          variant="full"
        />
      )}
      {track && mobileEdgeDock && <div className={`app-player-edge-handle app-player-edge-handle--${mobileEdgeDock}`}>
        <Button
          aria-label={playing ? "Pause audio player" : "Play audio player"}
          className="app-player-edge-handle__play"
          leadingIcon={playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          onClick={() => onPlayChange?.(!playing)}
          size="small"
          variant="tertiary"
        />
        <Button
          aria-label={`Open audio player docked at ${mobileEdgeDock === "left-edge" ? "left" : "right"} edge`}
          className="app-player-edge-handle__open"
          leadingIcon={<ChevronRight aria-hidden="true" />}
          onClick={layout.openEdgeDock}
          size="small"
          variant="tertiary"
        />
        <Button aria-label="Close audio player" leadingIcon={<X aria-hidden="true" />} onClick={onClose} size="small" variant="tertiary" />
      </div>}
    </>
  );
}
