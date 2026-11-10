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
import "../CommunityPageTemplates.css";

export interface LibraryTemplateProps extends Omit<DubCardListProps, "entries" | "label" | "onEdit" | "onDelete"> {
  downloads: LibraryDownload[];
  onEditDub?: DubCardListProps["onEdit"];
  onDeleteDub?: DubCardListProps["onDelete"];
}

export function LibraryTemplate({ downloads, onEditDub, onDeleteDub, ...cardProps }: LibraryTemplateProps) {
  const [query, setQuery] = useState("");
  const headerTarget = useContext(CollectionHeaderContext);
  const [filters, setFilters] = useState(() => ({ ...createEmptyDubSearchFilters(), distributions: [...allDistributions] }));
  const invalidRange = hasInvalidDubSearchRange(filters);
  const filteredDownloads = useMemo(
    () => invalidRange ? [] : downloads.filter(({ dub }) => matchesDubSearch(dub, query, filters)),
    [downloads, filters, invalidRange, query],
  );
  const collectionHeader = (
    <>
      <section className="page-intro">
        <div><span className="eyebrow">YOUR COLLECTION</span><h1>My Library</h1>
          <p>Your downloaded dubs, ready to listen to again.</p></div>
        <Badge>{downloads.length} downloads</Badge>
      </section>
      <DubSearchToolbar query={query}>
        {(onSearch) => <DubSearch query={query} onQueryChange={setQuery} filters={filters} onFiltersChange={setFilters} onSearch={onSearch}
          defaultDistributions={allDistributions} distributionHint="Filter your downloaded dubs by distribution."
          fileTypes={[...new Set(downloads.map(({ dub }) => dubFileType(dub)).filter(Boolean))].sort()}
          resultCount={filteredDownloads.length} error={invalidRange ? "Minimum values must be less than or equal to maximum values." : null} />}
      </DubSearchToolbar>
    </>
  );
  return (
    <div className="library-template">
      {headerTarget ? createPortal(<div className="library-template collection-header">{collectionHeader}</div>, headerTarget) : collectionHeader}
      {filteredDownloads.length ? (
        <DubCardList {...cardProps} entries={filteredDownloads} label="Downloaded dubs" onEdit={onEditDub} onDelete={onDeleteDub} />
      ) : (
        <div className="empty-state"><Disc3 aria-hidden="true" /><strong>{downloads.length ? "No downloaded dubs match your filters" : "Your library is empty"}</strong>
          <span>{downloads.length ? "Try another search or adjust the filters." : "Download a dub from the feed or a conversation and it will be saved here."}</span></div>
      )}
    </div>
  );
}
