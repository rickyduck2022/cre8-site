import {
  AudioLines,
  Heart,
  MessageCircle,
  MoreActions,
} from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Button } from "../../atoms/Button/Button";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { DubCard } from "../../organisms/DubCard/DubCard";
import type { Dub, MemberProfile } from "../communityTypes";
import { formatRelativeTime } from "../templateFormatters";
import "../CommunityPageTemplates.css";
import "./ProfileTemplate.css";

export interface ProfileTemplateProps {
  profile: MemberProfile;
  uploads: Dub[];
  isOwnProfile: boolean;
  playingDubId: string | null;
  isPlaying: boolean;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  volume?: number;
  shuffle?: boolean;
  repeat?: boolean;
  playbackError?: string | null;
  onSeek?: (timeSeconds: number, dub: Dub) => void;
  onSeekProgress?: (progress: number, dub: Dub) => void;
  onVolumeChange?: (volume: number) => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onEditProfile: () => void;
  onMessage: () => void;
  onPlay: (dub: Dub) => void;
  onDownload: (dub: Dub) => void;
  onOpenProfile?: (username: string) => void;
  onEditDub?: (dub: Dub) => void;
  onDeleteDub?: (dub: Dub) => void;
}

export function ProfileTemplate({
  profile,
  uploads,
  isOwnProfile,
  playingDubId,
  isPlaying,
  currentTimeSeconds,
  durationSeconds,
  volume,
  shuffle,
  repeat,
  playbackError,
  onSeek,
  onSeekProgress,
  onVolumeChange,
  onShuffleChange,
  onRepeatChange,
  onPrevious,
  onNext,
  onEditProfile,
  onMessage,
  onPlay,
  onDownload,
  onOpenProfile,
  onEditDub,
  onDeleteDub,
}: ProfileTemplateProps) {
  const uploadsPagination = usePagination(uploads, profile.id);
  return (
    <div className="profile-template">
      <section className="profile-hero">
        <div className="profile-hero__art" aria-hidden="true" style={profile.bannerUrl ? { backgroundImage: `linear-gradient(90deg, rgba(10,12,18,.55), rgba(10,12,18,.05)), url("${profile.bannerUrl}")` } : undefined}>
          <span className="profile-hero__orb profile-hero__orb--one" />
          <span className="profile-hero__orb profile-hero__orb--two" />
        </div>
        <div className="profile-hero__content">
          <Avatar
            className="profile-hero__avatar"
            name={profile.displayName}
            src={profile.avatarUrl}
            size="large"
          />
          <div className="profile-hero__identity">
            <span className="eyebrow">{isOwnProfile ? "YOUR PROFILE" : "MEMBER PROFILE"}</span>
            <h1>{profile.displayName}</h1>
            <p>@{profile.username} <span>·</span> {profile.role}</p>
          </div>
          {isOwnProfile ? (
            <Button
              leadingIcon={<MoreActions />}
              onClick={onEditProfile}
              size="small"
              variant="secondary"
            >
              Edit profile
            </Button>
          ) : (
            <Button
              leadingIcon={<MessageCircle />}
              onClick={onMessage}
              size="small"
              variant="secondary"
            >
              Message
            </Button>
          )}
        </div>
      </section>

      <div className="profile-layout">
        <section className="profile-about panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A LITTLE ABOUT ME</span>
              <h2>About</h2>
            </div>
          </div>
          <p>{profile.bio}</p>
          <div className="profile-about__facts">
            <div>
              <span>Role</span>
              <strong>{profile.role}</strong>
            </div>
            <div>
              <span>Genres</span>
              <strong>{profile.genre}</strong>
            </div>
          </div>
          {profile.links && profile.links.length > 0 && (
            <div className="profile-links" aria-label="Artist links">
              <h3>Links</h3>
              {profile.links.map((link) => (
                <a href={link.url} key={`${link.label}-${link.url}`} rel="noreferrer" target="_blank">{link.label}</a>
              ))}
            </div>
          )}
        </section>

        <section className="profile-uploads">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{isOwnProfile ? "YOUR MUSIC" : "THEIR MUSIC"}</span>
              <h2>{isOwnProfile ? "My Dubs" : "Uploaded dubs"} <span>{uploads.length}</span></h2>
            </div>
          </div>
          {uploads.length > 0 ? (
            <>
              <div className="profile-uploads__list feed-list">
                {uploadsPagination.items.map((dub) => (
                  <DubCard
                    dub={dub}
                    hasLiked={false}
                    isPlaying={isPlaying && playingDubId === dub.id}
                    isCurrentTrack={playingDubId === dub.id}
                    currentTimeSeconds={currentTimeSeconds}
                    durationSeconds={durationSeconds}
                    volume={volume}
                    shuffle={shuffle}
                    repeat={repeat}
                    playbackError={playingDubId === dub.id ? playbackError : undefined}
                    onSeek={onSeek}
                    onSeekProgress={onSeekProgress}
                    onVolumeChange={onVolumeChange}
                    onShuffleChange={onShuffleChange}
                    onRepeatChange={onRepeatChange}
                    onPrevious={onPrevious}
                    onNext={onNext}
                    onDownload={onDownload}
                    onOpenProfile={onOpenProfile}
                    onPlay={onPlay}
                    manageable={isOwnProfile}
                    onEdit={onEditDub}
                    onDelete={onDeleteDub}
                    key={dub.id}
                  />
                ))}
              </div>
              <Pagination
                itemCount={uploads.length}
                label="Uploaded dubs"
                onPageChange={uploadsPagination.setPage}
                onPageSizeChange={uploadsPagination.setPageSize}
                page={uploadsPagination.page}
                pageSize={uploadsPagination.pageSize}
                totalPages={uploadsPagination.totalPages}
              />
            </>
          ) : (
            <div className="empty-state">
              <AudioLines aria-hidden="true" />
              <strong>No dubs uploaded yet</strong>
              <span>When this member shares music, it will show up here.</span>
            </div>
          )}
        </section>

        <section className="profile-activity panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">RECENTLY AROUND</span>
              <h2>Activity</h2>
            </div>
          </div>
          <div className="activity-item">
            <span className="activity-item__icon"><Heart /></span>
            <p><strong>{profile.displayName}</strong> joined the circle.</p>
            <span>Today</span>
          </div>
          {uploads[0] && (
            <div className="activity-item">
              <span className="activity-item__icon"><AudioLines /></span>
              <p><strong>{profile.displayName}</strong> uploaded <strong>{uploads[0].title}</strong>.</p>
              <span>{formatRelativeTime(uploads[0].uploadedAt)}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
