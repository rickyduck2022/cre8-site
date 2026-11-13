import { useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDownSolid as ChevronDown, ChevronRightSolid as ChevronRight, DownloadSolid as Download, MessageSolid as MessageCircle, PauseSolid as Pause, Play, MoveSolid, MinimizeSolid, MaximizeSolid } from "@craft/icons";
import { AudioPlayer, Button, Modal, PackPlaylist, PlayerPositionMenu, PlayerTab, SnapPreview, TrackArtwork, packTypeLabel, type Dub, type DubPack, type PackPlaylistProps } from "@craft/ui";
import { useAsyncSubmission } from "@craft/ui";
import type { PlayerLayoutController } from "../hooks/usePlayerLayout";

type PlaybackProps = Pick<ComponentProps<typeof AudioPlayer>,
  "playing" | "currentTimeSeconds" | "durationSeconds" | "volume" | "shuffle" | "repeat"
  | "playbackError" | "onPlayChange" | "onSeek" | "onSeekProgress"
  | "onVolumeChange" | "onShuffleChange" | "onRepeatChange" | "onPrevious" | "onNext"
>;

interface AppPlayerProps {
  track: Dub | null;
  layout: PlayerLayoutController;
  playback: PlaybackProps;
  onOpenProfile: (username: string) => void;
  pack?: DubPack | null;
  playlist?: Omit<PackPlaylistProps, "pack">;
  playlistContainer?: HTMLElement | null;
  onShare?: () => void;
  onDownload?: () => Promise<void>;
}

function PlayerView({ fullscreen, onMinimize, children }: { fullscreen: boolean; onMinimize: () => void; children: ReactNode }) {
  return fullscreen
    ? <Modal isOpen title="Now playing" className="app-player-fullscreen" onClose={onMinimize}>{children}</Modal>
    : <>{children}</>;
}

export function AppPlayer({ track, layout, playback, onOpenProfile, pack, playlist, playlistContainer, onShare, onDownload }: AppPlayerProps) {
  const { floating, mobileEdgeDock } = layout;
  const { playing, onPlayChange } = playback;
  const [collapsedPackId, setCollapsedPackId] = useState<string | null>(null);
  const download = useAsyncSubmission("The download could not be completed. Please try again.", pack?.id ?? track?.id);
  const playlistOpen = Boolean(pack && collapsedPackId !== pack.id);
  const packPlaylist = track && pack && playlist ? <section className="app-player__pack" aria-label="Current pack playlist">
    <Button className="app-player__pack-toggle" variant="tertiary" size="small" aria-expanded={playlistOpen} leadingIcon={<ChevronDown aria-hidden="true" />}
      onClick={() => setCollapsedPackId(playlistOpen ? pack.id : null)}>
      <span className="app-player__pack-title" title={`${packTypeLabel(pack.kind)} · ${pack.title}`}>{packTypeLabel(pack.kind)} · {pack.title}</span>
      <span className="app-player__pack-position">{pack.items.findIndex(({ dub }) => dub.id === track.id) + 1}/{pack.items.length}</span>
    </Button>
    {playlistOpen && <PackPlaylist {...playlist} pack={pack} showControls={false} />}
  </section> : null;

  return (
    <div style={{ display: "contents" }}>
      {track && layout.isMinimized && <div aria-hidden="true" className="app-player-footer-target" />}
      {floating.previews.map((target) => (
        <SnapPreview
          key={target.kind}
          active={target.active}
          label={target.kind === "dock" ? (target.active ? "Release to dock player" : "Drop to dock player") : target.kind === "right-dock" ? `${target.active ? "Release" : "Drop"} to dock on the right` : target.kind === "left-edge" || target.kind === "right-edge" ? `${target.active ? "Release" : "Drop"} to dock at ${target.kind === "left-edge" ? "left" : "right"} edge` : `${target.active ? "Release" : "Drop"} to expand at ${target.kind}`}
          icon={target.kind === "left-edge" || target.kind === "right-edge" ? <span className="app-player-edge-preview">{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}<ChevronRight aria-hidden="true" style={target.kind === "right-edge" ? { transform: "rotate(180deg)" } : undefined} /></span> : undefined}
          style={target.style}
        />
      ))}
      {floating.previews.map((target) => target.active && target.previewStyle
        ? <SnapPreview key={`${target.kind}-preview`} active label="" style={target.previewStyle} />
        : null)}
      {track && (
        <PlayerView fullscreen={layout.isFullscreen} onMinimize={() => layout.selectPosition("minimized")}>
        <AudioPlayer
          {...playback}
          onClose={undefined}
          className={`app-player${layout.collapsed ? " app-player--collapsed" : ""}${mobileEdgeDock ? " app-player--edge-collapsed" : ""}`}
          colorVariant="controller"
          mediaKind={pack?.kind ?? track.mediaKind}
          contextLabel={`Global player · ${playing ? "Now playing" : "Playback paused"}`}
          ref={layout.playerRef}
          style={layout.style}
          dragHandle={layout.desktop ? undefined : <PlayerTab
            aria-label="Move audio player with arrow keys or drag; Home returns it to its original position"
            title="Drag or use arrow keys to move; press Home to return"
            className="audio-player__drag"
            onPointerDown={floating.onPointerDown}
            onPointerMove={floating.onPointerMove}
            onPointerUp={floating.onPointerUp}
            onPointerCancel={floating.onPointerCancel}
            onLostPointerCapture={floating.onLostPointerCapture}
            onKeyDown={floating.onKeyDown}
          ><MoveSolid aria-hidden="true" size={20} /></PlayerTab>}
          minimized={layout.isMinimized}
          positionMenu={layout.desktop ? <PlayerTab
            aria-label={layout.collapsed ? "Expand audio player" : "Collapse audio player"}
            aria-expanded={!layout.collapsed}
            leadingIcon={layout.collapsed ? <MaximizeSolid /> : <MinimizeSolid />}
            onClick={() => layout.changeMinimized(!layout.collapsed)}
          /> : <PlayerPositionMenu
            positions={layout.positions}
            current={layout.currentPosition}
            opacityControl={layout.opacityControl}
            onSelect={layout.selectPosition}
          />}
          onMinimizedChange={layout.desktop ? undefined : layout.changeMinimized}
          transportVariant={layout.collapsed ? "minimal" : "full"}
          distribution={pack?.distribution ?? track.distribution ?? "worldwide"}
          track={{
            title: track.title,
            artist: track.artist,
            artistAListApproved: track.artistAListApproved,
            onArtistClick: () => onOpenProfile(track.uploader),
            artworkContent: <TrackArtwork dub={track} />,
            duration: track.duration,
          }}
          variant="full"
          endAction={(onShare || onDownload) && <div className="app-player__actions" role="group" aria-label="Share and download">
            {onShare && <Button aria-label={`Share ${pack ? packTypeLabel(pack.kind) : track.mediaKind === "vocal" ? "vocal" : track.mediaKind === "sample" ? "sample" : "dub"}: ${pack?.title ?? track.title}`}
              title={pack ? "Share pack in Messenger" : `Share ${track.mediaKind === "vocal" ? "vocal" : track.mediaKind === "sample" ? "sample" : "dub"} in Messenger`} leadingIcon={<MessageCircle aria-hidden="true" />}
              size="small" variant="tertiary" onClick={onShare} />}
            {onDownload && <Button aria-label={`Download ${pack ? packTypeLabel(pack.kind) : track.mediaKind === "vocal" ? "vocal" : track.mediaKind === "sample" ? "sample" : "dub"}: ${pack?.title ?? track.title}`}
              title={pack ? "Download pack ZIP" : `Download ${track.mediaKind === "vocal" ? "vocal" : track.mediaKind === "sample" ? "sample" : "dub"}`} leadingIcon={<Download aria-hidden="true" />}
              size="small" variant="tertiary" disabled={download.pending} loading={download.pending}
              onClick={() => void download.run(onDownload)} />}
          </div>}
          metadata={(download.error || (!layout.desktop && packPlaylist)) ? <>
            {download.error && <p role="alert" className="pack-error">{download.error}</p>}
            {!layout.desktop && packPlaylist}
          </> : undefined}
        />
        </PlayerView>
      )}
      {layout.desktop && playlistContainer && packPlaylist && createPortal(packPlaylist, playlistContainer)}
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
      </div>}
    </div>
  );
}
