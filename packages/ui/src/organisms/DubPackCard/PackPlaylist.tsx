import { TransportControls } from "../../molecules/TransportControls/TransportControls";
import { DubCard, type DubCardProps } from "../DubCard/DubCard";
import type { Dub, DubPack } from "../../types/domain";

export interface PackQueueControls {
  activePackId?: string | null;
  onActivateQueue?: (dubs: Dub[], packId?: string) => boolean | void;
  onPrevious?: () => void;
  onNext?: () => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  shuffle?: boolean;
  repeat?: boolean;
}

export interface PackPlaylistProps extends PackQueueControls, Pick<DubCardProps,
  "currentTimeSeconds" | "durationSeconds" | "volume" | "playbackError" |
  "onPlay" | "onDownload" | "onSeek" | "onSeekProgress" | "onVolumeChange" | "onOpenProfile" | "downloadDisabled"> {
  pack: DubPack;
  nowPlayingId: string | null;
  isPlaying: boolean;
  likedDubIds?: Set<string>;
  onPlayAll: (dubs: Dub[], packId?: string) => void;
  matchingDubIds?: Set<string>;
  disabled?: boolean;
  label?: string;
  showControls?: boolean;
  preview?: boolean;
}

export function PackPlaylist({
  pack, nowPlayingId, isPlaying, likedDubIds, onPlayAll, matchingDubIds, disabled = false, label,
  activePackId, onActivateQueue, onPrevious, onNext, onShuffleChange, onRepeatChange, shuffle, repeat,
  onPlay, onSeek, onSeekProgress, showControls = true, preview = false, ...playback
}: PackPlaylistProps) {
  const tracks = pack.items.map(({ dub }) => dub);
  const active = activePackId === undefined || activePackId === pack.id;
  const current = active ? tracks.find((dub) => dub.id === nowPlayingId) : undefined;
  function withinPack(action: () => void) {
    if (!disabled && onActivateQueue?.(tracks, pack.id) !== false) action();
  }
  return <div className="pack-playlist">
    {showControls && onActivateQueue && <fieldset className="pack-playlist__controls" disabled={disabled || !tracks.length} aria-label={`${pack.title} playback controls`}>
      <TransportControls playing={Boolean(current && isPlaying)} shuffle={shuffle} repeat={repeat}
        onPlayChange={() => withinPack(() => current ? onPlay(current) : onPlayAll(tracks, pack.id))}
        onPrevious={() => withinPack(() => onPrevious?.())} onNext={() => withinPack(() => onNext?.())}
        onShuffleChange={(value) => withinPack(() => onShuffleChange?.(value))}
        onRepeatChange={(value) => withinPack(() => onRepeatChange?.(value))} />
      <span className="pack-muted">This pack only · Loop repeats the playlist</span>
    </fieldset>}
    <ol className="dub-pack-card__playlist" aria-label={label ?? `${pack.title} playlist`}>
      {pack.items.map(({ dub, key }, index) => (!matchingDubIds || matchingDubIds.has(dub.id)) && <li key={dub.id}>
        {preview && <p className="pack-muted">Preview &middot; {dub.duration} maximum &middot; reduced quality</p>}
        <DubCard {...playback} dub={dub} mediaKind={pack.kind} variant="playlist" trackNumber={index + 1} musicalKey={key}
          playbackDisabled={disabled} hasLiked={likedDubIds ? likedDubIds.has(dub.id) : dub.likedByCurrentUser === true}
          isCurrentTrack={active && dub.id === nowPlayingId} isPlaying={active && dub.id === nowPlayingId && isPlaying}
          onPlay={(track) => withinPack(() => onPlay(track))}
          onSeek={onSeek ? (time, track) => withinPack(() => onSeek(time, track)) : undefined}
          onSeekProgress={onSeekProgress ? (progress, track) => withinPack(() => onSeekProgress(progress, track)) : undefined}
          playbackError={dub.id === nowPlayingId ? playback.playbackError : undefined} />
      </li>)}
    </ol>
  </div>;
}
