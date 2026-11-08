import { useEffect, useState } from "react";
import type { MemberSearchResult } from "@craft/ui";

export function useMemberSearch(query: string) {
  const [members, setMembers] = useState<MemberSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setMembers([]);
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsSearching(true);
      void fetch(`/api/members?q=${encodeURIComponent(normalized)}`, {
        credentials: "same-origin",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Artist search is unavailable.");
          const result = (await response.json()) as { members: MemberSearchResult[] };
          setMembers(result.members);
        })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) setMembers([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return { members, isSearching };
}
