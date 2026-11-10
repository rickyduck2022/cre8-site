import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Dub, DubPack } from "./types/domain";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/app/App";

const mocks = vi.hoisted(() => ({ community: vi.fn() }));

vi.mock("../../../apps/web/src/hooks/useCommunity", () => ({ useCommunity: mocks.community }));
vi.mock("../../../apps/web/src/hooks/useDubSearch", () => ({ useDubSearch: () => ({ results: [] }) }));
vi.mock("../../../apps/web/src/hooks/useMemberSearch", () => ({ useMemberSearch: () => ({ members: [], isSearching: false }) }));

const dub: Dub = {
  id: "one", title: "Night Drive", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-01-01", bpm: 174,
  genre: "Jungle", duration: "03:00", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "", audioUrl: "/audio/one", distribution: "worldwide",
};

const pack: DubPack = { id: "pack", title: "Night Sessions", description: "", kind: "dub", status: "published",
  distribution: "worldwide", aListPublic: false, licence: "Original works", ownerUsername: "amber", ownerDisplayName: "Amber",
  items: [{ dub }, { dub: { ...dub, id: "two", title: "Closing" } }], totalBytes: 0, createdAt: dub.uploadedAt, updatedAt: dub.uploadedAt };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => { data.clear(); },
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function community(nowPlayingId: string | null, queuePackId?: string) {
  return {
    loading: false,
    unreadCount: 0,
    notifications: [],
    activeNotifications: [],
    playPack: vi.fn(),
    togglePlayback: vi.fn(),
    activatePackQueue: vi.fn(() => true),
    downloadDub: vi.fn(),
    state: {
      member: { id: "user", username: "amber", displayName: "Amber", genre: "Jungle" },
      dubs: [dub], packs: [pack], nowPlayingId, queuePackId, isPlaying: false, currentTime: 42, duration: 180,
      sharedDubIds: new Set(), likedDubIds: new Set(), buddies: [], suggestedMembers: [], conversations: [],
    },
  };
}

it.each([390, 1440])("starts the pack queue and opens the full screen player from Open pack at width %i", (width) => {
  vi.stubGlobal("innerWidth", width);
  const data = community("one");
  mocks.community.mockReturnValue(data);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
  expect(data.playPack).toHaveBeenCalledWith(pack.items.map(({ dub: item }) => item), "pack");
  const dialog = screen.getByRole("dialog", { name: "Now playing" });
  expect(within(dialog).getByRole("region", { name: "Audio player: Night Drive" })).not.toHaveClass("audio-player--minimized");
  expect(JSON.parse(window.localStorage.getItem("cre8:player-layout")!).placement.other).toBe("fullscreen");
});

it("keeps the current track when the pack is already the active queue", () => {
  vi.stubGlobal("innerWidth", 1440);
  const data = community("one", "pack");
  mocks.community.mockReturnValue(data);
  render(<App />);
  const [openPack] = screen.getAllByRole("button", { name: "Open pack" });
  fireEvent.click(openPack);
  expect(data.playPack).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Now playing" })).toBeVisible();
});
