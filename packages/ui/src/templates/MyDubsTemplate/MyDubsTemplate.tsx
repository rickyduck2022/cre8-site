import { useMemo, useState } from "react";
import { AudioLines, ChevronRight, Search } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { ShareDubIcon } from "../../molecules/ShareDubIcon/ShareDubIcon";
import { DubCard } from "../../organisms/DubCard/DubCard";
import { DubStatistics } from "../../organisms/DubStatistics/DubStatistics";
import type { Dub } from "../communityTypes";
import "../CommunityPageTemplates.css";
import "./MyDubsTemplate.css";

export interface MyDubsTemplateProps {
  dubs: Dub[];
  likedDubIds: Set<string>;
  nowPlayingId: string | null;
  isPlaying: boolean;
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
  onPlay: (dub: Dub) => void;
  onShareDub: () => void;
  onShareWithFriend?: (dub: Dub) => void;
  onEditDub: (dub: Dub) => void;
  onDeleteDub: (dub: Dub) => void;
  onRevokeGrant?: (dubId: string, userId: string) => void;
  onOpenProfile?: (username: string) => void;
}

export function MyDubsTemplate({
  dubs,
  likedDubIds,
  nowPlayingId,
  isPlaying,
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
  onPlay,
  onShareDub,
  onShareWithFriend,
  onEditDub,
  onDeleteDub,
  onRevokeGrant,
  onOpenProfile,
}: MyDubsTemplateProps) {
  const [query, setQuery] = useState("");
  const filteredDubs = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return dubs.filter((dub) =>
      !needle || [dub.title, dub.artist, dub.genre, ...(dub.tags ?? [])]
        .some((value) => value.toLocaleLowerCase().includes(needle)),
    );
  }, [dubs, query]);
  const pagination = usePagination(filteredDubs, query);

  return (
    <div className="my-dubs-template">
      <section className="page-intro">
        <div>
          <span className="eyebrow">YOUR STUDIO</span>
          <h1>My Dubs</h1>
          <p>Manage your releases and keep your music moving.</p>
        </div>
        <div className="my-dubs-template__intro-actions">
          <Badge dot variant="audio">{dubs.length} {dubs.length === 1 ? "dub" : "dubs"}</Badge>
          <Button aria-label="Share a dub" hideLabelOnMobile leadingIcon={<ShareDubIcon desktopIcon={<AudioLines />} />} onClick={onShareDub}>
            Share a dub
          </Button>
        </div>
      </section>

      <SearchField
        aria-label="Search my dubs"
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search your tracks, tags, or genres"
        value={query}
      />

      <section aria-label="My Dubs" className="my-dubs-template__list feed-list">
        {pagination.items.map((dub) => (
          <div className="my-dubs-template__track" key={dub.id}>
            <DubCard
              dub={dub}
              hasLiked={likedDubIds.has(dub.id)}
              isPlaying={isPlaying && nowPlayingId === dub.id}
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
              onEdit={onEditDub}
              onDelete={onDeleteDub}
              onShareWithFriend={onShareWithFriend}
              manageable
            />
            <details className={`my-dubs-template__statistics my-dubs-template__statistics--${dub.distribution ?? "worldwide"}`}>
              <summary><span>Statistics for {dub.title}</span><ChevronRight aria-hidden="true" /></summary>
              <DubStatistics dub={dub} onRevokeGrant={onRevokeGrant} onOpenProfile={onOpenProfile} />
            </details>
          </div>
        ))}
        {filteredDubs.length === 0 && (
          <div className="empty-state">
            <Search aria-hidden="true" />
            <strong>{dubs.length ? "No dubs found" : "Your first dub starts here"}</strong>
            <span>{dubs.length ? "Try another track, tag, or genre." : "Share a dub to add it to your collection."}</span>
            {!dubs.length && <Button aria-label="Share a dub" hideLabelOnMobile leadingIcon={<ShareDubIcon desktopIcon={<AudioLines />} />} onClick={onShareDub}>Share a dub</Button>}
          </div>
        )}
      </section>
      <Pagination
        itemCount={filteredDubs.length}
        label="My dubs"
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />

    </div>
  );
}
