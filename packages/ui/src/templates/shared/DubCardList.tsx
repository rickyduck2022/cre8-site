import { DubCard, type DubCardProps } from "../../organisms/DubCard/DubCard";
import { canShareDub } from "../../organisms/ShareDubDialog/ShareDubDialog";
import type { Dub } from "../communityTypes";
import { formatLocalTimestamp } from "../templateFormatters";

export interface DubCardListProps extends Pick<DubCardProps,
  "onDownload" | "onOpenProfile" | "onSeek" | "onSeekProgress" | "onPrevious" | "onNext" |
  "onVolumeChange" | "onShuffleChange" | "onRepeatChange" | "onEdit" | "onDelete" | "onShareWithFriend" |
  "currentTimeSeconds" | "durationSeconds" | "volume" | "shuffle" | "repeat" | "playbackError"> {
  entries: Array<{ dub: Dub; downloadedAt?: string }>;
  label: string;
  currentUsername?: string;
  likedDubIds?: Set<string>;
  nowPlayingId?: string | null;
  isPlaying?: boolean;
  onPlay: (dub: Dub) => void;
}

export function DubCardList({
  entries, label, currentUsername, likedDubIds, nowPlayingId, isPlaying,
  onPlay, onDownload, onOpenProfile, onSeek, onSeekProgress, onPrevious, onNext,
  onVolumeChange, onShuffleChange, onRepeatChange, onEdit, onDelete, onShareWithFriend,
  currentTimeSeconds, durationSeconds, volume, shuffle, repeat, playbackError,
}: DubCardListProps) {
  return (
    <ul className="dub-card-list feed-list" aria-label={label}>
      {entries.map(({ dub, downloadedAt }, index) => (
        <li key={`${dub.id}-${downloadedAt ?? ""}-${index}`}>
          <DubCard
            dub={dub}
            hasLiked={likedDubIds?.has(dub.id) ?? Boolean(downloadedAt)}
            isPlaying={Boolean(isPlaying && nowPlayingId === dub.id)}
            isCurrentTrack={nowPlayingId === dub.id}
            currentTimeSeconds={currentTimeSeconds}
            durationSeconds={durationSeconds}
            volume={volume}
            shuffle={shuffle}
            repeat={repeat}
            playbackError={nowPlayingId === dub.id ? playbackError : undefined}
            onSeek={onSeek}
            onSeekProgress={onSeekProgress}
            onPrevious={onPrevious}
            onNext={onNext}
            onVolumeChange={onVolumeChange}
            onShuffleChange={onShuffleChange}
            onRepeatChange={onRepeatChange}
            onDownload={onDownload}
            onOpenProfile={onOpenProfile}
            onPlay={onPlay}
            manageable={Boolean(currentUsername && dub.uploader === currentUsername)}
            onEdit={onEdit}
            onDelete={onDelete}
            onShareWithFriend={currentUsername && canShareDub(dub, currentUsername) ? onShareWithFriend : undefined}
          />
          {downloadedAt && <time className="dub-card-list__downloaded" dateTime={downloadedAt}>Downloaded {formatLocalTimestamp(downloadedAt)}</time>}
        </li>
      ))}
    </ul>
  );
}
