import {
  Check,
  Download,
  Heart,
  MoreActions,
  Plus,
} from "@craft/icons";
import { Avatar } from "../../../atoms/Avatar/Avatar";
import { Button } from "../../../atoms/Button/Button";
import { TrackTag } from "../../../atoms/TrackTag/TrackTag";
import { AudioPlayer } from "../../../organisms/AudioPlayer/AudioPlayer";
import type { Dub } from "../../communityTypes";
import {
  formatLocalTimestamp,
  formatRelativeTime,
} from "../../templateFormatters";
import { TrackArtwork } from "../../shared/TrackArtwork";

interface DubCardProps {
  dub: Dub;
  crateId?: string;
  hasLiked: boolean;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  currentTimeSeconds: number;
  durationSeconds?: number;
  volume?: number;
  shuffle?: boolean;
  repeat?: boolean;
  playbackError?: string | null;
  onSeek?: (timeSeconds: number) => void;
  onVolumeChange?: (volume: number) => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  onDownload: (dub: Dub) => void;
  onOpenProfile: (username: string) => void;
  onPlay: (dub: Dub) => void;
  onAddToCrate?: (dubId: string) => void;
  onRemoveFromCrate?: (crateId: string, dubId: string) => void;
}

export function DubCard({
  dub,
  crateId,
  hasLiked,
  isPlaying,
  isCurrentTrack,
  currentTimeSeconds,
  durationSeconds,
  volume,
  shuffle,
  repeat,
  playbackError,
  onSeek,
  onVolumeChange,
  onShuffleChange,
  onRepeatChange,
  onDownload,
  onOpenProfile,
  onPlay,
  onAddToCrate,
  onRemoveFromCrate,
}: DubCardProps) {
  return (
    <article className="dub-card">
      <div className="dub-card__topline">
        <Avatar name={dub.uploaderDisplayName} size="medium" status="active" />
        <div className="dub-card__author">
          <button
            className="text-button dub-card__username"
            onClick={() => onOpenProfile(dub.uploader)}
            type="button"
          >
            {dub.uploaderDisplayName}
          </button>
          <span className="dub-card__handle">@{dub.uploader}</span>
        </div>
        <span className="dub-card__uploaded">
          {formatRelativeTime(dub.uploadedAt)}
        </span>
        <Button
          aria-label={`More options for ${dub.title}`}
          className="app-icon-button"
          leadingIcon={<MoreActions />}
          size="small"
          variant="tertiary"
        >
          <span className="sr-only">More options</span>
        </Button>
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
            onSeek={isCurrentTrack ? onSeek : undefined}
            onVolumeChange={onVolumeChange}
            onShuffleChange={onShuffleChange}
            onRepeatChange={onRepeatChange}
            track={{
              artist: dub.artist,
              artworkContent: <TrackArtwork dub={dub} />,
              duration: dub.duration,
              onArtistClick: () => onOpenProfile(dub.uploader),
              title: dub.title,
            }}
            variant="full"
          />
          <div className="dub-card__metadata">
            {(dub.tags?.length ? dub.tags : [dub.genre]).map((tag) => (
              <TrackTag key={tag} variant="audio">{tag}</TrackTag>
            ))}
            {dub.bpm > 0 && <TrackTag>{dub.bpm} BPM</TrackTag>}
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
        <span className="dub-card__download-count">
          {dub.downloads.toLocaleString()} downloads
        </span>
        <Button
          className="dub-card__download"
          leadingIcon={hasLiked ? <Check /> : <Download />}
          onClick={() => onDownload(dub)}
          size="small"
          variant={hasLiked ? "secondary" : "primary"}
        >
          {hasLiked ? "Download again" : "Download · Like"}
        </Button>
        {crateId ? (
          <Button
            onClick={() => onRemoveFromCrate?.(crateId, dub.id)}
            size="small"
            variant="tertiary"
          >
            Remove from crate
          </Button>
        ) : onAddToCrate ? (
          <Button
            leadingIcon={<Plus />}
            onClick={() => onAddToCrate(dub.id)}
            size="small"
            variant="secondary"
          >
            Add to crate
          </Button>
        ) : null}
      </div>
    </article>
  );
}
