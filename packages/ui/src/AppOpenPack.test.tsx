import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Dub, DubPack } from "./types/domain";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/app/App";

const mocks = vi.hoisted(() => ({ community: vi.fn(), request: vi.fn() }));

vi.mock("../../../apps/web/src/hooks/useCommunity", () => ({ useCommunity: mocks.community }));
vi.mock("../../../apps/web/src/hooks/useDubSearch", () => ({ useDubSearch: () => ({ results: [] }) }));
vi.mock("../../../apps/web/src/hooks/useMemberSearch", () => ({ useMemberSearch: () => ({ members: [], isSearching: false }) }));
vi.mock("../../../apps/web/src/services/packs", async (original) => ({
  ...await original<typeof import("../../../apps/web/src/services/packs")>(),
  packRequest: mocks.request,
}));

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
  HTMLDialogElement.prototype.show = function () { this.open = true; };
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
      artists: [],
    },
  };
}

it.each(["dub", "sample"] as const)("opens the existing %s pack editor from an owned release card", async (kind) => {
  const owned = { ...pack, kind, items: pack.items.map(({ dub: item }) => ({ dub: { ...item, mediaKind: kind } })) };
  const data = community(null);
  data.state.dubs = owned.items.map(({ dub: item }) => item);
  data.state.packs = [owned];
  mocks.community.mockReturnValue(data);
  mocks.request.mockImplementation(async (path: string) => path === "/api/packs/pack" ? { pack: owned } : { packs: [owned] });
  window.history.replaceState(null, "", kind === "sample" ? "/#samples" : "/#dubs");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Edit pack" }));
  expect(await screen.findByLabelText("Pack title")).toHaveValue(pack.title);
  expect(screen.getByLabelText("Pack type")).toHaveValue(kind);
  expect(window.location.hash).toBe(kind === "sample" ? "#my-samples" : "#my-dubs");
  expect(data.playPack).not.toHaveBeenCalled();
  expect(mocks.request.mock.calls.some(([, method]) => method === "POST")).toBe(false);
});

it.each([390, 1440])("opens a pack playlist without starting playback at width %i", (width) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: width <= 760, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const data = community("one", "another-pack");
  mocks.community.mockReturnValue(data);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
  expect(data.playPack).not.toHaveBeenCalled();
  const dialog = screen.getByRole("dialog", { name: "Dub Pack: Night Sessions" });
  expect(within(dialog).getByRole("list", { name: "Pack tracks" })).toBeVisible();
  if (width <= 760) expect(dialog).toHaveAttribute("aria-modal", "true");
  else expect(dialog).not.toHaveAttribute("aria-modal");
  expect(screen.queryByRole("dialog", { name: "Now playing" })).not.toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem("cre8:player-layout")!).placement.other).not.toBe("fullscreen");
  fireEvent.click(within(dialog).getByRole("button", { name: "Play all" }));
  expect(data.playPack).toHaveBeenCalledWith(pack.items.map(({ dub: item }) => item), "pack");
  fireEvent.click(within(dialog).getByRole("button", { name: "Close Dub Pack: Night Sessions" }));
  expect(screen.queryByRole("dialog", { name: "Dub Pack: Night Sessions" })).not.toBeInTheDocument();
});

it("keeps the current track when the pack is already the active queue", () => {
  vi.stubGlobal("innerWidth", 1440);
  const data = community("one", "pack");
  mocks.community.mockReturnValue(data);
  render(<App />);
  const [openPack] = screen.getAllByRole("button", { name: "Open pack" });
  fireEvent.click(openPack);
  expect(data.playPack).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Dub Pack: Night Sessions" })).toBeVisible();
});

it("keeps multiple independent windows and raises an existing pack without duplicating it", () => {
  const data = community("one");
  const second = { ...pack, id: "second", title: "Closing Sessions" };
  data.state.packs = [pack, second];
  mocks.community.mockReturnValue(data);
  render(<App />);
  const [first, next] = screen.getAllByRole("button", { name: "Open pack" });
  fireEvent.click(first);
  fireEvent.click(next);
  expect(screen.getAllByRole("dialog")).toHaveLength(2);
  const firstWindow = screen.getByRole("dialog", { name: "Dub Pack: Night Sessions" });
  const secondWindow = screen.getByRole("dialog", { name: "Dub Pack: Closing Sessions" });
  expect(secondWindow).toHaveClass("floating-window--active");
  const initialOrder = firstWindow.compareDocumentPosition(secondWindow);
  fireEvent.pointerDown(within(firstWindow).getByRole("combobox"));
  expect(firstWindow.compareDocumentPosition(secondWindow)).toBe(initialOrder);
  expect(firstWindow).toHaveClass("floating-window--active");
  fireEvent.change(within(firstWindow).getByRole("combobox"), { target: { value: "left" } });
  fireEvent.click(first);
  expect(screen.getAllByRole("dialog")).toHaveLength(2);
  expect(firstWindow).toHaveClass("floating-window--active", "floating-window--left");
  fireEvent.click(within(firstWindow).getByRole("button", { name: "Minimize Dub Pack: Night Sessions" }));
  expect(firstWindow).toHaveClass("floating-window--minimized");
  fireEvent.click(first);
  expect(firstWindow).not.toHaveClass("floating-window--minimized");
  fireEvent.click(within(secondWindow).getByRole("button", { name: "Close Dub Pack: Closing Sessions" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(firstWindow).toBeVisible();
  expect(data.playPack).not.toHaveBeenCalled();
});
