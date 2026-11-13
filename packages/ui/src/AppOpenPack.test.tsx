import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Dub, DubPack } from "./types/domain";
import type { WindowWorkspace } from "./organisms/Window/Window";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/app/App";
import { useAudioPlayback } from "../../../apps/web/src/hooks/useAudioPlayback";

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
  const bounds = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return this.classList.contains("workspace-stage") || this.classList.contains("workspace-root")
      ? new DOMRect(0, 0, window.innerWidth, window.innerHeight) : bounds.call(this);
  });
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
  vi.restoreAllMocks();
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
    refreshCommunity: vi.fn().mockResolvedValue(undefined),
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

it.each(["dub", "sample", "vocal"] as const)("opens a standalone %s card in a reusable workspace window without autoplay", async (kind) => {
  const data = community(null);
  const track = { ...dub, mediaKind: kind };
  const save = vi.fn().mockResolvedValue(undefined);
  mocks.community.mockReturnValue({ ...data, saveWindowWorkspace: save, state: {
    ...data.state, dubs: [track], packs: kind === "sample" ? [{ ...pack, kind, items: [{ dub: track }] }] : [],
  } });
  window.history.replaceState(null, "", kind === "vocal" ? "/#vocals" : kind === "sample" ? "/#samples" : "/#dubs");
  render(<App />);
  if (kind === "sample") fireEvent.click(screen.getByRole("tab", { name: "Samples", exact: true }));
  const open = screen.getByRole("button", { name: `Open ${kind}: ${dub.title}`, exact: true });
  fireEvent.click(open);
  const title = `${kind === "vocal" ? "Vocal" : kind === "sample" ? "Sample" : "Track"}: ${dub.title}`;
  const dialog = screen.getByRole("dialog", { name: title, exact: true });
  expect(dialog).toBeVisible();
  fireEvent.click(within(dialog).getByRole("button", { name: `Minimize ${title}`, exact: true }));
  fireEvent.click(open);
  expect(screen.getAllByRole("dialog", { name: title, exact: true })).toHaveLength(1);
  expect(screen.getByRole("dialog", { name: title, exact: true })).toBe(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: `Minimize ${title}`, exact: true }));
  const manager = screen.getByRole("navigation", { name: "Window manager", exact: true });
  fireEvent.click(within(manager).getByRole("button", { name: `Window options for ${title}`, exact: true }));
  fireEvent.click(screen.getByRole("button", { name: `Close ${title}`, exact: true }));
  expect(screen.queryByRole("dialog", { name: title, exact: true })).not.toBeInTheDocument();
  fireEvent.click(open);
  expect(screen.getByRole("dialog", { name: title, exact: true })).toBeVisible();
  expect(data.togglePlayback).not.toHaveBeenCalled();
  expect(data.playPack).not.toHaveBeenCalled();
  await waitFor(() => expect(save).toHaveBeenLastCalledWith("user", expect.objectContaining({
    windows: [expect.objectContaining({ id: `track:${dub.id}` })], activeWorkspaceId: "",
  })));
});

it.each(["profile", "conversation"])("links a %s-first profile, chat and shared pack without duplicating windows", (first) => {
  const data = community(null);
  const buddy = { id: "friend", username: "ben", displayName: "Ben", presence: "online" as const, genre: "Jungle", role: "DJ", bio: "", groups: [] };
  mocks.community.mockReturnValue({ ...data, chatConnectionStatus: "connected", state: { ...data.state, buddies: [buddy],
    conversations: [{ buddyId: "friend", messages: [{ id: "shared", sender: "them", text: "Shared", packId: pack.id, sentAt: "2026-11-11T12:00:00Z" }] }] } });
  window.history.replaceState(null, "", "/#messenger?buddy=friend");
  const app = render(<App />);
  if (first === "conversation") fireEvent.click(within(app.container).getByRole("button", { name: "Open conversation with Ben in a window" }));
  const source = first === "conversation" ? screen.getByRole("dialog", { name: "Chat: Ben" }) : app.container;
  fireEvent.click(within(source).getAllByRole("button", { name: "View Ben's profile" })[0]);
  const profile = screen.getByRole("dialog", { name: "Profile: Ben" });
  expect(window.location.hash).toBe("#messenger?buddy=friend");
  fireEvent.click(within(profile).getByRole("button", { name: "Message", exact: true }));
  const conversation = screen.getByRole("dialog", { name: "Chat: Ben" });
  expect(within(conversation).getByRole("tab", { name: "Profile: Ben" })).toBeVisible();
  fireEvent.click(within(conversation).getAllByRole("button", { name: "View Ben's profile" })[0]);
  expect(document.querySelectorAll(".profile-window")).toHaveLength(1);
  fireEvent.click(within(profile).getByRole("tab", { name: "Chat: Ben" }));
  fireEvent.click(within(conversation).getByRole("button", { name: "Open pack", exact: true }));
  const media = screen.getByRole("dialog", { name: "Dub Pack: Night Sessions" });
  expect(within(media).getAllByRole("tab")).toHaveLength(3);
  expect(within(media).getByRole("tab", { name: "Profile: Ben" })).toBeVisible();
  expect(document.querySelectorAll(".conversation-window")).toHaveLength(1);
});

it("keeps profiles for different users out of each other's automatic groups", () => {
  const data = community(null);
  const people = ["Ben", "Chris"].map((displayName) => ({ id: displayName, username: displayName.toLowerCase(), displayName,
    presence: "online" as const, genre: "Jungle", role: "DJ", bio: "", groups: [] }));
  mocks.community.mockReturnValue({ ...data, state: { ...data.state, buddies: people } });
  window.history.replaceState(null, "", "/#buddies");
  const app = render(<App />);
  for (const name of ["Ben", "Chris"]) fireEvent.click(within(app.container).getByRole("button", { name: `View ${name}'s profile` }));
  const profile = screen.getByRole("dialog", { name: "Profile: Chris" });
  expect(within(profile).queryByRole("tab", { name: "Profile: Ben" })).not.toBeInTheDocument();
  expect(document.querySelectorAll(".profile-window")).toHaveLength(2);
});

it("restores a saved profile in its named conversation group", () => {
  const data = community(null);
  const buddy = { id: "friend", username: "ben", displayName: "Ben", presence: "online" as const, genre: "Jungle", role: "DJ", bio: "", groups: [] };
  const frame = { placement: "floating" as const, position: "initial" as const, size: null };
  const workspace: WindowWorkspace = { version: 1, playerTrackId: null, dockWidths: {}, windows:
    ["conversation:friend", "profile:ben"].map((id, order) => ({
      id, title: null, group: "user:ben", groupTitle: "Ben's studio", order, dockOrder: order, minimized: true, frame, restoreFrame: null,
    })) };
  mocks.community.mockReturnValue({ ...data, state: { ...data.state, buddies: [buddy], windowWorkspace: workspace } });
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Load previous workspace: Draft Workspace" }));
  const profile = screen.getByRole("dialog", { name: "Profile: Ben" });
  expect(within(profile).getByRole("heading", { name: "Ben", exact: true })).toBeVisible();
  expect(within(profile).getByRole("tab", { name: "Chat: Ben" })).toBeVisible();
});

it("lets the global Upload action choose media and release format with guarded type changes", async () => {
  mocks.community.mockReturnValue(community(null));
  mocks.request.mockImplementation(async (_path: string, method: string, body?: { kind?: string }) => method === "POST"
    ? { pack: { ...pack, kind: body?.kind ?? "dub", status: "draft", items: [], title: "Untitled pack" } } : { packs: [] });
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Upload", exact: true }));
  const upload = screen.getByRole("dialog", { name: "Upload", exact: true });
  const media = within(upload).getByRole("combobox", { name: "Media type", exact: true });
  const format = within(upload).getByRole("combobox", { name: "Release format", exact: true });
  expect(format).toHaveValue("dub");
  fireEvent.change(media, { target: { value: "vocal" } });
  expect(within(upload).getByRole("button", { name: "Add Vocal", exact: true })).toBeVisible();
  fireEvent.change(within(upload).getByLabelText("Track title"), { target: { value: "Keep vocal details" } });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.change(format, { target: { value: "pack" } });
  expect(confirm).toHaveBeenCalledOnce();
  expect(format).toHaveValue("dub");
  expect(within(upload).getByLabelText("Track title")).toHaveValue("Keep vocal details");
  confirm.mockReturnValue(true);
  fireEvent.change(media, { target: { value: "sample" } });
  expect(await within(upload).findByLabelText("Pack type")).toHaveValue("sample");
  expect(format).toHaveValue("pack");
  expect(within(format).getByRole("option", { name: "Single file" })).toBeDisabled();
  expect(within(upload).getByText(/Samples are uploaded through a Sample Pack/)).toBeVisible();
  expect(mocks.request).toHaveBeenCalledWith("/api/packs", "POST", expect.objectContaining({ kind: "sample" }));
});

it.each(["dub", "sample", "vocal"] as const)("offers only Add media and Add Pack on the owned %s page", async (kind) => {
  const data = community(null);
  mocks.community.mockReturnValue(data);
  mocks.request.mockImplementation(async (_path: string, method: string) => method === "POST"
    ? { pack: { ...pack, kind, status: "draft", items: [], title: "Untitled pack" } } : { packs: [] });
  window.history.replaceState(null, "", kind === "sample" ? "/#my-samples" : kind === "vocal" ? "/#my-vocals" : "/#my-dubs");
  render(<App />);
  const noun = kind === "vocal" ? "Vocal" : kind === "sample" ? "Sample" : "Dub";
  const actions = screen.getByRole("group", { name: `Your ${noun}s actions` });
  expect(within(actions).getAllByRole("button").map((button) => button.textContent)).toEqual([`Add ${noun}`, "Add Pack"]);
  fireEvent.click(within(actions).getByRole("button", { name: `Add ${noun}`, exact: true }));
  if (kind !== "sample") {
    const upload = screen.getByRole("dialog", { name: `Add ${noun}`, exact: true });
    expect(within(upload).queryByRole("group", { name: "Upload type" })).not.toBeInTheDocument();
    expect(within(upload).queryByRole("combobox", { name: "Media type" })).not.toBeInTheDocument();
    fireEvent.click(within(upload).getByRole("button", { name: `Close Add ${noun}`, exact: true }));
    fireEvent.click(within(actions).getByRole("button", { name: "Add Pack", exact: true }));
  }
  const upload = screen.getByRole("dialog", { name: `${noun} Pack`, exact: true });
  expect(await within(upload).findByLabelText("Pack type")).toHaveValue(kind);
  expect(within(upload).queryByRole("group", { name: "Upload type" })).not.toBeInTheDocument();
  expect(mocks.request.mock.calls.filter(([, method]) => method === "POST")).toHaveLength(1);
  fireEvent.change(within(upload).getByLabelText("Pack title"), { target: { value: "Keep pack draft" } });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(within(upload).getByRole("button", { name: `Close ${noun} Pack` }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(upload).toBeVisible();
});

it("locks pack close until pack creation finishes without offering type-switch tabs", async () => {
  mocks.community.mockReturnValue(community(null));
  let finish: ((result: { pack: DubPack }) => void) | undefined;
  mocks.request.mockImplementation((_path: string, method: string) => method === "POST"
    ? new Promise<{ pack: DubPack }>((resolve) => { finish = resolve; }) : Promise.resolve({ packs: [] }));
  window.history.replaceState(null, "", "/#my-dubs");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Add Pack", exact: true }));
  const upload = screen.getByRole("dialog", { name: "Dub Pack", exact: true });
  expect(within(upload).queryByRole("group", { name: "Upload type" })).not.toBeInTheDocument();
  expect(within(upload).getByRole("button", { name: "Close Dub Pack" })).toBeDisabled();
  await act(async () => { finish?.({ pack: { ...pack, status: "draft" } }); });
  expect(await within(upload).findByLabelText("Pack title")).toHaveValue(pack.title);
  expect(within(upload).getByRole("button", { name: "Close Dub Pack" })).toBeEnabled();
});

it.each(["dub", "sample", "vocal"] as const)("groups a received %s pack with its conversation and reuses the group", (kind) => {
  const data = community(null);
  const sharedPack = { ...pack, kind };
  const buddy = { id: "friend", username: "ben", displayName: "Ben", presence: "online" as const, genre: "Jungle", role: "DJ", bio: "", groups: [] };
  mocks.community.mockReturnValue({ ...data, chatConnectionStatus: "connected", state: { ...data.state, packs: [sharedPack], buddies: [buddy],
    conversations: [{ buddyId: "friend", messages: [{ id: "shared", sender: "them", text: "Shared", packId: pack.id, sentAt: "2026-11-11T12:00:00Z" }] }] } });
  window.history.replaceState(null, "", "/#messenger?buddy=friend");
  const app = render(<App />);
  fireEvent.click(within(app.container).getByRole("button", { name: "Open pack", exact: true }));
  const packWindow = screen.getByRole("dialog", { name: `${kind === "vocal" ? "Vocal" : kind === "sample" ? "Sample" : "Dub"} Pack: Night Sessions` });
  expect(within(packWindow).getByRole("tab", { name: "Chat: Ben" })).toBeVisible();
  expect(within(packWindow).getAllByRole("tab")).toHaveLength(2);
  fireEvent.click(within(app.container).getByRole("button", { name: "Open pack", exact: true }));
  expect(document.querySelectorAll(".pack-window")).toHaveLength(1);
  expect(document.querySelectorAll(".conversation-window")).toHaveLength(1);
  expect(within(packWindow).getAllByRole("tab")).toHaveLength(2);
});

it("adds shared tracks to the existing conversation tab group", () => {
  const data = community(null);
  const buddy = { id: "friend", username: "ben", displayName: "Ben", presence: "online" as const, genre: "Jungle", role: "DJ", bio: "", groups: [] };
  mocks.community.mockReturnValue({ ...data, chatConnectionStatus: "connected", state: { ...data.state, buddies: [buddy],
    conversations: [{ buddyId: "friend", messages: [{ id: "shared", sender: "them", text: "Shared", dubId: dub.id, sentAt: "2026-11-11T12:00:00Z" }] }] } });
  window.history.replaceState(null, "", "/#messenger?buddy=friend");
  const app = render(<App />);
  fireEvent.click(within(app.container).getByRole("button", { name: "Open conversation with Ben in a window" }));
  fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "Open track", exact: true }));
  const track = screen.getByRole("dialog", { name: "Track: Night Drive" });
  expect(within(track).getByRole("tab", { name: "Chat: Ben" })).toBeVisible();
  expect(within(track).getByRole("region", { name: "Audio player: Night Drive" })).toBeVisible();
  expect(document.querySelectorAll(".conversation-window")).toHaveLength(1);
});



it("restores an account's open, renamed and minimized pack after remount", async () => {
  const data = community(null);
  const workspace: WindowWorkspace = { version: 1, playerTrackId: null, dockWidths: { ":right": 430 }, windows: [{
    id: `pack:${pack.id}`, title: "Saved studio", frame: { placement: "right", position: "initial", size: null },
    restoreFrame: null, minimized: true, group: null, order: 0, dockOrder: 1,
  }] };
  const save = vi.fn().mockResolvedValue(undefined);
  mocks.community.mockReturnValue({ ...data, saveWindowWorkspace: save, state: { ...data.state, windowWorkspace: workspace } });
  let app = render(<App />);
  expect(screen.queryByRole("dialog", { name: "Saved studio" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Load previous workspace: Draft Workspace" }));
  const dialog = screen.getByRole("dialog", { name: "Saved studio" });
  expect(dialog.style.width).toBe("430px");
  await waitFor(() => expect(save).toHaveBeenCalledWith("user", expect.objectContaining({
    windows: [expect.objectContaining({ title: "Saved studio", minimized: false })],
  })));
  const latest = save.mock.calls.at(-1)![1];
  app.unmount();
  mocks.community.mockReturnValue({ ...data, saveWindowWorkspace: save, state: { ...data.state, windowWorkspace: latest } });
  app = render(<App />);
  expect(screen.queryByRole("dialog", { name: "Saved studio" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Load previous workspace: Draft Workspace" }));
  expect(screen.getByRole("dialog", { name: "Saved studio" })).not.toHaveClass("floating-window--minimized");
  expect(screen.getByRole("dialog", { name: "Saved studio" })).toHaveClass("floating-window--right");
});

it("preserves a saved pack workspace and starts Draft when an upload is opened without a loaded workspace", async () => {
  const data = community(null);
  const save = vi.fn().mockResolvedValue(undefined);
  const frame = { placement: "floating" as const, position: "initial" as const, size: null };
  const saved = (id: string, order: number) => ({ id, order, dockOrder: order, title: null, frame, restoreFrame: null, minimized: false, group: null });
  const value: WindowWorkspace = { version: 1, playerTrackId: null, dockWidths: {}, windows: [saved("workspace:studio", 0)],
    workspaces: [{ id: "studio", title: "Studio", saved: true, dependencies: [], layout: {
      version: 1, playerTrackId: null, dockWidths: {}, windows: [saved(`pack:${pack.id}`, 1)],
    } }] };
  mocks.community.mockReturnValue({ ...data, saveWindowWorkspace: save, state: { ...data.state, windowWorkspace: value } });
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Load previous workspace: Studio" }));
  fireEvent.click(screen.getByRole("button", { name: "Workspaces", exact: true }));
  const explorer = await screen.findByRole("navigation", { name: "Workspace Explorer", exact: true });
  fireEvent.click(within(explorer).getByRole("button", { name: "Manage workspace: Studio" }));
  expect(screen.queryByRole("dialog", { name: `Dub Pack: ${pack.title}` })).not.toBeInTheDocument();
  fireEvent.click(within(explorer).getByText("Add content"));
  fireEvent.change(within(explorer).getByLabelText("Add dependency"), { target: { value: "action:upload" } });
  fireEvent.click(within(explorer).getByRole("button", { name: "Add dependency" }));
  expect(screen.getByRole("dialog", { name: "Add Dub" })).toBeVisible();
  expect(screen.queryByRole("dialog", { name: "Workspace: Studio" })).not.toBeInTheDocument();
  expect(data.togglePlayback).not.toHaveBeenCalled();
  await waitFor(() => expect(save).toHaveBeenLastCalledWith("user", expect.objectContaining({
    windows: [],
    activeWorkspaceId: "",
    workspaces: [expect.objectContaining({ id: "studio", layout: expect.objectContaining({ windows: [expect.objectContaining({ id: `pack:${pack.id}` })] }) })],
  })));
});

it("migrates a saved Player window to the docked global player without starting playback", () => {
  const data = community("one");
  const workspace: WindowWorkspace = { version: 1, playerTrackId: dub.id, dockWidths: {}, windows: [{
    id: "player", title: "Main deck", frame: { placement: "floating", position: { x: 120, y: 80 }, size: { width: 500, height: 400 } },
    restoreFrame: null, minimized: true, group: null, order: 0, dockOrder: 1,
  }] };
  mocks.community.mockReturnValue({ ...data, state: { ...data.state, windowWorkspace: workspace } });
  render(<App />);
  expect(screen.queryByRole("region", { name: "Minimized window: Main deck" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("contentinfo", { name: "Media and navigation" }))
    .getByRole("region", { name: "Audio player: Night Drive" })).toBeVisible();
  expect(data.togglePlayback).not.toHaveBeenCalled();
});

it("mirrors pack-window playback globally even after focus leaves the window system", async () => {
  vi.stubGlobal("innerWidth", 1440);
  class TestAudio extends EventTarget {
    static current: TestAudio;
    dataset: Record<string, string> = {};
    volume = 0.7; loop = false; paused = true; currentTime = 0; duration = 180; readyState = 1; src = "";
    constructor() { super(); TestAudio.current = this; }
    play() { this.paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
    pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
    removeAttribute() { this.src = ""; }
  }
  vi.stubGlobal("Audio", TestAudio);
  const tracks = pack.items.map(({ dub }) => dub);
  const data = community(null);
  mocks.community.mockImplementation(() => {
    const engine = useAudioPlayback(tracks, vi.fn(), "user", null);
    return { ...data, state: { ...data.state, dubs: tracks, ...engine.state }, mainPlayer: engine.mainPlayer,
      selectPlayerContext: engine.selectPlayerContext, activateWindowQueue: engine.activateWindowQueue,
      windowPlayback: { togglePlayback: engine.togglePlayback, seekPlayback: engine.seekPlayback, seekPlaybackProgress: engine.seekPlaybackProgress,
        playPack: engine.playQueue, playNextDub: engine.playNextDub, playPreviousDub: engine.playPreviousDub } };
  });
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Open pack", exact: true }));
  const window = screen.getByRole("dialog", { name: "Dub Pack: Night Sessions" });
  fireEvent.click(within(window).getAllByRole("button", { name: "Play", exact: true })[0]);
  const sidebar = screen.getByRole("complementary", { name: "Workspace and player" });
  expect(sidebar).toContainElement(screen.getByRole("region", { name: "Current pack playlist" }));
  const globalPlayer = screen.getByRole("contentinfo", { name: "Media and navigation" }).querySelector<HTMLElement>(".app-player")!;
  const transport = globalPlayer.querySelector<HTMLElement>(":scope > .transport-controls")!;
  expect(globalPlayer).toHaveAttribute("aria-label", "Audio player: Night Drive");
  expect(within(transport).getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  fireEvent.pointerDown(screen.getAllByRole("link", { name: "cre8 home" })[0]);
  await waitFor(() => expect(globalPlayer).toHaveAttribute("aria-label", "Audio player: Night Drive"));
  expect(TestAudio.current.paused).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Show windows", exact: true }));
  fireEvent.click(within(window).getByRole("button", { name: "Close Dub Pack: Night Sessions" }));
  expect(globalPlayer).toHaveAttribute("aria-label", "Audio player: Night Drive");
  expect(TestAudio.current.paused).toBe(false);
  fireEvent.click(within(transport).getByRole("button", { name: "Pause", exact: true }));
  expect(TestAudio.current.paused).toBe(true);
});

it("pauses audible playback explicitly when switching workspaces instead of toggling pack and Player controls", () => {
  const data = community(dub.id, pack.id); const pausePlayback = vi.fn();
  const frame = { placement: "floating" as const, position: "initial" as const, size: null };
  const value: WindowWorkspace = { version: 1, mode: "explorer", explorerIntroduced: true, playerTrackId: null, dockWidths: {},
    windows: [{ id: `pack:${pack.id}`, title: null, frame, restoreFrame: null, minimized: false, group: null, order: 0, dockOrder: 0 }],
    workspaces: [{ id: "studio", title: "Studio", saved: true, dependencies: [], layout: { version: 1, playerTrackId: null, dockWidths: {}, windows: [] } }] };
  mocks.community.mockReturnValue({ ...data, pausePlayback, state: { ...data.state, isPlaying: true, windowWorkspace: value } });
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Load previous workspace: Draft Workspace" }));
  expect(screen.getByRole("dialog", { name: `Dub Pack: ${pack.title}` })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Workspaces", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Open workspace: Studio" }));
  expect(pausePlayback).toHaveBeenCalledTimes(1);
  expect(data.togglePlayback).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog", { name: `Dub Pack: ${pack.title}` })).not.toBeInTheDocument();
});

it("keeps an available restored window active when the saved top window is unavailable", () => {
  vi.stubGlobal("innerWidth", 390);
  const data = community(null);
  const frame = { placement: "floating" as const, position: "initial" as const, size: null };
  const workspace: WindowWorkspace = { version: 1, playerTrackId: "deleted-track", dockWidths: {}, windows: [
    { id: `pack:${pack.id}`, title: null, frame, restoreFrame: null, minimized: false, group: null, order: 0, dockOrder: 1 },
    { id: "player", title: null, frame, restoreFrame: null, minimized: false, group: null, order: 1, dockOrder: 2 },
  ] };
  mocks.community.mockReturnValue({ ...data, state: { ...data.state, windowWorkspace: workspace } });
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Load previous workspace: Draft Workspace" }));
  expect(screen.getByRole("dialog", { name: "Dub Pack: Night Sessions" })).toHaveClass("floating-window--active");
  expect(screen.queryByRole("dialog", { name: "Player" })).not.toBeInTheDocument();
  expect(data.togglePlayback).not.toHaveBeenCalled();
});

it("opens a synchronized conversation window, keeps drafts on minimize and updates incoming messages", () => {
  const data = community(null);
  const buddy = { id: "friend", username: "ben", displayName: "Ben", presence: "online" as const, genre: "Jungle", role: "DJ", bio: "", groups: [] };
  const conversations = [{ buddyId: "friend", messages: [{ id: "hello", sender: "them" as const, text: "Hello", sentAt: "2026-11-11T12:00:00Z" }] }];
  mocks.community.mockReturnValue({ ...data, chatConnectionStatus: "connected", state: { ...data.state, buddies: [buddy], conversations } });
  window.history.replaceState(null, "", "/#messenger?buddy=friend");
  const app = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Open conversation with Ben in a window" }));
  const chat = screen.getByRole("dialog", { name: "Chat: Ben" });
  expect(within(chat).queryByRole("complementary", { name: "Conversations" })).not.toBeInTheDocument();
  fireEvent.change(within(chat).getByLabelText("Message Ben"), { target: { value: "Draft" } });
  fireEvent.click(within(chat).getByRole("button", { name: "Minimize Chat: Ben" }));
  fireEvent.click(screen.getByRole("button", { name: "Open conversation with Ben in a window" }));
  expect(screen.getAllByRole("dialog", { name: "Chat: Ben" })).toHaveLength(1);
  expect(within(chat).getByLabelText("Message Ben")).toHaveValue("Draft");
  const updated = [{ buddyId: "friend", messages: [...conversations[0].messages,
    { id: "incoming", sender: "them" as const, text: "New message", sentAt: "2026-11-11T12:01:00Z" }] }];
  mocks.community.mockReturnValue({ ...data, chatConnectionStatus: "connected", state: { ...data.state, buddies: [buddy], conversations: updated } });
  app.rerender(<App />);
  expect(within(chat).getByText("New message")).toBeVisible();
  expect(screen.getAllByText("New message").length).toBeGreaterThan(1);
  fireEvent.click(within(chat).getByRole("button", { name: "Close Chat: Ben" }));
  expect(screen.queryByRole("dialog", { name: "Chat: Ben" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Message Ben")).toBeVisible();
});

it.each(["dub", "sample", "vocal"] as const)("deletes an owned %s pack only after confirmation and closes its window", async (kind) => {
  const data = community(null);
  const owned = { ...pack, kind };
  data.state.packs = [owned];
  data.state.dubs = pack.items.map(({ dub: item }) => ({ ...item, mediaKind: kind }));
  mocks.community.mockReturnValue(data);
  mocks.request.mockResolvedValue(undefined);
  window.history.replaceState(null, "", kind === "vocal" ? "/#vocals" : kind === "sample" ? "/#samples" : "/#dubs");
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Open pack", exact: true }));
  expect(document.querySelectorAll(".pack-window")).toHaveLength(1);
  const card = within(screen.getByRole("region", { name: "Community uploads" }));
  fireEvent.click(card.getByRole("button", { name: "Delete pack", exact: true }));
  expect(mocks.request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete pack" }));
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/api/packs/pack", "DELETE"));
  await waitFor(() => expect(document.querySelectorAll(".pack-window")).toHaveLength(0));
  expect(data.refreshCommunity).toHaveBeenCalledOnce();
  expect(data.playPack).not.toHaveBeenCalled();
});

it.each(["dub", "sample", "vocal"] as const)("opens the existing %s pack editor from an owned release card", async (kind) => {
  const owned = { ...pack, kind, items: pack.items.map(({ dub: item }) => ({ dub: { ...item, mediaKind: kind } })) };
  const data = community(null);
  data.state.dubs = owned.items.map(({ dub: item }) => item);
  data.state.packs = [owned];
  mocks.community.mockReturnValue(data);
  mocks.request.mockImplementation(async (path: string) => path === "/api/packs/pack" ? { pack: owned } : { packs: [owned] });
  window.history.replaceState(null, "", kind === "vocal" ? "/#vocals" : kind === "sample" ? "/#samples" : "/#dubs");
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Edit pack" }));
  expect(await screen.findByLabelText("Pack title")).toHaveValue(pack.title);
  expect(screen.getByLabelText("Pack type")).toHaveValue(kind);
  expect(window.location.hash).toBe(kind === "vocal" ? "#vocals" : kind === "sample" ? "#samples" : "#dubs");
  const label = kind === "vocal" ? "Vocal" : kind === "sample" ? "Sample" : "Dub";
  expect(screen.getByRole("dialog", { name: `${label} Pack`, exact: true })).toContainElement(screen.getByLabelText("Pack title"));
  expect(data.playPack).not.toHaveBeenCalled();
  expect(mocks.request.mock.calls.some(([, method]) => method === "POST")).toBe(false);
});

it.each(["dub", "sample", "vocal"] as const)("keeps %s packs out of the individual-file tab and shows their download statistics in Packs", async (kind) => {
  const owned = { ...pack, kind, zipDownloads: 3, items: pack.items.map(({ dub: item }) => ({ dub: { ...item, mediaKind: kind, downloads: 5 } })) };
  const data = community(null);
  data.state.dubs = owned.items.map(({ dub: item }) => item);
  data.state.packs = [owned];
  mocks.community.mockReturnValue(data);
  mocks.request.mockResolvedValue({ packs: [owned] });
  window.history.replaceState(null, "", kind === "vocal" ? "/#my-vocals" : kind === "sample" ? "/#my-samples" : "/#my-dubs");
  render(<App />);
  expect(screen.queryByRole("button", { name: "Open pack" })).not.toBeInTheDocument();
  expect(screen.queryByText("Night Sessions")).not.toBeInTheDocument();
  expect(screen.getByText("Statistics for Night Drive")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Packs", exact: true }));
  const statistics = await screen.findByRole("region", { name: "Download statistics for Night Sessions" });
  expect(within(statistics).getByText("Whole-pack ZIP downloads")).toBeVisible();
  expect(within(statistics).getByText("3")).toBeVisible();
  expect(within(statistics).getByText("10")).toBeVisible();
  expect(within(statistics).getByRole("table", { name: kind === "vocal" ? "Individual vocal downloads" : kind === "sample" ? "Individual sample downloads" : "Individual track downloads" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Edit pack" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: kind === "vocal" ? "Vocals" : kind === "sample" ? "Samples" : "Dubs", exact: true }));
  expect(screen.queryByRole("button", { name: "Open pack" })).not.toBeInTheDocument();
});

it.each([390, 1440])("opens a pack playlist without starting playback at width %i", (width) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: width <= 760, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const data = community("one", "another-pack");
  mocks.community.mockReturnValue(data);
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
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
  fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
  const [openPack] = screen.getAllByRole("button", { name: "Open pack" });
  fireEvent.click(openPack);
  expect(data.playPack).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Dub Pack: Night Sessions" })).toBeVisible();
});

it.each(["dub", "sample", "vocal"] as const)("automatically groups %s pack windows and selects an existing pack without duplicating it", (kind) => {
  const data = community("one");
  const firstPack = { ...pack, kind };
  const second = { ...pack, kind, id: "second", title: "Closing Sessions" };
  data.state.packs = [firstPack, second];
  data.state.dubs = pack.items.map(({ dub: item }) => ({ ...item, mediaKind: kind }));
  window.history.replaceState(null, "", kind === "vocal" ? "/#vocals" : kind === "sample" ? "/#samples" : "/#dubs");
  const label = kind === "vocal" ? "Vocal Pack" : kind === "sample" ? "Sample Pack" : "Dub Pack";
  mocks.community.mockReturnValue(data);
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
  const [first, next] = screen.getAllByRole("button", { name: "Open pack" });
  fireEvent.click(first);
  fireEvent.click(next);
  expect(document.querySelectorAll(".pack-window")).toHaveLength(2);
  const secondWindow = screen.getByRole("dialog", { name: `${label}: Closing Sessions` });
  expect(secondWindow).toHaveClass("floating-window--active");
  fireEvent.click(screen.getByRole("tab", { name: `${label}: Night Sessions` }));
  const firstWindow = screen.getByRole("dialog", { name: `${label}: Night Sessions` });
  const initialOrder = firstWindow.compareDocumentPosition(secondWindow);
  fireEvent.pointerDown(within(firstWindow).getByRole("combobox", { name: `Position ${label}: Night Sessions` }));
  expect(firstWindow.compareDocumentPosition(secondWindow)).toBe(initialOrder);
  expect(firstWindow).toHaveClass("floating-window--active");
  fireEvent.change(within(firstWindow).getByRole("combobox", { name: `Position ${label}: Night Sessions` }), { target: { value: "left" } });
  fireEvent.click(first);
  expect(document.querySelectorAll(".pack-window")).toHaveLength(2);
  expect(firstWindow).toHaveClass("floating-window--active", "floating-window--left");
  fireEvent.click(within(firstWindow).getByRole("button", { name: `Minimize ${label}: Night Sessions` }));
  expect(firstWindow).toHaveClass("floating-window--minimized");
  fireEvent.click(first);
  expect(firstWindow).not.toHaveClass("floating-window--minimized");
  fireEvent.click(next);
  fireEvent.click(within(secondWindow).getByRole("button", { name: `Close ${label}: Closing Sessions` }));
  expect(document.querySelectorAll(".pack-window")).toHaveLength(1);
  expect(screen.getByRole("button", { name: `Focus ${label}: Night Sessions`, exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: `Focus ${label}: Night Sessions`, exact: true }));
  expect(firstWindow).toBeVisible();
  expect(data.playPack).not.toHaveBeenCalled();
});
