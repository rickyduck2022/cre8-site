import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createEmptyDubSearchFilters } from "./organisms/DubSearch/DubSearch";
import { useDubSearch } from "../../../apps/web/src/hooks/useDubSearch";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("scopes server search by media kind and cancels in-flight requests when switching vaults", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ dubs: [] }) });
  vi.stubGlobal("fetch", fetcher);
  const filters = createEmptyDubSearchFilters();
  const { rerender } = renderHook(({ kind }: { kind: "dub" | "sample" }) => useDubSearch("Break", filters, true, "feed", kind), {
    initialProps: { kind: "dub" },
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(fetcher.mock.calls[0][0]).toContain("mediaKind=dub");
  const signal = fetcher.mock.calls[0][1].signal;
  rerender({ kind: "sample" });
  expect(signal.aborted).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(fetcher.mock.calls[1][0]).toContain("mediaKind=sample");
  expect(fetcher.mock.calls[1][0]).toContain("distributionType=worldwide");
});
