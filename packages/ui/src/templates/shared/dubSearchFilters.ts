import type { DubSearchFilters } from "../../organisms/DubSearch/DubSearch";
import type { Dub } from "../communityTypes";

export const allDistributions: NonNullable<Dub["distribution"]>[] = ["worldwide", "private", "alist"];

export function hasInvalidDubSearchRange(filters: DubSearchFilters) {
  return Boolean(
    (filters.minBpm && filters.maxBpm && Number(filters.minBpm) > Number(filters.maxBpm))
    || (filters.minBitrate && filters.maxBitrate && Number(filters.minBitrate) > Number(filters.maxBitrate)),
  );
}

export function dubFileType(dub: Dub) {
  return (dub.audioFormat ?? dub.audioFileName?.split(".").pop() ?? "").toLocaleUpperCase();
}

export function matchesDubSearch(dub: Dub, query: string, filters: DubSearchFilters) {
  const tags = dub.tags ?? [];
  const format = dubFileType(dub);
  const needle = query.trim().toLocaleLowerCase();
  const searchable = [dub.title, dub.artist, dub.uploader, dub.uploaderDisplayName, dub.genre, dub.message, format, ...tags].filter(Boolean).join(" ").toLocaleLowerCase();
  return filters.distributions.includes(dub.distribution ?? "worldwide")
    && (!needle || searchable.includes(needle))
    && (!filters.tags.length || filters.tags.some((tag) => tags.includes(tag)))
    && (!filters.fileType || format === filters.fileType)
    && (!filters.minBpm || dub.bpm >= Number(filters.minBpm))
    && (!filters.maxBpm || dub.bpm <= Number(filters.maxBpm))
    && (!filters.minBitrate || (dub.bitrateKbps !== undefined && dub.bitrateKbps >= Number(filters.minBitrate)))
    && (!filters.maxBitrate || (dub.bitrateKbps !== undefined && dub.bitrateKbps <= Number(filters.maxBitrate)));
}
