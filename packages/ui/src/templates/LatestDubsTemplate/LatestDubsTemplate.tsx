import { useMemo, useState } from "react";
import { ChevronDown, Search } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { FilterTab } from "../../atoms/FilterTab/FilterTab";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import type { Dub } from "../communityTypes";
import { formatLocalTimestamp, formatRelativeTime } from "../templateFormatters";
import { TrackArtwork } from "../shared/TrackArtwork";
import { DubCard } from "../../organisms/DubCard/DubCard";
import { canShareDub } from "../../organisms/ShareDubDialog/ShareDubDialog";
import { DubSearch, createEmptyDubSearchFilters, type DubSearchFilters } from "../../organisms/DubSearch/DubSearch";
import "../CommunityPageTemplates.css";
import "./LatestDubsTemplate.css";

type FeedOrder = "newest" | "liked";

export interface LatestDubsTemplateProps {
  dubs: Dub[];
  crateId?: string;
  crateName?: string;
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
  query?: string;
  onQueryChange?: (query: string) => void;
  filters?: DubSearchFilters;
  onFiltersChange?: (filters: DubSearchFilters) => void;
  fileTypes?: string[];
  isSearching?: boolean;
  searchError?: string | null;
  onDownload: (dub: Dub) => void;
  onOpenProfile: (username: string) => void;
  onPlay: (dub: Dub) => void;
  brandingImageSrc?: string;
  brandingImageAlt?: string;
  feedName?: string;
  showIntro?: boolean;
  prioritizeAList?: boolean;
  queryAlreadyFiltered?: boolean;
  showDistributionFilter?: boolean;
  currentUsername?: string;
  onEditDub?: (dub: Dub) => void;
  onDeleteDub?: (dub: Dub) => void;
  onShareWithFriend?: (dub: Dub) => void;
  onAddToCrate?: (dubId: string) => void;
  onRemoveFromCrate?: (crateId: string, dubId: string) => void;
}

export function LatestDubsTemplate({
  dubs,
  crateId,
  crateName,
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
  query = "",
  onQueryChange,
  filters = createEmptyDubSearchFilters(),
  onFiltersChange,
  fileTypes,
  isSearching,
  searchError,
  onDownload,
  onOpenProfile,
  onPlay,
  brandingImageSrc,
  brandingImageAlt = "Cre8 DnB branding",
  feedName = "Dub Vault",
  showIntro = true,
  prioritizeAList = false,
  queryAlreadyFiltered = false,
  showDistributionFilter = true,
  currentUsername,
  onEditDub,
  onDeleteDub,
  onShareWithFriend,
  onAddToCrate,
  onRemoveFromCrate,
}: LatestDubsTemplateProps) {
  const [order, setOrder] = useState<FeedOrder>("newest");

  const visibleDubs = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...dubs]
      .filter(
        (dub) =>
          queryAlreadyFiltered || !needle ||
          [dub.title, dub.artist, dub.uploader, dub.genre, ...(dub.tags ?? [])].some((value) =>
            value.toLocaleLowerCase().includes(needle),
          ),
      )
      .sort((a, b) =>
        (prioritizeAList ? Number(b.distribution === "alist") - Number(a.distribution === "alist") : 0) ||
        (order === "newest"
          ? Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt)
          : b.likes - a.likes),
      );
  }, [dubs, order, query, prioritizeAList, queryAlreadyFiltered]);
  const pagination = usePagination(visibleDubs, `${query}|${order}|${crateId ?? ""}|${JSON.stringify(filters)}`);

  return (
    <div className="latest-dubs-template">
      {showIntro ? (
        <section className={brandingImageSrc ? "page-intro latest-dubs-template__intro" : "page-intro"}>
          {brandingImageSrc && (
            <img
              alt={brandingImageAlt}
              className="latest-dubs-template__branding"
              src={brandingImageSrc}
            />
          )}
          <div className={brandingImageSrc ? "latest-dubs-template__intro-copy" : undefined}>
            <span className="eyebrow">YOUR COMMUNITY, IN ROTATION</span>
            <h1>{crateName ?? feedName}</h1>
            <p>
              {crateName
                ? "Dubs saved in this crate."
                : "Discover the freshest dubs from artists across the Drum & Bass and Jungle scene."}
            </p>
          </div>
          <Badge dot variant="audio">
            {dubs.length} fresh dubs
          </Badge>
        </section>
      ) : (
        <h1 className="latest-dubs-template__title">{crateName ?? feedName}</h1>
      )}

      <div className="feed-toolbar">
        <div className="feed-toolbar__filters" role="tablist" aria-label="Sort dubs">
          <FilterTab active={order === "newest"} onClick={() => setOrder("newest")}>
            Newest
          </FilterTab>
          <FilterTab active={order === "liked"} onClick={() => setOrder("liked")}>
            Most liked
          </FilterTab>
        </div>
        <label className="sort-select">
          <span className="sr-only">Sort uploads</span>
          <select
            aria-label="Sort uploads"
            onChange={(event) => setOrder(event.target.value as FeedOrder)}
            value={order}
          >
            <option value="newest">Newest first</option>
            <option value="liked">Most liked</option>
          </select>
          <ChevronDown aria-hidden="true" />
        </label>
      </div>

      {prioritizeAList && dubs.some((dub) => dub.distribution === "alist") && (
        <p className="latest-dubs-template__priority">A-List dubs appear first. Sort order applies within each distribution.</p>
      )}
      <DubSearch query={query} onQueryChange={(value) => onQueryChange?.(value)} filters={filters} onFiltersChange={(value) => onFiltersChange?.(value)} fileTypes={fileTypes} resultCount={visibleDubs.length} isSearching={isSearching} error={searchError} showDistributionFilter={showDistributionFilter} />

      <section aria-label="Community uploads" className="feed-list">
        {pagination.items.map((dub) => (
          <DubCard
            dub={dub}
            crateId={crateId}
            onAddToCrate={onAddToCrate}
            onRemoveFromCrate={onRemoveFromCrate}
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
            key={dub.id}
            onDownload={onDownload}
            onOpenProfile={onOpenProfile}
            onPlay={onPlay}
            manageable={Boolean(currentUsername && dub.uploader === currentUsername)}
            onEdit={onEditDub}
            onDelete={onDeleteDub}
            onShareWithFriend={currentUsername && canShareDub(dub, currentUsername) ? onShareWithFriend : undefined}
          />
        ))}
        {visibleDubs.length === 0 && !isSearching && !searchError && (
          <div className="empty-state">
            <Search aria-hidden="true" />
            <strong>No dubs found</strong>
            <span>Try another search or adjust the filters.</span>
          </div>
        )}
      </section>
      <Pagination
        itemCount={visibleDubs.length}
        label="Dubs"
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />
    </div>
  );
}
