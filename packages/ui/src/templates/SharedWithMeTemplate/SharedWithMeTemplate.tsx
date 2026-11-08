import { LockKeyhole } from "@craft/icons";
import { useMemo, useState } from "react";
import { Badge } from "../../atoms/Badge/Badge";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { DubSearch, createEmptyDubSearchFilters } from "../../organisms/DubSearch/DubSearch";
import type { Dub } from "../communityTypes";
import { DubCardList, type DubCardListProps } from "../shared/DubCardList";
import "../CommunityPageTemplates.css";

export interface SharedWithMeTemplateProps extends Omit<DubCardListProps, "entries" | "label"> {
  dubs: Dub[];
}

export function SharedWithMeTemplate({ dubs, ...cardProps }: SharedWithMeTemplateProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(() => ({ ...createEmptyDubSearchFilters(), distributions: ["worldwide", "private", "alist"] as NonNullable<Dub["distribution"]>[] }));
  const defaults: NonNullable<Dub["distribution"]>[] = ["worldwide", "private", "alist"];
  const invalidRange = Boolean((filters.minBpm && filters.maxBpm && Number(filters.minBpm) > Number(filters.maxBpm)) || (filters.minBitrate && filters.maxBitrate && Number(filters.minBitrate) > Number(filters.maxBitrate)));
  const filteredDubs = useMemo(() => {
    if (invalidRange) return [];
    const needle = query.trim().toLocaleLowerCase();
    return dubs.filter((dub) => {
      const tags = dub.tags ?? [];
      const format = (dub.audioFormat ?? dub.audioFileName?.split(".").pop() ?? "").toLocaleUpperCase();
      const searchable = [dub.title, dub.artist, dub.uploader, dub.uploaderDisplayName, dub.genre, dub.message, format, ...tags].filter(Boolean).join(" ").toLocaleLowerCase();
      return filters.distributions.includes(dub.distribution ?? "worldwide")
        && (!needle || searchable.includes(needle))
        && (!filters.tags.length || filters.tags.some((tag) => tags.includes(tag)))
        && (!filters.fileType || format === filters.fileType)
        && (!filters.minBpm || dub.bpm >= Number(filters.minBpm))
        && (!filters.maxBpm || dub.bpm <= Number(filters.maxBpm))
        && (!filters.minBitrate || (dub.bitrateKbps !== undefined && dub.bitrateKbps >= Number(filters.minBitrate)))
        && (!filters.maxBitrate || (dub.bitrateKbps !== undefined && dub.bitrateKbps <= Number(filters.maxBitrate)));
    });
  }, [dubs, filters, invalidRange, query]);
  const pagination = usePagination(filteredDubs, `${query}|${JSON.stringify(filters)}`);
  return (
    <div className="library-template">
      <section className="page-intro">
        <div><span className="eyebrow">YOUR SHARED DUBS</span><h1>Shared With Me</h1>
          <p>Dubs shared with you in Messenger.</p></div>
        <Badge>{dubs.length} shared {dubs.length === 1 ? "dub" : "dubs"}</Badge>
      </section>
      <DubSearch query={query} onQueryChange={setQuery} filters={filters} onFiltersChange={setFilters}
        defaultDistributions={defaults} distributionHint="Filter the dubs shared with you by distribution."
        fileTypes={[...new Set(dubs.map((dub) => (dub.audioFormat ?? dub.audioFileName?.split(".").pop())?.toLocaleUpperCase()).filter((value): value is string => Boolean(value)))].sort()}
        resultCount={filteredDubs.length} error={invalidRange ? "Minimum values must be less than or equal to maximum values." : null} />
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
