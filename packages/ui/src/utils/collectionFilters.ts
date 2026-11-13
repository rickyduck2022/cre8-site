import type { Dub, DubPack, MediaKind } from "../types/domain";

export interface DubSearchFilters {
  mediaKind?: MediaKind | "all";
  tags: string[];
  distributions: NonNullable<Dub["distribution"]>[];
  minBpm: string;
  maxBpm: string;
  fileType: string;
  minBitrate: string;
  maxBitrate: string;
}

export function trackFormat(dub: Dub): string {
  return (dub.audioFormat ?? dub.audioFileName?.split(".").pop() ?? "").toLocaleUpperCase();
}

export function matchesFileDetails(dub: Dub, filters: DubSearchFilters): boolean {
  if (filters.tags.length && !filters.tags.some((tag) => (dub.tags ?? []).includes(tag))) return false;
  if (filters.fileType && trackFormat(dub) !== filters.fileType.toLocaleUpperCase()) return false;
  for (const [value, min, max] of [
    [dub.bpm, filters.minBpm, filters.maxBpm],
    [dub.bitrateKbps, filters.minBitrate, filters.maxBitrate],
  ] as const) {
    if ((min || max) && (value === undefined || !Number.isFinite(value))) return false;
    if (value !== undefined && ((min && value < Number(min)) || (max && value > Number(max)))) return false;
  }
  return true;
}

export function matchesOwnedFile(dub: Dub, query: string, filters: DubSearchFilters): boolean {
  return (!filters.mediaKind || filters.mediaKind === "all" || (dub.mediaKind ?? "dub") === filters.mediaKind)
    && filters.distributions.includes(dub.distribution ?? "worldwide")
    && [dub.title, dub.artist, dub.uploader, dub.uploaderDisplayName, dub.genre, dub.message, trackFormat(dub), ...(dub.tags ?? [])]
      .filter(Boolean).join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    && matchesFileDetails(dub, filters);
}

export function matchesOwnedPack(pack: DubPack, query: string, filters: DubSearchFilters): boolean {
  const memberCriteria = Boolean(filters.tags.length || filters.fileType || filters.minBpm || filters.maxBpm || filters.minBitrate || filters.maxBitrate);
  return (!filters.mediaKind || filters.mediaKind === "all" || pack.kind === filters.mediaKind)
    && filters.distributions.includes(pack.distribution)
    && pack.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    && (!memberCriteria || pack.items.some(({ dub }) => matchesFileDetails(dub, filters)));
}
