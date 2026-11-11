import { useId, useState } from "react";
import { AudioLines, ChevronDown, MessageCircle } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { TrackArtwork } from "../../molecules/TrackArtwork/TrackArtwork";
import { PackPlaybackButton } from "../../molecules/PackPlaybackButton/PackPlaybackButton";
import { CardActions } from "../../molecules/CardActions/CardActions";
import { useAsyncSubmission } from "../../utils/useAsyncSubmission";
import { DubCard, type DubCardProps } from "../DubCard/DubCard";
import { PackPlaylist, type PackQueueControls } from "./PackPlaylist";
import type { Dub, DubPack } from "../../types/domain";
import "./DubPackCard.css";

export type { DubPack } from "../../types/domain";

export function packTypeLabel(kind: DubPack["kind"]) {
  return kind === "sample" ? "Sample Pack" : "Dub Pack";
}

export function packAudience(pack: Pick<DubPack, "distribution" | "aListPublic">) {
  if (pack.distribution === "alist") return pack.aListPublic ? "Public A-List" : "A-List";
  return pack.distribution === "private" ? "Private" : "Worldwide";
}

export function packFileCount(kind: DubPack["kind"], count: number) {
  const noun = kind === "sample" ? "sample" : "track";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function packSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DubPackIdentity({ pack, compact = false, onEdit }: { pack: DubPack; compact?: boolean; onEdit?: () => void }) {
  const seconds = pack.items.reduce((total, { dub }) => {
    const [minutes, seconds] = dub.duration.split(":").map(Number);
    return total + (Number.isFinite(minutes + seconds) ? minutes * 60 + seconds : 0);
  }, 0);
  const Heading = compact ? "h2" : "h1";
  return <header className={`pack-identity${compact ? " pack-identity--compact" : ""}${pack.distribution === "alist" ? " pack-identity--alist" : ""}`}>
    <div className="pack-artwork">
      {pack.artworkUrl ? <img src={pack.artworkUrl} alt="" />
        : pack.items[0] ? <TrackArtwork dub={pack.items[0].dub} large />
          : <AudioLines aria-hidden="true" />}
    </div>
    <div className="pack-identity__details">
      <div className="pack-badges">
        <span className="eyebrow">{packTypeLabel(pack.kind)}</span>
        <Badge variant={pack.status === "draft" ? "default" : "audio"}>{pack.status === "draft" ? "Draft" : "Published"}</Badge>
        <Badge variant={pack.distribution === "alist" ? "accent" : "default"}>{packAudience(pack)}</Badge>
      </div>
      <Heading>{pack.title}</Heading>
      <p className="pack-muted">{pack.ownerDisplayName}</p>
      <p className="pack-muted">{packFileCount(pack.kind, pack.items.length)} · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} · {packSize(pack.totalBytes)}</p>
      {!compact && pack.description && <p className="pack-description">{pack.description}</p>}
      {onEdit && <div className="pack-identity__edit"><Button size="small" variant="secondary" onClick={onEdit}>Edit pack</Button></div>}
    </div>
  </header>;
}

export interface DubPackCardProps extends PackQueueControls, Pick<DubCardProps,
  "currentTimeSeconds" | "durationSeconds" | "volume" | "playbackError" |
  "onPlay" | "onDownload" | "onSeek" | "onSeekProgress" | "onVolumeChange" | "onOpenProfile"> {
  pack: DubPack;
  nowPlayingId: string | null;
  isPlaying: boolean;
  likedDubIds: Set<string>;
  onPlayAll: (dubs: Dub[], packId?: string) => void;
  onSharePack?: (pack: DubPack) => void;
  onOpenPack: (pack: DubPack) => void;
  onEditPack?: (pack: DubPack) => void;
  currentUsername?: string;
  onDownloadPack?: (pack: DubPack) => Promise<void>;
  matchingDubIds?: Set<string>;
}

export function DubPackCard({
  pack, nowPlayingId, isPlaying, activePackId, likedDubIds, onPlayAll, onOpenPack, onEditPack, currentUsername, onDownloadPack, onSharePack, matchingDubIds, ...playback
}: DubPackCardProps) {
  const [expanded, setExpanded] = useState(false);
  const playlistId = useId();
  const download = useAsyncSubmission("The pack could not be downloaded.", pack.id);
  const matches = pack.items.filter(({ dub }) => !matchingDubIds || matchingDubIds.has(dub.id));
  const tracks = pack.items.map(({ dub }) => dub);
  const current = activePackId === undefined || activePackId === pack.id ? tracks.find((dub) => dub.id === nowPlayingId) : undefined;
  const playing = Boolean(current);
  const track = current ?? tracks[0];
  const disabled = pack.status !== "published" || !tracks.length;
  function withinPack(action: () => void) {
    if (!disabled && playback.onActivateQueue?.(tracks, pack.id) !== false) action();
  }
  return <DubCard variant="collection" mediaKind={pack.kind} distribution={pack.distribution} className={`dub-pack-card${playing ? " dub-pack-card--current" : ""}`}
    label={`${packTypeLabel(pack.kind)}: ${pack.title}`} isCurrentTrack={playing}
    header={<DubPackIdentity pack={pack} compact onEdit={onEditPack && currentUsername === pack.ownerUsername ? () => onEditPack(pack) : undefined} />}
    playbackLabel={`${pack.title} playback controls`} playbackDisabled={disabled}
    player={track ? {
      track: {
        title: track.title, artist: track.artist, duration: track.duration,
        artistAListApproved: track.artistAListApproved,
        artworkContent: <TrackArtwork dub={track} />,
        onArtistClick: playback.onOpenProfile ? () => playback.onOpenProfile?.(track.uploader) : undefined,
      },
      distribution: pack.distribution,
      playing: playing && isPlaying,
      currentTimeSeconds: playing ? playback.currentTimeSeconds : 0,
      durationSeconds: playing ? playback.durationSeconds : undefined,
      playbackError: playing ? playback.playbackError : undefined,
      contextLabel: playing ? (isPlaying ? "Now playing" : "Paused") : undefined,
      volume: playback.volume, onVolumeChange: playback.onVolumeChange,
      shuffle: playback.shuffle, repeat: playback.repeat,
      onPlayChange: () => withinPack(() => current ? playback.onPlay(current) : onPlayAll(tracks, pack.id)),
      onPrevious: playback.onPrevious ? () => withinPack(() => playback.onPrevious?.()) : undefined,
      onNext: playback.onNext ? () => withinPack(() => playback.onNext?.()) : undefined,
      onShuffleChange: playback.onShuffleChange ? (value) => withinPack(() => playback.onShuffleChange?.(value)) : undefined,
      onRepeatChange: playback.onRepeatChange ? (value) => withinPack(() => playback.onRepeatChange?.(value)) : undefined,
      onSeek: playback.onSeek ? (time) => withinPack(() => playback.onSeek?.(time, track)) : undefined,
      onSeekProgress: playback.onSeekProgress ? (progress) => withinPack(() => playback.onSeekProgress?.(progress, track)) : undefined,
    } : undefined}
    actions={<CardActions title={pack.title} className="dub-pack-card__actions">
      <PackPlaybackButton kind={pack.kind} playing={playing && isPlaying} size="small" disabled={disabled}
        onClick={() => withinPack(() => current ? playback.onPlay(current) : onPlayAll(tracks, pack.id))} />
      <Button size="small" variant={expanded ? "audio" : "secondary"} className={`dub-pack-card__toggle media-kind--${pack.kind}`}
        aria-expanded={expanded} aria-controls={playlistId} onClick={() => setExpanded(!expanded)}
        leadingIcon={<ChevronDown aria-hidden="true" />}>{expanded ? "Hide playlist" : `Show ${packFileCount(pack.kind, pack.items.length)}`}</Button>
      {onDownloadPack && <Button size="small" variant="secondary" disabled={disabled || download.pending} loading={download.pending}
        onClick={() => void download.run(() => onDownloadPack(pack))}>Download ZIP</Button>}
      {onSharePack && <Button size="small" variant="secondary" disabled={disabled} leadingIcon={<MessageCircle aria-hidden="true" />}
        onClick={() => onSharePack(pack)}>Share pack</Button>}
      <Button size="small" variant="primary" onClick={() => onOpenPack(pack)}>Open pack</Button>
    </CardActions>}>
    {track && <p className="pack-muted dub-pack-card__queue-hint">This pack only · Loop repeats the playlist</p>}
    {playing && <p className="dub-pack-card__status" role="status">{isPlaying ? "Now playing from this pack" : "Pack playback paused"}</p>}
    {download.error && <p className="dub-pack-card__error" role="alert">{download.error}</p>}
    <div id={playlistId} hidden={!expanded}>
      {expanded && matches.length !== pack.items.length && <p className="pack-muted">{packFileCount(pack.kind, matches.length)} {matches.length === 1 ? "matches" : "match"} your filters. Open the pack to see all files.</p>}
      {expanded && <PackPlaylist {...playback} activePackId={activePackId} pack={pack} nowPlayingId={nowPlayingId} isPlaying={isPlaying}
        likedDubIds={likedDubIds} onPlayAll={onPlayAll} matchingDubIds={matchingDubIds}
        showControls={false} disabled={disabled} downloadDisabled={disabled} />}
    </div>
  </DubCard>;
}
