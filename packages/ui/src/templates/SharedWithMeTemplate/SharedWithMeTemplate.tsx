import { LockKeyhole } from "@craft/icons";
import { useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "../../atoms/Badge/Badge";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { DubSearch, createEmptyDubSearchFilters } from "../../organisms/DubSearch/DubSearch";
import type { Dub } from "../communityTypes";
import type { DubPack, MediaKind } from "../../types/domain";
import { DubPackCard, type DubPackCardProps } from "../../organisms/DubPackCard/DubPackCard";
import { DubCardList, type DubCardListProps } from "../shared/DubCardList";
import { DubSearchToolbar } from "../shared/DubSearchToolbar";
import { CollectionHeaderContext } from "../shared/CollectionHeaderContext";
import { allDistributions, dubFileType, hasInvalidDubSearchRange, matchesDubSearch } from "../shared/dubSearchFilters";
import "../CommunityPageTemplates.css";

export interface SharedWithMeTemplateProps extends Omit<DubCardListProps, "entries" | "label"> {
  dubs: Dub[];
  mediaKind?: MediaKind;
  packs?: DubPack[];
  activePackId?: DubPackCardProps["activePackId"];
  onActivateQueue?: DubPackCardProps["onActivateQueue"];
  onPlayPack?: DubPackCardProps["onPlayAll"];
  onOpenPack?: DubPackCardProps["onOpenPack"];
  onDownloadPack?: DubPackCardProps["onDownloadPack"];
  onSharePack?: DubPackCardProps["onSharePack"];
}

export function SharedWithMeTemplate({
  dubs, mediaKind, packs = [], activePackId, onActivateQueue, onPlayPack, onOpenPack, onDownloadPack, onSharePack, ...cardProps
}: SharedWithMeTemplateProps) {
  const noun = mediaKind === "sample" ? "sample" : "dub";
  const nounTitle = mediaKind === "sample" ? "Samples" : "Dubs";
  const [query, setQuery] = useState("");
  const headerTarget = useContext(CollectionHeaderContext);
  const [filters, setFilters] = useState(() => ({ ...createEmptyDubSearchFilters(), distributions: [...allDistributions] }));
  const invalidRange = hasInvalidDubSearchRange(filters);
  const filteredDubs = useMemo(() => {
    if (invalidRange) return [];
    return dubs.filter((dub) => matchesDubSearch(dub, query, filters));
  }, [dubs, filters, invalidRange, query]);
  const entries = useMemo(() => {
    type Entry = { type: "pack"; pack: DubPack } | { type: "dub"; dub: Dub };
    const received = onPlayPack && onOpenPack ? packs.filter((pack) => pack.status === "published" && (!mediaKind || pack.kind === mediaKind)) : [];
    const packedIds = new Set(received.flatMap((pack) => pack.items.map(({ dub }) => dub.id)));
    const needle = query.trim().toLocaleLowerCase();
    const matchingPacks = invalidRange ? [] : received.filter((pack) => {
      const matchesTitle = [pack.title, pack.description, pack.ownerDisplayName, pack.ownerUsername]
        .some((value) => value.toLocaleLowerCase().includes(needle));
      return filters.distributions.includes(pack.distribution)
        && pack.items.some(({ dub }) => matchesDubSearch(dub, matchesTitle ? "" : query, filters));
    });
    const result: Entry[] = matchingPacks.map((pack) => ({ type: "pack", pack }));
    result.push(...filteredDubs.filter((dub) => !packedIds.has(dub.id)).map((dub): Entry => ({ type: "dub", dub })));
    return result;
  }, [packs, mediaKind, onPlayPack, onOpenPack, query, filters, invalidRange, filteredDubs]);
  const pagination = usePagination(entries, `${query}|${JSON.stringify(filters)}`);
  const hasSharedMedia = Boolean(dubs.length || packs.length);
  const collectionHeader = (
    <>
      <section className="page-intro">
        <div><span className="eyebrow">YOUR SHARED {nounTitle.toUpperCase()}</span><h1>{mediaKind ? `${nounTitle} shared with you` : "Shared With Me"}</h1>
          <p>{nounTitle} and packs shared with you in Messenger.</p></div>
        <Badge>{dubs.length} shared {noun}{dubs.length === 1 ? "" : "s"}</Badge>
      </section>
      <DubSearchToolbar query={query}>
        {(onSearch) => <DubSearch mediaKind={mediaKind} query={query} onQueryChange={setQuery} filters={filters} onFiltersChange={setFilters} onSearch={onSearch}
          defaultDistributions={allDistributions} distributionHint={`Filter the ${noun}s shared with you by distribution.`}
          fileTypes={[...new Set([...dubs, ...packs.flatMap((pack) => pack.items.map(({ dub }) => dub))].map(dubFileType).filter(Boolean))].sort()}
          resultCount={entries.length} error={invalidRange ? "Minimum values must be less than or equal to maximum values." : null} />}
      </DubSearchToolbar>
    </>
  );
  return (
    <div className="library-template">
      {headerTarget ? createPortal(<div className="library-template collection-header">{collectionHeader}</div>, headerTarget) : collectionHeader}
      {entries.length ? (
        <>
          <ul className="dub-card-list feed-list" aria-label={`${nounTitle} shared with me`}>
            {pagination.items.map((entry) => <li key={`${entry.type}-${entry.type === "pack" ? entry.pack.id : entry.dub.id}`}>
              {entry.type === "pack" && onPlayPack && onOpenPack ? <DubPackCard
                {...cardProps} pack={entry.pack} activePackId={activePackId} onActivateQueue={onActivateQueue}
                nowPlayingId={cardProps.nowPlayingId ?? null} isPlaying={cardProps.isPlaying ?? false}
                likedDubIds={cardProps.likedDubIds ?? new Set<string>()}
                onPlayAll={onPlayPack} onOpenPack={onOpenPack} onDownloadPack={onDownloadPack}
                onSharePack={entry.pack.distribution !== "private" || entry.pack.ownerUsername === cardProps.currentUsername ? onSharePack : undefined}
              /> : entry.type === "dub" ? <DubCardList {...cardProps} entries={[{ dub: entry.dub }]} label={entry.dub.title} /> : null}
            </li>)}
          </ul>
          <Pagination itemCount={entries.length} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label={`Shared ${noun}s`} />
        </>
      ) : (
        <div className="empty-state"><LockKeyhole aria-hidden="true" /><strong>{hasSharedMedia ? `No shared ${noun}s match your filters` : `No ${noun}s shared with you`}</strong>
          <span>{hasSharedMedia ? "Try another search or adjust the filters." : `${nounTitle} and packs you receive will appear here while you have access.`}</span></div>
      )}
    </div>
  );
}
