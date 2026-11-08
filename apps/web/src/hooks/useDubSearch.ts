import { useEffect, useMemo, useState } from "react";
import { getDubSearchFilterCount } from "@craft/ui";
import type { Dub, DubSearchFilters } from "@craft/ui";

interface DubSearchResponse {
  dubs: Dub[];
  error?: string;
}

interface DubSearchState {
  results: Dub[] | null;
  isSearching: boolean;
  error: string | null;
}

export function useDubSearch(
  query: string,
  filters: DubSearchFilters,
  enabled = true,
  distribution: "worldwide" | "alist" | "feed" = "worldwide",
): DubSearchState {
  const [state, setState] = useState<DubSearchState>({
    results: null,
    isSearching: false,
    error: null,
  });
  const searchKey = useMemo(
    () =>
      JSON.stringify({
        query: query.trim(),
        ...filters,
        tags: [...filters.tags].sort(),
        distributions: [...filters.distributions].sort(),
      }),
    [query, filters],
  );

  useEffect(() => {
    if (!enabled) {
      setState({ results: null, isSearching: false, error: null });
      return;
    }

    const criteria = JSON.parse(searchKey) as DubSearchFilters & {
      query: string;
    };
    const hasCriteria = Boolean(
      criteria.query || getDubSearchFilterCount(criteria),
    );
    if (!hasCriteria) {
      setState({ results: null, isSearching: false, error: null });
      return;
    }

    const minBpm = Number(criteria.minBpm);
    const maxBpm = Number(criteria.maxBpm);
    const minBitrate = Number(criteria.minBitrate);
    const maxBitrate = Number(criteria.maxBitrate);
    const hasInvalidBpmRange =
      criteria.minBpm && criteria.maxBpm && minBpm > maxBpm;
    const hasInvalidBitrateRange =
      criteria.minBitrate && criteria.maxBitrate && minBitrate > maxBitrate;
    if (hasInvalidBpmRange || hasInvalidBitrateRange) {
      setState({
        results: [],
        isSearching: false,
        error: "Minimum values must be less than or equal to maximum values.",
      });
      return;
    }
    if (distribution === "feed" && criteria.distributions.length === 0) {
      setState({ results: [], isSearching: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ results: null, isSearching: true, error: null });
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams();
      params.set("distribution", distribution);
      if (distribution === "feed") criteria.distributions.forEach((value) => params.append("distributionType", value));
      if (criteria.query) params.set("q", criteria.query);
      criteria.tags.forEach((tag) => params.append("tag", tag));
      if (criteria.fileType) params.set("fileType", criteria.fileType);
      if (criteria.minBpm) params.set("minBpm", criteria.minBpm);
      if (criteria.maxBpm) params.set("maxBpm", criteria.maxBpm);
      if (criteria.minBitrate) params.set("minBitrate", criteria.minBitrate);
      if (criteria.maxBitrate) params.set("maxBitrate", criteria.maxBitrate);

      try {
        const response = await fetch(`/api/dubs/search?${params}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        const body = (await response.json()) as DubSearchResponse;
        if (!response.ok) {
          throw new Error(body.error ?? "Unable to search dubs.");
        }
        setState({ results: body.dubs, isSearching: false, error: null });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            results: [],
            isSearching: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to search dubs.",
          });
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, searchKey, distribution]);

  return state;
}
