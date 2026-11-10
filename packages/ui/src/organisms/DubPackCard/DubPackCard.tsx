import { useId, useState } from "react";
import { AudioLines, ChevronDown } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { TrackArtwork } from "../../templates/shared/TrackArtwork";
import { useAsyncSubmission } from "../../utils/useAsyncSubmission";
import type { DubCardProps } from "../DubCard/DubCard";
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

export function DubPackIdentity({ pack, compact = false }: { pack: DubPack; compact?: boolean }) {
  const seconds = pack.items.reduce((total, { dub }) => {
    const [minutes, seconds] = dub.duration.split(":").map(Number);
    return total + (Number.isFinite(minutes + seconds) ? minutes * 60 + seconds : 0);
  }, 0);
  const Heading = compact ? "h2" : "h1";
  return <header className={`pack-identity${compact ? " pack-identity--compact" : ""}`}>
    <div className="pack-artwork">
      {pack.artworkUrl ? <img src={pack.artworkUrl} alt="" />
        : pack.items[0] ? <TrackArtwork dub={pack.items[0].dub} large />
          : <AudioLines aria-hidden="true" />}
    </div>
    <div className="pack-identity__details">
      <div className="pack-badges">
        <span className="eyebrow">{packTypeLabel(pack.kind)}</span>
        <Badge variant={pack.status === "draft" ? "default" : "audio"}>{pack.status === "draft" ? "Draft" : "Published"}</Badge>
        <Badge variant="default">{packAudience(pack)}</Badge>
      </div>
      <Heading>{pack.title}</Heading>
      <p className="pack-muted">{pack.ownerDisplayName}</p>
      <p className="pack-muted">{packFileCount(pack.kind, pack.items.length)} · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} · {packSize(pack.totalBytes)}</p>
      {!compact && pack.description && <p className="pack-description">{pack.description}</p>}
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
  onPlayAll: (dubs: Dub[]) => void;
  onOpenPack: (pack: DubPack) => void;
  onDownloadPack?: (pack: DubPack) => Promise<void>;
  matchingDubIds?: Set<string>;
}

export function DubPackCard({
  pack, nowPlayingId, isPlaying, likedDubIds, onPlayAll, onOpenPack, onDownloadPack, matchingDubIds, ...playback
}: DubPackCardProps) {
  const [expanded, setExpanded] = useState(false);
  const playlistId = useId();
  const download = useAsyncSubmission("The pack could not be downloaded.", pack.id);
  const matches = pack.items.filter(({ dub }) => !matchingDubIds || matchingDubIds.has(dub.id));
  const playing = pack.items.some(({ dub }) => dub.id === nowPlayingId);
  return <article className={`dub-pack-card${playing ? " dub-pack-card--current" : ""}`} aria-label={`${packTypeLabel(pack.kind)}: ${pack.title}`}>
    <DubPackIdentity pack={pack} compact />
    <div className="dub-pack-card__actions">
      <Button size="small" disabled={!pack.items.length} onClick={() => onPlayAll(pack.items.map(({ dub }) => dub))}>Play all</Button>
      <Button size="small" variant="secondary" aria-expanded={expanded} aria-controls={playlistId} onClick={() => setExpanded(!expanded)}
        leadingIcon={<ChevronDown aria-hidden="true" />}>{expanded ? "Hide playlist" : `Show ${packFileCount(pack.kind, pack.items.length)}`}</Button>
      {onDownloadPack && <Button size="small" variant="secondary" disabled={download.pending} loading={download.pending}
        onClick={() => void download.run(() => onDownloadPack(pack))}>Download ZIP</Button>}
      <Button size="small" variant="tertiary" onClick={() => onOpenPack(pack)}>Open pack</Button>
    </div>
    {playing && <p className="dub-pack-card__status" role="status">{isPlaying ? "Now playing from this pack" : "Pack playback paused"}</p>}
    {download.error && <p className="dub-pack-card__error" role="alert">{download.error}</p>}
    <div id={playlistId} hidden={!expanded}>
      {expanded && matches.length !== pack.items.length && <p className="pack-muted">{packFileCount(pack.kind, matches.length)} {matches.length === 1 ? "matches" : "match"} your filters. Open the pack to see all files.</p>}
      {expanded && <PackPlaylist {...playback} pack={pack} nowPlayingId={nowPlayingId} isPlaying={isPlaying}
        likedDubIds={likedDubIds} onPlayAll={onPlayAll} matchingDubIds={matchingDubIds} />}
    </div>
  </article>;
}
