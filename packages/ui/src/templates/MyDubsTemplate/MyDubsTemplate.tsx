import { useMemo, useRef, useState } from "react";
import { AudioLines, ChevronRight, Search } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { ShareDubIcon } from "../../molecules/ShareDubIcon/ShareDubIcon";
import { DubCard } from "../../organisms/DubCard/DubCard";
import { DubStatistics } from "../../organisms/DubStatistics/DubStatistics";
import type { Dub } from "../communityTypes";
import type { MediaKind } from "../../types/domain";
import { matchesOwnedFile, type DubSearchFilters } from "../../utils/collectionFilters";
import { getDubSearchFilterCount } from "../../organisms/DubSearch/DubSearch";
import "../CommunityPageTemplates.css";
import "./MyDubsTemplate.css";

export interface MyDubsTemplateProps {
  mediaKind?: MediaKind | "all";
  title?: string;
  collectionSearch?: { query: string; filters: DubSearchFilters; onClear: () => void };
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
  onShareDub?: () => void;
  onShareWithFriend?: (dub: Dub) => void;
  onEditDub: (dub: Dub) => void;
  onDeleteDub: (dub: Dub) => void;
  onRevokeGrant?: (dubId: string, userId: string) => void;
  onAddToPack?: (dub: Dub) => void;
  onOpenProfile?: (username: string) => void;
  onOpenDub?: (dub: Dub) => void;
}

export function MyDubsTemplate({
  mediaKind,
  title = mediaKind === "vocal" ? "Your Vocals" : mediaKind === "sample" ? "Your Samples" : "My Dubs",
  collectionSearch,
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
  onAddToPack,
  onOpenProfile,
  onOpenDub,
}: MyDubsTemplateProps) {
  const isSample = mediaKind === "sample";
  const isVocal = mediaKind === "vocal";
  const isAll = mediaKind === "all";
  const noun = isAll ? "file" : isVocal ? "vocal" : isSample ? "sample" : "dub";
  const uploadLabel = isVocal ? "Share a vocal" : isSample ? "Create Sample Pack" : "Share a dub";
  const [query, setQuery] = useState("");
  const statisticsRefs = useRef(new Map<string, HTMLDetailsElement>());
  const filteredDubs = useMemo(() => {
    if (collectionSearch) return dubs.filter((dub) => matchesOwnedFile(dub, collectionSearch.query, collectionSearch.filters));
    const needle = query.trim().toLocaleLowerCase();
    return dubs.filter((dub) =>
      !needle || [dub.title, dub.artist, dub.genre, ...(dub.tags ?? [])]
        .some((value) => value.toLocaleLowerCase().includes(needle)),
    );
  }, [dubs, query, collectionSearch]);
  const searchActive = collectionSearch ? Boolean(collectionSearch.query
    || getDubSearchFilterCount(collectionSearch.filters, ["worldwide", "private", "alist"])) : false;
  const pagination = usePagination(filteredDubs, collectionSearch ? `${collectionSearch.query}|${JSON.stringify(collectionSearch.filters)}` : query);
  const manageAccess = (dubId: string) => {
    const details = statisticsRefs.current.get(dubId);
    if (!details) return;
    details.open = true;
    details.querySelector<HTMLElement>(".dub-statistics__access")?.focus();
  };

  return (
    <div className="my-dubs-template">
      <section className="page-intro">
        <div>
          <span className="eyebrow">YOUR STUDIO</span>
          <h1>{title}</h1>
          <p>{isAll ? "All your uploaded files in one place. Switch to Packs for your releases and drafts." : isVocal ? "Manage your individual vocals. Find releases and usage terms in Packs." : isSample ? "Manage your individual samples. Find releases and usage terms in Packs." : "Manage your individual dubs. Find your releases in Packs."}</p>
        </div>
        <div className="my-dubs-template__intro-actions">
          <Badge dot variant="audio">{dubs.length} {noun}{dubs.length === 1 ? "" : "s"}</Badge>
          {onShareDub && <Button aria-label={uploadLabel} hideLabelOnMobile leadingIcon={<ShareDubIcon desktopIcon={<AudioLines />} />} onClick={onShareDub}>
            {uploadLabel}
          </Button>}
        </div>
      </section>

      {!collectionSearch && <SearchField
        aria-label={isAll ? "Search your uploads" : isVocal ? "Search your vocals" : isSample ? "Search your samples" : title === "My Dubs" ? "Search my dubs" : "Search your dubs"}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search your tracks, tags, or genres"
        value={query}
      />}

      <section aria-label={title} className="my-dubs-template__list feed-list" ref={pagination.listRef}>
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
              onOpenDub={onOpenDub}
              onEdit={onEditDub}
              onDelete={onDeleteDub}
              onShareWithFriend={onShareWithFriend}
              onAddToPack={onAddToPack}
              onManageAccess={dub.distribution === "private" ? () => manageAccess(dub.id) : undefined}
              manageable
            />
            <details
              className={`my-dubs-template__statistics my-dubs-template__statistics--${dub.distribution ?? "worldwide"}`}
              ref={(element) => {
                if (element) statisticsRefs.current.set(dub.id, element);
                else statisticsRefs.current.delete(dub.id);
              }}
            >
              <summary><span>Statistics for {dub.title}</span><ChevronRight aria-hidden="true" /></summary>
              <DubStatistics dub={dub} onRevokeGrant={onRevokeGrant} onOpenProfile={onOpenProfile} />
            </details>
          </div>
        ))}
        {filteredDubs.length === 0 && (
          <div className="empty-state">
            <Search aria-hidden="true" />
            <strong>{dubs.length || searchActive ? `No ${noun}s found` : `Your first ${noun} starts here`}</strong>
            <span>{dubs.length || searchActive ? collectionSearch ? "Try another search or clear your filters." : "Try another track, tag, or genre." : isAll ? "Use Upload to add a dub, sample or vocal, or create a pack." : isVocal ? "Upload a vocal or create a Vocal Pack with usage terms." : isSample ? "Create a Sample Pack to upload samples and define their usage terms." : "Share a dub to add it to your collection."}</span>
            {collectionSearch && searchActive && <Button variant="secondary" onClick={collectionSearch.onClear}>Show all files</Button>}
            {!dubs.length && onShareDub && <Button aria-label={uploadLabel} hideLabelOnMobile leadingIcon={<ShareDubIcon desktopIcon={<AudioLines />} />} onClick={onShareDub}>{uploadLabel}</Button>}
          </div>
        )}
      </section>
      <Pagination
        itemCount={filteredDubs.length}
        label={isAll ? "Your uploads" : isVocal ? "Your vocals" : isSample ? "Your samples" : "My dubs"}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />

    </div>
  );
}
