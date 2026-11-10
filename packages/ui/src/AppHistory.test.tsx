import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAppHistory } from "../../../apps/web/src/hooks/useAppHistory";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

it("navigates between sections, profiles and conversations and truncates forward history", async () => {
  window.history.replaceState(null, "", "/#dubs");
  const onNavigate = vi.fn();
  const { result } = renderHook(() => useAppHistory(onNavigate));
  expect(result.current.canGoBack).toBe(false);
  expect(result.current.canGoForward).toBe(false);
  act(() => result.current.navigate("#profile?user=amber"));
  act(() => result.current.navigate("#messenger?buddy=friend"));
  expect(result.current.canGoBack).toBe(true);
  expect(result.current.canGoForward).toBe(false);
  act(() => result.current.goBack());
  await waitFor(() => expect(window.location.hash).toBe("#profile?user=amber"));
  expect(result.current.canGoForward).toBe(true);
  act(() => result.current.goForward());
  await waitFor(() => expect(window.location.hash).toBe("#messenger?buddy=friend"));
  act(() => result.current.goBack());
  await waitFor(() => expect(window.location.hash).toBe("#profile?user=amber"));
  act(() => result.current.navigate("#library"));
  expect(result.current.canGoForward).toBe(false);
  expect(onNavigate).toHaveBeenCalled();
});
