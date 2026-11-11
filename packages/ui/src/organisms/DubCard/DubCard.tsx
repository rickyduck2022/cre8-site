import type { ReactNode } from "react";
import { Check, Download, Heart, MessageCircle, Plus } from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { AListBadge } from "../../atoms/AListBadge/AListBadge";
import { Button } from "../../atoms/Button/Button";
import { TrackTag } from "../../atoms/TrackTag/TrackTag";
import { DubActionsMenu } from "../../molecules/DubActionsMenu/DubActionsMenu";
import { CardActions } from "../../molecules/CardActions/CardActions";
import { NowPlaying } from "../../molecules/NowPlaying/NowPlaying";
import { TrackFileMetadata } from "../../molecules/TrackFileMetadata/TrackFileMetadata";
import { AudioPlayer, type AudioPlayerProps } from "../AudioPlayer/AudioPlayer";
import type { Dub, MediaKind } from "../../types/domain";
import { formatLocalTimestamp, formatRelativeTime } from "../../utils/formatters";
import { TrackArtwork } from "../../molecules/TrackArtwork/TrackArtwork";
import "../../foundations/MediaPalette.css";
import { useMobileLayout } from "../../utils/useMobileLayout";
import "../../foundations/DistributionSurfaces.css";
import "./DubCard.css";

export interface DubCardProps {
  dub: Dub;
  variant?: "default" | "playlist";
  mediaKind?: MediaKind;
  trackNumber?: number;
  musicalKey?: string;
  playbackDisabled?: boolean;
  downloadDisabled?: boolean;
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
  onManageAccess?: () => void;
  onAddToPack?: (dub: Dub) => void;
  manageable?: boolean;
}

export interface DubCardCollectionProps {
  variant: "collection";
  mediaKind?: MediaKind;
  distribution?: Dub["distribution"];
  label: string;
  className?: string;
  header: ReactNode;
  actions: ReactNode;
  player?: AudioPlayerProps;
  playbackLabel: string;
  playbackDisabled?: boolean;
  isCurrentTrack?: boolean;
  children?: ReactNode;
}

function DistributionTag({ distribution = "worldwide" }: { distribution?: Dub["distribution"] }) {
  const label = distribution === "private" ? "Private" : distribution === "alist" ? "A-List" : "Worldwide";
  return (
    <TrackTag aria-label={`Distribution: ${label}`} className={`dub-card__distribution dub-card__distribution--${distribution}`} variant="accent">
      {label}
    </TrackTag>
  );
}

export interface CompactDubCardProps {
  dub: Dub;
  action: ReactNode;
  onOpenProfile?: (username: string) => void;
  shared?: boolean;
}

export function CompactDubCard({ dub, action, onOpenProfile, shared = false }: CompactDubCardProps) {
  return (
    <article className={`dub-card dub-card--compact${dub.distribution === "alist" ? " dub-card--alist" : dub.distribution === "private" ? " dub-card--private" : ""}`}>
      <NowPlaying
        artist={dub.artist}
        artistAListApproved={dub.artistAListApproved}
        artworkContent={<TrackArtwork dub={dub} />}
        isPlaying={false}
        onArtistClick={onOpenProfile ? () => onOpenProfile(dub.uploader) : undefined}
        title={dub.title}
      />
      <div className="dub-card__compact-footer">
        <DistributionTag distribution={dub.distribution} />
        {shared && <span className="dub-card__compact-shared">Shared</span>}
        {action}
      </div>
    </article>
  );
}

export function DubCard(props: DubCardProps | DubCardCollectionProps) {
  if (props.variant === "collection") {
    const { label, className, mediaKind = "dub", distribution = props.player?.distribution, header, actions, player, playbackLabel, playbackDisabled, isCurrentTrack, children } = props;
    return <article aria-label={label} className={["dub-card", "vault-panel", "dub-card--collection", `media-kind--${mediaKind}`, distribution === "alist" && "dub-card--alist", isCurrentTrack && "dub-card--current", className].filter(Boolean).join(" ")}>
      {header}
      {actions}
      {player && <fieldset className="dub-card__collection-player" disabled={playbackDisabled} aria-label={playbackLabel}>
        <AudioPlayer mediaKind={mediaKind} {...player} variant="full" transportVariant="full"
          className={isCurrentTrack ? "dub-card__player--current" : undefined}
          onSeek={playbackDisabled ? undefined : player.onSeek}
          onSeekProgress={playbackDisabled ? undefined : player.onSeekProgress} />
      </fieldset>}
      {children}
    </article>;
  }
  return <TrackDubCard {...props} />;
}

function TrackDubCard({
  dub,
  mediaKind = dub.mediaKind ?? "dub",
  variant = "default",
  trackNumber,
  musicalKey,
  playbackDisabled = false,
  downloadDisabled = false,
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
  onManageAccess,
  onAddToPack,
  manageable = false,
}: DubCardProps) {
  const mobile = useMobileLayout();
  const actions = manageable && onEdit && onDelete ? (
    <DubActionsMenu
      iconOnly
      onAddToPack={onAddToPack ? () => onAddToPack(dub) : undefined}
      onDelete={() => onDelete(dub)}
      onEdit={() => onEdit(dub)}
      title={dub.title}
    />
  ) : null;
  const downloadAndShare = [
      <Button
        key="download"
        disabled={downloadDisabled}
        aria-label={mobile ? (hasLiked ? "Download again" : "Download and like") : undefined}
        className={`dub-card__download${mobile && !hasLiked ? " dub-card__download--mobile-label" : ""}`}
        leadingIcon={hasLiked ? <Check /> : <Download />}
        onClick={() => onDownload(dub)}
        size="small"
        variant={hasLiked ? "secondary" : "primary"}
      >
        {(!mobile || !hasLiked) && (hasLiked ? "Download again" : "Download · Like")}
      </Button>,
      onShareWithFriend && (
        <Button key="share" aria-label={`Share ${dub.title}`} leadingIcon={<MessageCircle />} onClick={() => onShareWithFriend(dub)} size="small" variant="secondary">
          {!mobile && "Share"}
        </Button>
      ),
  ];
  const manageAccess = manageable && dub.distribution === "private" && onManageAccess && (
    <Button
      aria-label={`Manage access for ${dub.title}, ${dub.grants?.length ?? 0} ${dub.grants?.length === 1 ? "recipient" : "recipients"}`}
      className="dub-card__manage-access" onClick={onManageAccess} size="small" variant="secondary">
      Manage access · {dub.grants?.length ?? 0}
    </Button>
  );
  const crateAction = crateId ? (
    <Button onClick={() => onRemoveFromCrate?.(crateId, dub.id)} size="small" variant="tertiary">
      Remove from crate
    </Button>
  ) : onAddToCrate ? (
    <Button leadingIcon={<Plus />} onClick={() => onAddToCrate(dub.id)} size="small" variant="secondary">
      Add to crate
    </Button>
  ) : null;
  const likes = (
    <span className="dub-card__likes" aria-label={`${dub.likes} likes`}>
      <Heart aria-hidden="true" />
      <strong>{dub.likes}</strong>
      {hasLiked && <span className="dub-card__you-liked">You downloaded</span>}
    </span>
  );

  if (variant === "playlist") {
    return (
      <article aria-label={dub.title} className={`dub-card dub-card--playlist media-kind--${mediaKind}${isCurrentTrack ? " dub-card--current" : ""}${dub.distribution === "alist" ? " dub-card--alist" : dub.distribution === "private" ? " dub-card--private" : ""}`}>
        <div className="dub-card__playlist-track">
          {trackNumber !== undefined && <span className="dub-card__track-number" aria-label={`Track ${trackNumber}`}>{trackNumber}</span>}
          <fieldset className="dub-card__playlist-player" disabled={playbackDisabled} aria-label={`Playback for ${dub.title}`}>
            <AudioPlayer
              mediaKind={mediaKind}
              className={isCurrentTrack ? "dub-card__player--current" : undefined}
              distribution={dub.distribution ?? "worldwide"}
              transportVariant="minimal"
              variant="inline"
              onPlayChange={() => onPlay(dub)}
              playing={isPlaying}
              currentTimeSeconds={isCurrentTrack ? currentTimeSeconds : 0}
              durationSeconds={isCurrentTrack ? durationSeconds : undefined}
              playbackError={isCurrentTrack ? playbackError : undefined}
              onSeek={!playbackDisabled && onSeek ? (time) => onSeek(time, dub) : undefined}
              onSeekProgress={!playbackDisabled && onSeekProgress ? (progress) => onSeekProgress(progress, dub) : undefined}
              volume={volume}
              onVolumeChange={onVolumeChange}
              contextLabel={isCurrentTrack ? (isPlaying ? "Now playing" : "Paused") : undefined}
              track={{
                artist: dub.artist,
                artistAListApproved: dub.artistAListApproved,
                artworkContent: <TrackArtwork dub={dub} />,
                duration: dub.duration,
                onArtistClick: onOpenProfile ? () => onOpenProfile(dub.uploader) : undefined,
                title: dub.title,
              }}
            />
          </fieldset>
        </div>
        <div className="dub-card__playlist-footer">
          <div className="dub-card__metadata-tags">
            {dub.bpm > 0 && <TrackTag>{dub.bpm} BPM</TrackTag>}
            {musicalKey && <TrackTag>{musicalKey}</TrackTag>}
            <TrackFileMetadata audioFileName={dub.audioFileName} bitrateKbps={dub.bitrateKbps} fileType={dub.audioFormat} />
          </div>
          <CardActions title={dub.title} className="dub-card__playlist-actions">{downloadAndShare}</CardActions>
        </div>
      </article>
    );
  }

  return (
    <article className={`dub-card vault-panel media-kind--${mediaKind}${dub.distribution === "alist" ? " dub-card--alist" : dub.distribution === "private" ? " dub-card--private" : ""}`}>
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
        <div className="dub-card__topline-end">
          <span className="dub-card__uploaded">{formatRelativeTime(dub.uploadedAt)}</span>
          {mobile && actions}
        </div>
      </div>

      <p className="dub-card__message">{dub.message}</p>

      <div className="dub-card__track">
        <div className="dub-card__track-info">
          <AudioPlayer
            mediaKind={mediaKind}
            className={isCurrentTrack || isPlaying ? "dub-card__player--current" : undefined}
            distribution={dub.distribution ?? "worldwide"}
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
            contextLabel={isCurrentTrack ? (isPlaying ? "Now playing" : "Paused") : undefined}
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
            <div className="dub-card__metadata-details">
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
              {mobile && <div className="dub-card__mobile-details">
                {likes}
                <time className="dub-card__timestamp" dateTime={dub.uploadedAt} title={formatLocalTimestamp(dub.uploadedAt)}>
                  {new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(dub.uploadedAt))}
                </time>
              </div>}
            </div>
            <div className="dub-card__distribution-column">
              <DistributionTag distribution={dub.distribution} />
            </div>
            {!mobile && manageAccess}
          </div>
          {!mobile && <time className="dub-card__timestamp" dateTime={dub.uploadedAt}>
            Uploaded: {formatLocalTimestamp(dub.uploadedAt)}
          </time>}
        </div>
      </div>

      <div className="dub-card__footer">
        {!mobile && likes}
        {!mobile && <span className="dub-card__download-count">{dub.downloads.toLocaleString()} downloads</span>}
        {!mobile && downloadAndShare}
        {!mobile && actions}
        {mobile ? <CardActions title={dub.title} className="dub-card__mobile-actions">
          {downloadAndShare}
          {manageAccess}
          {crateAction}
        </CardActions> : crateAction}
      </div>
    </article>
  );
}
