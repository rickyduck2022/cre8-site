import { useMemo, useState } from "react";
import { ChevronDown, Search } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { FilterTab } from "../../atoms/FilterTab/FilterTab";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { SearchField } from "../../molecules/SearchField/SearchField";
import type { Dub } from "../communityTypes";
import { formatLocalTimestamp, formatRelativeTime } from "../templateFormatters";
import { TrackArtwork } from "../shared/TrackArtwork";
import { DubCard } from "../../organisms/DubCard/DubCard";
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
  onSeek?: (timeSeconds: number) => void;
  onVolumeChange?: (volume: number) => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  onDownload: (dub: Dub) => void;
  onOpenProfile: (username: string) => void;
  onPlay: (dub: Dub) => void;
  brandingImageSrc?: string;
  brandingImageAlt?: string;
  currentUsername?: string;
  onEditDub?: (dub: Dub) => void;
  onDeleteDub?: (dub: Dub) => void;
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
  onVolumeChange,
  onShuffleChange,
  onRepeatChange,
  query = "",
  onQueryChange,
  onDownload,
  onOpenProfile,
  onPlay,
  brandingImageSrc,
  brandingImageAlt = "Cre8 DnB branding",
  currentUsername,
  onEditDub,
  onDeleteDub,
  onAddToCrate,
  onRemoveFromCrate,
}: LatestDubsTemplateProps) {
  const [order, setOrder] = useState<FeedOrder>("newest");

  const visibleDubs = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...dubs]
      .filter(
        (dub) =>
          !needle ||
          [dub.title, dub.artist, dub.uploader, dub.genre].some((value) =>
            value.toLocaleLowerCase().includes(needle),
          ),
      )
      .sort((a, b) =>
        order === "newest"
          ? Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt)
          : b.likes - a.likes,
      );
  }, [dubs, order, query]);
  const pagination = usePagination(visibleDubs, `${query}|${order}|${crateId ?? ""}`);

  return (
    <div className="latest-dubs-template">
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
          <h1>{crateName ?? "Dub Feed"}</h1>
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

      <SearchField
        aria-label="Search tracks, artists, or genres"
        onChange={(event) => onQueryChange?.(event.target.value)}
        placeholder="Search tracks, artists, or genres"
        value={query}
      />

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
          />
        ))}
        {visibleDubs.length === 0 && (
          <div className="empty-state">
            <Search aria-hidden="true" />
            <strong>No dubs found</strong>
            <span>Try another track, artist, or genre.</span>
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
