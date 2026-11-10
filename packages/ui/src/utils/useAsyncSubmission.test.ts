import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAsyncSubmission } from "./useAsyncSubmission";

afterEach(cleanup);

describe("useAsyncSubmission", () => {
  it("locks immediately, blocks closing and duplicate actions, and unlocks after completion", async () => {
    let finish!: (value: boolean) => void;
    const action = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const close = vi.fn();
    const { result } = renderHook(() => useAsyncSubmission("Try again."));
    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.run(action);
      expect(await result.current.run(action)).toBe(false);
      result.current.requestClose(close);
    });
    expect(action).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(true);
    await act(async () => { finish(true); expect(await first).toBe(true); });
    expect(result.current.pending).toBe(false);
    result.current.requestClose(close);
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([false, null])("reports %s failures, clears errors on retry and accepts legacy void success", async (value) => {
    const { result } = renderHook(() => useAsyncSubmission("Try again."));
    await act(async () => { expect(await result.current.run(() => value)).toBe(false); });
    expect(result.current.error).toBe("Try again.");
    await act(async () => { expect(await result.current.run(() => undefined)).toBe(true); });
    expect(result.current.error).toBe("");
  });

  it("surfaces rejected actions and clears failure for a new dialog record", async () => {
    const { result, rerender } = renderHook(({ id }) => useAsyncSubmission("Try again.", id), { initialProps: { id: "one" } });
    await act(async () => {
      expect(await result.current.run(() => Promise.reject(new Error("Connection lost.")))).toBe(false);
    });
    expect(result.current.error).toBe("Connection lost.");
    expect(result.current.pending).toBe(false);
    rerender({ id: "two" });
    expect(result.current.error).toBe("");
  });
});
