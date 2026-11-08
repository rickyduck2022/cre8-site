import { LockKeyhole } from "@craft/icons";
import { useMemo, useState } from "react";
import { Badge } from "../../atoms/Badge/Badge";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { DubSearch, createEmptyDubSearchFilters, getDubSearchFilterCount } from "../../organisms/DubSearch/DubSearch";
import type { Dub } from "../communityTypes";
import { DubCardList, type DubCardListProps } from "../shared/DubCardList";
import { DubSearchToolbar } from "../shared/DubSearchToolbar";
import { allDistributions, dubFileType, hasInvalidDubSearchRange, matchesDubSearch } from "../shared/dubSearchFilters";
import "../CommunityPageTemplates.css";

export interface SharedWithMeTemplateProps extends Omit<DubCardListProps, "entries" | "label"> {
  dubs: Dub[];
}

export function SharedWithMeTemplate({ dubs, ...cardProps }: SharedWithMeTemplateProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(() => ({ ...createEmptyDubSearchFilters(), distributions: [...allDistributions] }));
  const invalidRange = hasInvalidDubSearchRange(filters);
  const filteredDubs = useMemo(() => {
    if (invalidRange) return [];
    return dubs.filter((dub) => matchesDubSearch(dub, query, filters));
  }, [dubs, filters, invalidRange, query]);
  const pagination = usePagination(filteredDubs, `${query}|${JSON.stringify(filters)}`);
  return (
    <div className="library-template">
      <section className="page-intro">
        <div><span className="eyebrow">YOUR SHARED DUBS</span><h1>Shared With Me</h1>
          <p>Dubs shared with you in Messenger.</p></div>
        <Badge>{dubs.length} shared {dubs.length === 1 ? "dub" : "dubs"}</Badge>
      </section>
      <DubSearchToolbar filterCount={getDubSearchFilterCount(filters, allDistributions)} query={query}>
        <DubSearch query={query} onQueryChange={setQuery} filters={filters} onFiltersChange={setFilters}
          defaultDistributions={allDistributions} distributionHint="Filter the dubs shared with you by distribution."
          fileTypes={[...new Set(dubs.map(dubFileType).filter(Boolean))].sort()}
          resultCount={filteredDubs.length} error={invalidRange ? "Minimum values must be less than or equal to maximum values." : null} />
      </DubSearchToolbar>
      {filteredDubs.length ? (
        <>
          <DubCardList {...cardProps} entries={pagination.items.map((dub) => ({ dub }))} label="Dubs shared with me" />
          <Pagination itemCount={filteredDubs.length} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="Shared dubs" />
        </>
      ) : (
        <div className="empty-state"><LockKeyhole aria-hidden="true" /><strong>{dubs.length ? "No shared dubs match your filters" : "No dubs shared with you"}</strong>
          <span>{dubs.length ? "Try another search or adjust the filters." : "Dubs you receive will appear here while you have access."}</span></div>
      )}
    </div>
  );
}
