import { useContext, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { FilterTab } from "../../atoms/FilterTab/FilterTab";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import type { Dub } from "../communityTypes";
import type { MediaKind } from "../../types/domain";
import { formatLocalTimestamp, formatRelativeTime } from "../templateFormatters";
import { TrackArtwork } from "../shared/TrackArtwork";
import { DubCard } from "../../organisms/DubCard/DubCard";
import { DubPackCard, type DubPack } from "../../organisms/DubPackCard/DubPackCard";
import { canShareDub } from "../../organisms/ShareDubDialog/ShareDubDialog";
import { DubSearch, createEmptyDubSearchFilters, type DubSearchFilters } from "../../organisms/DubSearch/DubSearch";
import { DubSearchToolbar } from "../shared/DubSearchToolbar";
import { CollectionHeaderContext } from "../shared/CollectionHeaderContext";
import "../CommunityPageTemplates.css";
import "./LatestDubsTemplate.css";

type FeedOrder = "newest" | "liked";

export interface LatestDubsTemplateProps {
  mediaKind?: MediaKind;
  activePackId?: string | null;
  dubs: Dub[];
  packs?: DubPack[];
  onPlayPack?: (dubs: Dub[], packId?: string) => void;
  onSharePack?: (pack: DubPack) => void;
  onOpenPack?: (pack: DubPack) => void;
  onDownloadPack?: (pack: DubPack) => Promise<void>;
  onActivateQueue?: (dubs: Dub[], packId?: string) => boolean | void;
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
  compactHeader?: boolean;
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
  mediaKind,
  activePackId,
  dubs,
  packs = [],
  onPlayPack,
  onOpenPack,
  onDownloadPack,
  onSharePack,
  onActivateQueue,
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
  compactHeader = false,
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
  const headerTarget = useContext(CollectionHeaderContext);
  const sortExplanationId = useId();
  const showPriority = prioritizeAList && dubs.some((dub) => dub.distribution === "alist");
  const noun = mediaKind === "sample" ? "samples" : "dubs";

  const visibleDubs = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matchingPackDubIds = new Set(!crateId && onPlayPack && onOpenPack && needle ? packs
      .filter((pack) => pack.status === "published" && `${pack.title} ${pack.description} ${pack.kind === "sample" ? "Sample Pack" : "Dub Pack"}`.toLocaleLowerCase().includes(needle))
      .flatMap((pack) => pack.items.map(({ dub }) => dub.id)) : []);
    return [...dubs]
      .filter(
        (dub) =>
          queryAlreadyFiltered || !needle || matchingPackDubIds.has(dub.id) ||
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
  }, [dubs, order, query, prioritizeAList, queryAlreadyFiltered, packs, crateId, onPlayPack, onOpenPack]);
  const visibleDubIds = useMemo(() => new Set(visibleDubs.map((dub) => dub.id)), [visibleDubs]);
  const entries = useMemo(() => {
    type Entry = { type: "dub"; dub: Dub } | { type: "pack"; pack: DubPack };
    const result: Entry[] = [];
    const added = new Set<string>();
    const packsByDub = new Map<string, DubPack[]>();
    if (!crateId && onPlayPack && onOpenPack) {
      for (const pack of packs.filter((pack) => pack.status === "published")) {
        for (const { dub } of pack.items) {
          packsByDub.set(dub.id, [...(packsByDub.get(dub.id) ?? []), pack]);
        }
      }
    }
    for (const dub of visibleDubs) {
      const containing = packsByDub.get(dub.id);
      if (!containing?.length) result.push({ type: "dub", dub });
      else for (const pack of containing) {
        if (!added.has(pack.id)) {
          result.push({ type: "pack", pack });
          added.add(pack.id);
        }
      }
    }
    return result;
  }, [visibleDubs, packs, crateId, onPlayPack, onOpenPack]);
  const pagination = usePagination(entries, `${query}|${order}|${crateId ?? ""}|${JSON.stringify(filters)}`);

  const collectionHeader = (
    <>
      {compactHeader ? (
        <h1 className="sr-only">{crateName ?? feedName}</h1>
      ) : showIntro ? (
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
                : `Discover the freshest ${noun} from artists across the Drum & Bass and Jungle scene.`}
            </p>
          </div>
          <Badge dot variant="audio">
            {dubs.length} fresh {noun}
          </Badge>
        </section>
      ) : (
        <h1 className="latest-dubs-template__title">{crateName ?? feedName}</h1>
      )}

      {!compactHeader && showPriority && (
        <p className="latest-dubs-template__priority">A-List {noun} appear first. Sort order applies within each distribution.</p>
      )}
      <DubSearchToolbar query={query}>
        {(onSearch) => (
          <>
            {compactHeader && showPriority && (
              <span className="sr-only" id={sortExplanationId}>A-List {noun} appear first. Sort order applies within each distribution.</span>
            )}
            <div className="feed-toolbar">
              <div className="feed-toolbar__filters" role="tablist" aria-label={`Sort ${noun}`} aria-describedby={compactHeader && showPriority ? sortExplanationId : undefined}>
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
            <DubSearch mediaKind={mediaKind} query={query} onQueryChange={(value) => onQueryChange?.(value)} filters={filters} onFiltersChange={(value) => onFiltersChange?.(value)} onSearch={onSearch} fileTypes={fileTypes} resultCount={visibleDubs.length} isSearching={isSearching} error={searchError} showDistributionFilter={showDistributionFilter} />
          </>
        )}
      </DubSearchToolbar>
    </>
  );

  return (
    <div className="latest-dubs-template">
      {headerTarget ? createPortal(<div className="latest-dubs-template collection-header">{collectionHeader}</div>, headerTarget) : collectionHeader}
      <section aria-label="Community uploads" className="feed-list">
        {isSearching && (
          <div className="latest-dubs-template__loading" role="status">
            <span className="button__spinner" aria-hidden="true" />
            Searching {noun}…
          </div>
        )}
        {!isSearching && pagination.items.map((entry) => entry.type === "pack" && onPlayPack && onOpenPack ? (
          <DubPackCard key={`pack-${entry.pack.id}`} pack={entry.pack} likedDubIds={likedDubIds}
            activePackId={activePackId} onActivateQueue={onActivateQueue} onPrevious={onPrevious} onNext={onNext}
            shuffle={shuffle} repeat={repeat} onShuffleChange={onShuffleChange} onRepeatChange={onRepeatChange}
            nowPlayingId={nowPlayingId} isPlaying={isPlaying} currentTimeSeconds={currentTimeSeconds}
            durationSeconds={durationSeconds} volume={volume} playbackError={playbackError}
            onPlay={onPlay} onPlayAll={onPlayPack} onOpenPack={onOpenPack} onDownloadPack={onDownloadPack}
            onSharePack={entry.pack.distribution !== "private" || entry.pack.ownerUsername === currentUsername ? onSharePack : undefined}
            onDownload={onDownload} onOpenProfile={onOpenProfile} onSeek={onSeek} onSeekProgress={onSeekProgress}
            onVolumeChange={onVolumeChange} matchingDubIds={visibleDubIds} />
        ) : entry.type === "dub" ? (
          <DubCard
            dub={entry.dub}
            crateId={crateId}
            onAddToCrate={onAddToCrate}
            onRemoveFromCrate={onRemoveFromCrate}
            hasLiked={likedDubIds.has(entry.dub.id)}
            isPlaying={isPlaying && nowPlayingId === entry.dub.id}
            isCurrentTrack={nowPlayingId === entry.dub.id}
            currentTimeSeconds={currentTimeSeconds}
            durationSeconds={durationSeconds}
            volume={volume}
            shuffle={shuffle}
            repeat={repeat}
            playbackError={nowPlayingId === entry.dub.id ? playbackError : undefined}
            onSeek={onSeek}
            onSeekProgress={onSeekProgress}
            onPrevious={onPrevious}
            onNext={onNext}
            onVolumeChange={onVolumeChange}
            onShuffleChange={onShuffleChange}
            onRepeatChange={onRepeatChange}
            key={entry.dub.id}
            onDownload={onDownload}
            onOpenProfile={onOpenProfile}
            onPlay={onPlay}
            manageable={Boolean(currentUsername && entry.dub.uploader === currentUsername)}
            onEdit={onEditDub}
            onDelete={onDeleteDub}
            onShareWithFriend={currentUsername && canShareDub(entry.dub, currentUsername) ? onShareWithFriend : undefined}
          />
        ) : null)}
        {visibleDubs.length === 0 && !isSearching && !searchError && (
          <div className="empty-state">
            <Search aria-hidden="true" />
            <strong>No {noun} found</strong>
            <span>Try another search or adjust the filters.</span>
          </div>
        )}
      </section>
      {!isSearching && <Pagination
        itemCount={entries.length}
        label={entries.some((entry) => entry.type === "pack") ? "Releases" : mediaKind === "sample" ? "Samples" : "Dubs"}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />}
    </div>
  );
}
