import {
  AudioLines,
  Heart,
  MessageCircle,
  MoreActions,
  Pause,
  Play,
} from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Button } from "../../atoms/Button/Button";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import type { Dub, MemberProfile } from "../communityTypes";
import {
  formatLocalTimestamp,
  formatRelativeTime,
} from "../templateFormatters";
import { TrackArtwork } from "../shared/TrackArtwork";
import "../CommunityPageTemplates.css";
import "./ProfileTemplate.css";

export interface ProfileTemplateProps {
  profile: MemberProfile;
  uploads: Dub[];
  isOwnProfile: boolean;
  playingDubId: string | null;
  isPlaying: boolean;
  onEditProfile: () => void;
  onMessage: () => void;
  onPlay: (dub: Dub) => void;
}

export function ProfileTemplate({
  profile,
  uploads,
  isOwnProfile,
  playingDubId,
  isPlaying,
  onEditProfile,
  onMessage,
  onPlay,
}: ProfileTemplateProps) {
  const uploadsPagination = usePagination(uploads, profile.id);
  return (
    <div className="profile-template">
      <section className="profile-hero">
        <div className="profile-hero__art" aria-hidden="true">
          <span className="profile-hero__orb profile-hero__orb--one" />
          <span className="profile-hero__orb profile-hero__orb--two" />
        </div>
        <div className="profile-hero__content">
          <Avatar
            className="profile-hero__avatar"
            name={profile.displayName}
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
        </section>

        <section className="profile-uploads">
          <div className="section-heading">
            <div>
              <span className="eyebrow">IN THE CRATES</span>
              <h2>Uploaded dubs <span>{uploads.length}</span></h2>
            </div>
          </div>
          {uploads.length > 0 ? (
            <>
              <div className="profile-uploads__list">
                {uploadsPagination.items.map((dub) => (
                <button
                  aria-label={`${isPlaying && playingDubId === dub.id ? "Pause" : "Play"} ${dub.title}`}
                  className="profile-upload"
                  key={dub.id}
                  onClick={() => onPlay(dub)}
                  type="button"
                >
                  <TrackArtwork dub={dub} />
                  <span className="profile-upload__copy">
                    <strong>{dub.title}</strong>
                    <span>
                      {dub.genre}
                      {dub.bpm > 0 ? ` · ${dub.bpm} BPM` : ""} · {dub.duration}
                    </span>
                    <time dateTime={dub.uploadedAt}>
                      {formatLocalTimestamp(dub.uploadedAt)}
                    </time>
                  </span>
                  <span className="profile-upload__likes">
                    <Heart aria-hidden="true" /> {dub.likes}
                  </span>
                  <span className="profile-upload__play" aria-hidden="true">
                    {isPlaying && playingDubId === dub.id ? <Pause /> : <Play />}
                  </span>
                </button>
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
