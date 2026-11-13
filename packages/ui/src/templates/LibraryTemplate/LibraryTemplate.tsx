import { Disc3 } from "@craft/icons";
import { useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "../../atoms/Badge/Badge";
import { DubSearch, createEmptyDubSearchFilters } from "../../organisms/DubSearch/DubSearch";
import { DubCardList, type DubCardListProps } from "../shared/DubCardList";
import { DubSearchToolbar } from "../shared/DubSearchToolbar";
import { CollectionHeaderContext } from "../shared/CollectionHeaderContext";
import { allDistributions, dubFileType, hasInvalidDubSearchRange, matchesDubSearch } from "../shared/dubSearchFilters";
import type { LibraryDownload } from "../communityTypes";
import type { Dub } from "../../types/domain";
import { matchesOwnedFile } from "../../utils/collectionFilters";
import "../CommunityPageTemplates.css";

export interface LibraryTemplateProps extends Omit<DubCardListProps, "entries" | "label" | "onEdit" | "onDelete"> {
  downloads: LibraryDownload[];
  tracks?: Dub[];
  onEditDub?: DubCardListProps["onEdit"];
  onDeleteDub?: DubCardListProps["onDelete"];
}

export function LibraryTemplate({ downloads, tracks, onEditDub, onDeleteDub, ...cardProps }: LibraryTemplateProps) {
  const fullLibrary = tracks !== undefined;
  const [query, setQuery] = useState("");
  const headerTarget = useContext(CollectionHeaderContext);
  const [filters, setFilters] = useState(() => ({ ...createEmptyDubSearchFilters(), distributions: [...allDistributions] }));
  const collection = useMemo(() => {
    const latest = new Map<string, LibraryDownload>();
    for (const download of downloads) {
      const previous = latest.get(download.dub.id);
      if (!previous || Date.parse(download.downloadedAt) > Date.parse(previous.downloadedAt)) {
        latest.set(download.dub.id, download);
      }
    }
    return [...latest.values()].sort((a, b) => Date.parse(b.downloadedAt) - Date.parse(a.downloadedAt));
  }, [downloads]);
  const invalidRange = hasInvalidDubSearchRange(filters);
  const count = fullLibrary ? new Set(tracks.map((dub) => dub.id)).size : collection.length;
  const filteredDownloads = useMemo(
    () => invalidRange ? [] : fullLibrary
      ? [...new Map(tracks.map((dub) => [dub.id, dub])).values()].filter((dub) => matchesOwnedFile(dub, query, filters)).map((dub) => ({ dub }))
      : collection.filter(({ dub }) => matchesDubSearch(dub, query, filters)),
    [collection, filters, invalidRange, query, tracks, fullLibrary],
  );
  const collectionHeader = (
    <>
      <section className="page-intro">
        <div><span className="eyebrow">YOUR COLLECTION</span><h1>{fullLibrary ? "Full Library" : "My Library"}</h1>
          <p>{fullLibrary ? "Every track you can access: Dubs, Samples and Vocals, including your uploads and music shared with you." : "Your downloaded dubs, samples and vocals, ready to listen to again."}</p></div>
        <Badge>{count} {count === 1 ? "file" : "files"}</Badge>
      </section>
      <DubSearchToolbar query={query}>
        {(onSearch) => <DubSearch mediaKind={fullLibrary ? "all" : undefined} showMediaKindFilter={fullLibrary} query={query} onQueryChange={setQuery} filters={filters} onFiltersChange={setFilters} onSearch={onSearch}
          defaultDistributions={allDistributions} distributionHint={fullLibrary ? "Only music your account can access is included. Filtering never grants access." : "Filter your downloaded files by distribution."}
          fileTypes={[...new Set((tracks ?? collection.map(({ dub }) => dub)).map(dubFileType).filter(Boolean))].sort()}
          resultCount={filteredDownloads.length} error={invalidRange ? "Minimum values must be less than or equal to maximum values." : null} />}
      </DubSearchToolbar>
    </>
  );
  return (
    <div className="library-template">
      {headerTarget ? createPortal(<div className="library-template collection-header">{collectionHeader}</div>, headerTarget) : collectionHeader}
      {filteredDownloads.length ? (
        <DubCardList {...cardProps} entries={filteredDownloads} label={fullLibrary ? "All accessible tracks" : "Downloaded files"} onEdit={onEditDub} onDelete={onDeleteDub} />
      ) : (
        <div className="empty-state"><Disc3 aria-hidden="true" /><strong>{fullLibrary ? tracks.length ? "No tracks match your filters" : "No tracks available yet" : downloads.length ? "No downloaded files match your filters" : "Your library is empty"}</strong>
          <span>{fullLibrary ? "Explore the vaults, upload music or receive a shared track. Clear search and filters to see every accessible track." : downloads.length ? "Try another search or adjust the filters." : "Download and like a dub, sample or vocal from the feed or a conversation to save it here. Repeat downloads keep one copy in your library."}</span></div>
      )}
    </div>
  );
}
