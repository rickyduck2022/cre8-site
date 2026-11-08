import { Check, Download, Heart, MessageCircle, Plus } from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { AListBadge } from "../../atoms/AListBadge/AListBadge";
import { Button } from "../../atoms/Button/Button";
import { TrackTag } from "../../atoms/TrackTag/TrackTag";
import { DubActionsMenu } from "../../molecules/DubActionsMenu/DubActionsMenu";
import { TrackFileMetadata } from "../../molecules/TrackFileMetadata/TrackFileMetadata";
import { AudioPlayer } from "../AudioPlayer/AudioPlayer";
import type { Dub } from "../../types/domain";
import { formatLocalTimestamp, formatRelativeTime } from "../../templates/templateFormatters";
import { TrackArtwork } from "../../templates/shared/TrackArtwork";
import "../../foundations/DistributionSurfaces.css";
import "./DubCard.css";

export interface DubCardProps {
  dub: Dub;
  crateId?: string;
  hasLiked?: boolean;
  isPlaying?: boolean;
  isCurrentTrack?: boolean;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  volume?: number;
  shuffle?: boolean;
  repeat?: boolean;
  playbackError?: string | null;
  onSeek?: (timeSeconds: number, dub: Dub) => void;
  onSeekProgress?: (progress: number, dub: Dub) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onVolumeChange?: (volume: number) => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  onDownload: (dub: Dub) => void;
  onOpenProfile?: (username: string) => void;
  onPlay: (dub: Dub) => void;
  onAddToCrate?: (dubId: string) => void;
  onRemoveFromCrate?: (crateId: string, dubId: string) => void;
  onEdit?: (dub: Dub) => void;
  onDelete?: (dub: Dub) => void;
  onShareWithFriend?: (dub: Dub) => void;
  manageable?: boolean;
}

export function DubCard({
  dub,
  crateId,
  hasLiked = false,
  isPlaying = false,
  isCurrentTrack = false,
  currentTimeSeconds = 0,
  durationSeconds,
  volume,
  shuffle,
  repeat,
  playbackError,
  onSeek,
  onSeekProgress,
  onPrevious,
  onNext,
  onVolumeChange,
  onShuffleChange,
  onRepeatChange,
  onDownload,
  onOpenProfile,
  onPlay,
  onAddToCrate,
  onRemoveFromCrate,
  onEdit,
  onDelete,
  onShareWithFriend,
  manageable = false,
}: DubCardProps) {
  const distributionLabel = dub.distribution === "private" ? "Private" : dub.distribution === "alist" ? "A-List" : "Worldwide";

  return (
    <article className={`dub-card${dub.distribution === "alist" ? " dub-card--alist" : dub.distribution === "private" ? " dub-card--private" : ""}`}>
      <div className="dub-card__topline">
        {onOpenProfile ? (
          <button aria-label={`View ${dub.uploaderDisplayName}'s profile`} className="dub-card__avatar" onClick={() => onOpenProfile(dub.uploader)} type="button">
            <Avatar name={dub.uploaderDisplayName} size="medium" src={dub.uploaderAvatarUrl} status="active" />
          </button>
        ) : <Avatar name={dub.uploaderDisplayName} size="medium" src={dub.uploaderAvatarUrl} status="active" />}
        <div className="dub-card__author">
          {onOpenProfile ? (
            <button
              className="text-button dub-card__username"
              onClick={() => onOpenProfile(dub.uploader)}
              type="button"
            >
              {dub.uploaderDisplayName}{dub.uploaderAListApproved && <AListBadge />}
            </button>
          ) : (
            <strong className="dub-card__username">{dub.uploaderDisplayName}{dub.uploaderAListApproved && <AListBadge />}</strong>
          )}
          <span className="dub-card__handle">@{dub.uploader}</span>
        </div>
        <span className="dub-card__uploaded">{formatRelativeTime(dub.uploadedAt)}</span>
      </div>

      <p className="dub-card__message">{dub.message}</p>

      <div className="dub-card__track">
        <div className="dub-card__track-info">
          <AudioPlayer
            onPlayChange={() => onPlay(dub)}
            playing={isPlaying}
            currentTimeSeconds={isCurrentTrack ? currentTimeSeconds : 0}
            durationSeconds={isCurrentTrack ? durationSeconds : undefined}
            volume={volume}
            shuffle={shuffle}
            repeat={repeat}
            playbackError={playbackError}
            onSeek={onSeek ? (time) => onSeek(time, dub) : undefined}
            onSeekProgress={onSeekProgress ? (progress) => onSeekProgress(progress, dub) : undefined}
            onPrevious={onPrevious}
            onNext={onNext}
            onVolumeChange={onVolumeChange}
            onShuffleChange={onShuffleChange}
            onRepeatChange={onRepeatChange}
            track={{
              artist: dub.artist,
              artistAListApproved: dub.artistAListApproved,
              artworkContent: <TrackArtwork dub={dub} />,
              duration: dub.duration,
              onArtistClick: onOpenProfile ? () => onOpenProfile(dub.uploader) : undefined,
              title: dub.title,
            }}
            variant="full"
          />
          <div className="dub-card__metadata">
            <div className="dub-card__metadata-tags">
              {(dub.tags?.length ? dub.tags : [dub.genre]).map((tag) => (
                <TrackTag key={tag} variant="audio">{tag}</TrackTag>
              ))}
              {dub.bpm > 0 && <TrackTag>{dub.bpm} BPM</TrackTag>}
              <TrackFileMetadata
                audioFileName={dub.audioFileName}
                bitrateKbps={dub.bitrateKbps}
                fileType={dub.audioFormat}
              />
            </div>
            <TrackTag
              aria-label={`Distribution: ${distributionLabel}`}
              className={`dub-card__distribution dub-card__distribution--${dub.distribution ?? "worldwide"}`}
              variant="accent"
            >
              {distributionLabel}
            </TrackTag>
          </div>
          <time className="dub-card__timestamp" dateTime={dub.uploadedAt}>
            Uploaded: {formatLocalTimestamp(dub.uploadedAt)}
          </time>
        </div>
      </div>

      <div className="dub-card__footer">
        <span className="dub-card__likes" aria-label={`${dub.likes} likes`}>
          <Heart aria-hidden="true" />
          <strong>{dub.likes}</strong>
          {hasLiked && <span className="dub-card__you-liked">You downloaded</span>}
        </span>
        <span className="dub-card__download-count">{dub.downloads.toLocaleString()} downloads</span>
        <Button
          className="dub-card__download"
          leadingIcon={hasLiked ? <Check /> : <Download />}
          onClick={() => onDownload(dub)}
          size="small"
          variant={hasLiked ? "secondary" : "primary"}
        >
          {hasLiked ? "Download again" : "Download · Like"}
        </Button>
        {onShareWithFriend && (
          <Button aria-label={`Share ${dub.title} with a friend`} leadingIcon={<MessageCircle />} onClick={() => onShareWithFriend(dub)} size="small" variant="secondary">
            Share
          </Button>
        )}
        {manageable && onEdit && onDelete && (
          <DubActionsMenu
            iconOnly
            onDelete={() => onDelete(dub)}
            onEdit={() => onEdit(dub)}
            title={dub.title}
          />
        )}
        {crateId ? (
          <Button onClick={() => onRemoveFromCrate?.(crateId, dub.id)} size="small" variant="tertiary">
            Remove from crate
          </Button>
        ) : onAddToCrate ? (
          <Button leadingIcon={<Plus />} onClick={() => onAddToCrate(dub.id)} size="small" variant="secondary">
            Add to crate
          </Button>
        ) : null}
      </div>
    </article>
  );
}
