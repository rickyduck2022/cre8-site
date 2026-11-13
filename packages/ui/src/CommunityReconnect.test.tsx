import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCommunity } from "../../../apps/web/src/hooks/useCommunity";

vi.mock("../../../apps/web/src/hooks/useChatConnection", () => ({ useChatConnection: () => "disconnected" }));
vi.mock("../../../apps/web/src/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({ state: {}, reset: vi.fn() }),
}));

const snapshot = {
  member: { id: "one", username: "amber", displayName: "Amber" },
  lastPlayback: null, artists: [], dubs: [], sharedDubIds: [], buddies: [],
  conversations: [], likedDubIds: [], suggestedMembers: [], crates: [],
  library: [], aListApplication: null, notifications: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("community connection recovery", () => {
  it("explains an initial network failure and retries when connectivity returns", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ ok: true, status: 200, json: async () => snapshot });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useCommunity());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/messages and dubs require a connection/);
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(result.current.state.member?.username).toBe("amber"));
    expect(result.current.error).toBe("");
  });

  describe("tutorial action acknowledgements", () => {
    it("reports messages, media sharing and adding friends only after successful requests", async () => {
      let succeeds = false;
      vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => new Response(JSON.stringify(
        options?.method === "POST" && !succeeds ? { error: "Request failed." }
          : { ...snapshot, buddies: [{ id: "friend", username: "friend", displayName: "Friend" }] },
      ), { status: options?.method === "POST" && !succeeds ? 500 : 200 })));
      const report = vi.fn();
      const { result } = renderHook(() => useCommunity(report));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(report).not.toHaveBeenCalled();
      await act(async () => {
        expect(await result.current.sendMessage("friend", "Hello", "track")).toBe(false);
        expect(await result.current.addBuddy("friend")).toBeNull();
      });
      expect(report).not.toHaveBeenCalled();
      succeeds = true;
      await act(async () => { expect(await result.current.sendMessage("friend", "Hello")).toBe(true); });
      expect(report.mock.calls.map(([event]) => event.type)).toEqual(["message-sent"]);
      report.mockClear();
      await act(async () => { expect(await result.current.sendMessage("friend", "Listen", "track")).toBe(true); });
      expect(report.mock.calls.map(([event]) => event.type)).toEqual(["message-sent", "media-shared"]);
      report.mockClear();
      await act(async () => { expect(await result.current.addBuddy("friend")).toBe("friend"); });
      expect(report).toHaveBeenCalledWith({ type: "friend-added" });
    });
  });

  it("allows manual retry when the browser reports online but the server was unavailable", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ ok: true, status: 200, json: async () => snapshot });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useCommunity());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.retryConnection(); });
    expect(result.current.state.member?.username).toBe("amber");
    expect(result.current.error).toBe("");
  });
});
