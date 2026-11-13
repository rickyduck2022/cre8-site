import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import type { DubPack } from "./types/domain";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/app/App";

const mocks = vi.hoisted(() => ({ community: vi.fn() }));

vi.mock("../../../apps/web/src/hooks/useCommunity", () => ({ useCommunity: mocks.community }));
vi.mock("../../../apps/web/src/hooks/useDubSearch", () => ({ useDubSearch: () => ({ results: [] }) }));
vi.mock("../../../apps/web/src/hooks/useMemberSearch", () => ({ useMemberSearch: () => ({ members: [], isSearching: false }) }));
vi.mock("@craft/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@craft/ui")>();
  return {
    ...actual,
    DashboardTemplate: ({ footer, header, className }: { footer: React.ReactNode; header: React.ReactNode; className: string }) => <main className={className}><aside className="app-sidebar"><div className="navigation__footer">Profile</div></aside>{header}{footer}</main>,
  };
});

const dub = {
  id: "one", title: "Night Drive", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-01-01", bpm: 174,
  genre: "Jungle", duration: "03:00", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "", audioUrl: "/audio/one", distribution: "worldwide",
};

function community(dubs: typeof dub[], nowPlayingId: string | null) {
  return {
    loading: false,
    unreadCount: 0,
    notifications: [],
    activeNotifications: [],
    state: {
      member: { id: "user", username: "amber", displayName: "Amber", genre: "Jungle" },
      dubs, packs: [], nowPlayingId, isPlaying: false, currentTime: 42, duration: 180,
      sharedDubIds: new Set(), likedDubIds: new Set(), buddies: [], suggestedMembers: [],
      conversations: [],
    },
  };
}

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
  window.localStorage.setItem("cre8:player-layout", JSON.stringify({
    minimized: {}, placement: {}, position: "initial", opacity: 100,
  }));
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("app footer player", () => {
  it.each([900, 1440])("keeps desktop playback in the footer and docks only the pack tracklist at %ipx", (width) => {
    vi.stubGlobal("innerWidth", width);
    const data = community([dub], "one");
    const togglePlayback = vi.fn();
    const pack: DubPack = { id: "active", title: "Night Sessions", description: "", kind: "sample", status: "published",
      distribution: "worldwide", aListPublic: false, licence: "Original works", ownerUsername: "amber", ownerDisplayName: "Amber",
      items: [{ dub }], totalBytes: 0, createdAt: dub.uploadedAt, updatedAt: dub.uploadedAt };
    window.localStorage.setItem("cre8:player-layout", JSON.stringify({
      minimized: { other: false }, placement: { other: "window" }, position: "initial", opacity: 100,
    }));
    mocks.community.mockReturnValue({ ...data, togglePlayback });
    const app = render(<App />);
    const player = () => document.querySelector<HTMLElement>(".app-player")!;
    const originalPlayer = player();
    expect(screen.getByRole("contentinfo", { name: "Media and navigation" })).toContainElement(player());
    expect(screen.queryByRole("dialog", { name: "Player" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close audio player" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose player position" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move audio player/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse audio player" }));
    expect(player()).toHaveClass("app-player--collapsed");
    expect(screen.getByRole("button", { name: "Expand audio player" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Expand audio player" }));
    expect(player()).not.toHaveClass("app-player--collapsed");
    mocks.community.mockReturnValue({ ...data, togglePlayback, state: { ...data.state, packs: [pack], queuePackId: pack.id } });
    app.rerender(<App />);
    expect(player()).toBe(originalPlayer);
    const sidebar = screen.getByRole("complementary", { name: "Workspace and player" });
    const queue = screen.getByRole("region", { name: "Current pack playlist" });
    expect(sidebar).toContainElement(queue);
    expect(sidebar).not.toContainElement(player());
    expect(screen.getByRole("contentinfo", { name: "Media and navigation" })).toContainElement(player());
    expect(player()).not.toContainElement(queue);
    expect(sidebar.querySelector(".app-player-tracklist")).toHaveClass("audio-player--controller", "media-kind--sample");
    expect(player()).toHaveClass("media-kind--sample");
    fireEvent.click(screen.getByRole("button", { name: "Collapse audio player" }));
    expect(player()).toHaveClass("app-player--collapsed");
    expect(document.querySelector(".workspace-root")).not.toHaveClass("workspace-root--sidebar-collapsed");
    expect(queue).toBeVisible();
    expect(within(queue).getByRole("list")).toBeVisible();
    mocks.community.mockReturnValue({ ...data, togglePlayback });
    app.rerender(<App />);
    expect(screen.getByRole("contentinfo", { name: "Media and navigation" })).toContainElement(player());
    expect(player()).not.toHaveClass("app-player--collapsed");
    expect(togglePlayback).not.toHaveBeenCalled();
  });
  it.each([390, 1440])("does not offer a close action for the global player at %ipx", (width) => {
    vi.stubGlobal("innerWidth", width);
    mocks.community.mockReturnValue(community([dub], "one"));
    render(<App />);
    expect(screen.queryByRole("button", { name: "Close audio player" })).not.toBeInTheDocument();
  });
  it.each([390, 900, 1440])("starts at the footer without saved preferences at %ipx, including Messenger", (width) => {
    vi.stubGlobal("innerWidth", width);
    window.localStorage.clear();
    const togglePlayback = vi.fn();
    mocks.community.mockReturnValue({ ...community([dub], "one"), togglePlayback });
    const app = render(<App />);
    const expectFooter = () => {
      const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
      expect(screen.getByRole("contentinfo", { name: "Media and navigation" })).toContainElement(player);
      expect(player).not.toHaveClass("audio-player--minimized");
      expect(screen.getByRole("main")).not.toHaveClass(
        "community-dashboard-template--player-header",
        "community-dashboard-template--player-docked",
        "community-dashboard-template--player-right",
        "community-dashboard-template--player-fullscreen",
      );
      if (width <= 760) {
        fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
        expect(screen.getByRole("button", { name: "Footer", exact: true })).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
      } else {
        expect(screen.queryByRole("button", { name: "Choose player position" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Collapse audio player" })).toBeVisible();
      }
    };
    expectFooter();
    app.unmount();
    window.history.replaceState(null, "", "/#messenger");
    render(<App />);
    expectFooter();
    expect(togglePlayback).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem("cre8:player-layout")!)).toMatchObject({
      minimized: { messenger: false, other: false },
      placement: { messenger: "footer", other: "footer" },
    });
  });

  it("supports persistent full screen and minimized views without changing playback", () => {
    vi.stubGlobal("innerWidth", 390);
    const togglePlayback = vi.fn();
    mocks.community.mockReturnValue({ ...community([dub], "one"), togglePlayback });
    let app = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
    fireEvent.click(screen.getByRole("button", { name: "Full screen", exact: true }));
    let dialog = screen.getByRole("dialog", { name: "Now playing" });
    expect(within(dialog).getByRole("region", { name: "Audio player: Night Drive" })).not.toHaveClass("audio-player--minimized");
    expect(screen.getByRole("main")).toHaveClass("community-dashboard-template--player-fullscreen");
    expect(JSON.parse(window.localStorage.getItem("cre8:player-layout")!).placement.other).toBe("fullscreen");
    app.unmount();
    app = render(<App />);
    dialog = screen.getByRole("dialog", { name: "Now playing" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Choose player position" }));
    expect(within(dialog).getByRole("button", { name: "Full screen", exact: true })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Minimized", exact: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).toHaveClass("audio-player--minimized");
    expect(screen.getByRole("button", { name: "Choose player position" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Expand audio player" }));
    dialog = screen.getByRole("dialog", { name: "Now playing" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(togglePlayback).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Expand audio player" }));
    vi.stubGlobal("innerWidth", 1440);
    fireEvent(window, new Event("resize"));
    expect(screen.queryByRole("dialog", { name: "Now playing" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).not.toHaveClass("audio-player--minimized");
    vi.stubGlobal("innerWidth", 390);
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("dialog", { name: "Now playing" })).toBeVisible();
  });



  it.each([
    ["dub", 390], ["sample", 390], ["vocal", 390], ["dub", 1440], ["sample", 1440], ["vocal", 1440],
  ] as const)("shows the active %s pack queue at %ipx and scopes playlist row playback", async (kind, width) => {
    vi.stubGlobal("innerWidth", width);
    const pack: DubPack = { id: "active", title: "Night Sessions", description: "", kind, status: "published",
      distribution: "worldwide", aListPublic: false, licence: "Original works", ownerUsername: "amber", ownerDisplayName: "Amber",
      items: [{ dub }, { dub: { ...dub, id: "two", title: "Closing" } }], totalBytes: 0, createdAt: dub.uploadedAt, updatedAt: dub.uploadedAt };
    const activatePackQueue = vi.fn(() => true);
    const togglePlayback = vi.fn();
    const downloadDub = vi.fn(async () => undefined);
    const data = community([dub, pack.items[1].dub], "one");
    mocks.community.mockReturnValue({ ...data, state: { ...data.state, packs: [pack], queuePackId: pack.id },
      activatePackQueue, togglePlayback, downloadDub, playPack: vi.fn() });
    const app = render(<App />);
    const queue = screen.getByRole("region", { name: "Current pack playlist" });
    expect(queue.querySelector(".app-player__pack-title")).toHaveTextContent("Night Sessions");
    expect(queue.querySelector(".app-player__pack-position")).toHaveTextContent("1/2");
    expect(queue.closest(width > 760 ? ".app-player-tracklist" : ".app-player")).toHaveClass(`media-kind--${kind}`);
    expect(within(queue).getAllByRole("article").map((row) => row.getAttribute("aria-label"))).toEqual(["Night Drive", "Closing"]);
    fireEvent.click(within(within(queue).getByRole("article", { name: "Closing" })).getByRole("button", { name: "Play", exact: true }));
    expect(activatePackQueue).toHaveBeenCalledWith(pack.items.map(({ dub }) => dub), "active");
    expect(togglePlayback).toHaveBeenCalledWith(pack.items[1].dub);
    expect(screen.getByRole("button", { name: `Share ${kind === "vocal" ? "Vocal" : kind === "sample" ? "Sample" : "Dub"} Pack: Night Sessions` })).toBeVisible();
    fireEvent.click(within(queue).getByRole("button", { name: /Night Sessions/ }));
    expect(within(queue).queryByRole("list")).not.toBeInTheDocument();
    if (width > 760) {
      vi.stubGlobal("innerWidth", 390);
      fireEvent(window, new Event("resize"));
      const mobileQueue = screen.getByRole("region", { name: "Current pack playlist" });
      expect(mobileQueue.closest(".app-player")).toBeInTheDocument();
      expect(within(mobileQueue).queryByRole("list")).not.toBeInTheDocument();
      vi.stubGlobal("innerWidth", width);
      fireEvent(window, new Event("resize"));
      const desktopQueue = screen.getByRole("region", { name: "Current pack playlist" });
      expect(screen.getByRole("complementary", { name: "Workspace and player" })).toContainElement(desktopQueue);
      expect(within(desktopQueue).queryByRole("list")).not.toBeInTheDocument();
    }
    mocks.community.mockReturnValue({ ...data, togglePlayback, downloadDub });
    app.rerender(<App />);
    expect(screen.queryByRole("region", { name: "Current pack playlist" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download dub: Night Drive" }));
    await waitFor(() => expect(downloadDub).toHaveBeenCalledWith(dub));
  });
  it("uses the active pack audience for the global player without changing sample colors", () => {
    vi.stubGlobal("innerWidth", 1440);
    const pack: DubPack = { id: "active", title: "A-List Sessions", description: "", kind: "sample", status: "published",
      distribution: "alist", aListPublic: false, licence: "Original works", ownerUsername: "amber", ownerDisplayName: "Amber",
      items: [{ dub }], totalBytes: 0, createdAt: dub.uploadedAt, updatedAt: dub.uploadedAt };
    const data = community([dub], "one");
    mocks.community.mockReturnValue({ ...data, state: { ...data.state, packs: [pack], queuePackId: pack.id } });
    render(<App />);
    const player = document.querySelector(".app-player");
    const tracklist = screen.getByRole("region", { name: "Current pack playlist" }).closest(".app-player-tracklist");
    expect(player).toHaveClass("audio-player--alist", "media-kind--sample");
    expect(tracklist).toHaveClass("audio-player--alist", "media-kind--sample");
    expect(player).toHaveTextContent("Playback paused · A-List release");
  });
  it.each([375, 900, 1440])("wires mini-player previous, next and play controls at width %i", (width) => {
    vi.stubGlobal("innerWidth", width);
    const playPreviousDub = vi.fn();
    const playNextDub = vi.fn();
    const togglePlayback = vi.fn();
    mocks.community.mockReturnValue({
      ...community([dub], "one"), playPreviousDub, playNextDub, togglePlayback,
    });
    render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    fireEvent.click(within(player).getByRole("button", { name: "Previous track" }));
    fireEvent.click(within(player).getByRole("button", { name: "Next track" }));
    fireEvent.click(within(player).getByRole("button", { name: "Play", exact: true }));
    expect(playPreviousDub).toHaveBeenCalledOnce();
    expect(playNextDub).toHaveBeenCalledOnce();
    expect(togglePlayback).toHaveBeenCalledOnce();
    expect(togglePlayback).toHaveBeenCalledWith(dub);
  });



  it("preserves separate Messenger and other-page layouts across navigation and remounts", () => {
    vi.stubGlobal("innerWidth", 390);
    mocks.community.mockReturnValue(community([dub], "one"));
    let app = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
    fireEvent.click(screen.getByRole("button", { name: "Header" }));
    expect(screen.getByRole("main")).toHaveClass("community-dashboard-template--player-header");

    function navigate(hash: string) {
      act(() => {
        window.history.replaceState(null, "", `/#${hash}`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
    }

    navigate("messenger");
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).toHaveClass("audio-player--minimized");
    fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
    fireEvent.click(screen.getByRole("button", { name: "Footer" }));
    navigate("dubs");
    expect(screen.getByRole("main")).toHaveClass("community-dashboard-template--player-header");
    app.unmount();
    app = render(<App />);
    expect(screen.getByRole("main")).toHaveClass("community-dashboard-template--player-header");
    navigate("messenger");
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).not.toHaveClass("audio-player--minimized");
    expect(screen.getByRole("main")).not.toHaveClass("community-dashboard-template--player-header");
  });

  it("applies mobile opacity to the whole player and removes it on desktop", () => {
    vi.stubGlobal("innerWidth", 375);
    mocks.community.mockReturnValue(community([dub], "one"));
    render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).toHaveStyle({ opacity: "1" });
    fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
    fireEvent.change(screen.getByRole("slider", { name: "Opacity" }), { target: { value: "40" } });
    expect(player).toHaveStyle({ opacity: "0.4" });
    fireEvent.change(screen.getByRole("slider", { name: "Opacity" }), { target: { value: "70" } });
    expect(player).toHaveStyle({ opacity: "0.7" });
    expect(player).not.toContainElement(screen.getByRole("group", { name: "Player positions" }));
    fireEvent.click(screen.getByRole("button", { name: "Header" }));
    expect(player.style.opacity).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
    expect(screen.queryByRole("slider", { name: "Opacity" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Footer" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
    expect(screen.queryByRole("slider", { name: "Opacity" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Minimized" }));
    expect(player).toHaveStyle({ opacity: "0.7" });
    vi.stubGlobal("innerWidth", 1440);
    fireEvent(window, new Event("resize"));
    expect(player.style.opacity).toBe("");
    expect(screen.queryByRole("button", { name: "Choose player position" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Opacity" })).not.toBeInTheDocument();
    vi.stubGlobal("innerWidth", 375);
    fireEvent(window, new Event("resize"));
    expect(player).toHaveStyle({ opacity: "0.7" });
  });





  it("restores mobile opacity after remounting, but not while snapped", () => {
    vi.stubGlobal("innerWidth", 375);
    mocks.community.mockReturnValue(community([dub], "one"));
    let app = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
    fireEvent.change(screen.getByRole("slider", { name: "Opacity" }), { target: { value: "45" } });
    app.unmount();
    app = render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).toHaveStyle({ opacity: "0.45" });
    fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
    expect(screen.getByRole("slider", { name: "Opacity" })).toHaveValue("45");
    fireEvent.click(screen.getByRole("button", { name: "Header" }));
    app.unmount();
    app = render(<App />);
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" }).style.opacity).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
    expect(screen.queryByRole("slider", { name: "Opacity" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Minimized" }));
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).toHaveStyle({ opacity: "0.45" });
  });

  it.each([["Left edge", "left", "left-edge"], ["Right edge", "right", "right-edge"]] as const)(
    "persists the collapsed mobile %s dock and reopens it",
    (label, side, position) => {
      vi.stubGlobal("innerWidth", 375);
      const togglePlayback = vi.fn();
      const mockCommunity = { ...community([dub], "one"), togglePlayback };
      mocks.community.mockReturnValue(mockCommunity);
      let app = render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).toHaveClass("app-player--edge-collapsed");
      expect(JSON.parse(window.localStorage.getItem("cre8:player-layout")!).position).toBe(position);
      app.unmount();
      app = render(<App />);
      const handle = screen.getByRole("button", { name: `Open audio player docked at ${side} edge` });
      const play = screen.getByRole("button", { name: "Play audio player" });
      expect(play.parentElement).toBe(handle.parentElement);
      expect(play.parentElement?.firstElementChild).toBe(play);
      fireEvent.click(play);
      expect(togglePlayback).toHaveBeenCalledWith(dub);
      expect(handle).toBeInTheDocument();
      mocks.community.mockReturnValue({ ...mockCommunity, state: { ...mockCommunity.state, isPlaying: true } });
      app.rerender(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Pause audio player" }));
      expect(togglePlayback).toHaveBeenCalledTimes(2);
      fireEvent.click(handle);
      expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).not.toHaveClass("app-player--edge-collapsed");
      expect(screen.getByRole("button", { name: /Move audio player/ })).toHaveFocus();
      expect(JSON.parse(window.localStorage.getItem("cre8:player-layout")!).position).toBe("initial");
      app.unmount();
    },
  );

  it.each([["left", 5], ["right", 370]] as const)("snaps to the mobile %s edge by dragging", (side, x) => {
    vi.stubGlobal("PointerEvent", class extends MouseEvent {
      pointerId: number;
      isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.isPrimary = init.isPrimary ?? true;
      }
    });
    vi.stubGlobal("innerWidth", 375);
    vi.stubGlobal("innerHeight", 800);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("mobile-tabs")) return { left: 0, right: 375, top: 728, bottom: 800, width: 375, height: 72 } as DOMRect;
      if (this.classList.contains("app-header-region")) return { left: 0, right: 375, top: 0, bottom: 80, width: 375, height: 80 } as DOMRect;
      return { left: 160, top: 500, right: 352, bottom: 580, width: 192, height: 80 } as DOMRect;
    });
    mocks.community.mockReturnValue(community([dub], "one"));
    render(<App />);
    const handle = screen.getByRole("button", { name: /Move audio player/ });
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { pointerId: 1, isPrimary: true, button: 0, clientX: 180, clientY: 510 });
    if (side === "left") {
      for (const y of [10, 790]) {
        fireEvent.pointerMove(handle, { pointerId: 1, clientX: x, clientY: y });
        expect(document.querySelector('[aria-label="Release to dock at left edge"]')).toHaveClass("snap-preview--active");
        expect(screen.queryByText("Release to expand at header")).not.toBeInTheDocument();
        expect(screen.queryByText("Release to expand at footer")).not.toBeInTheDocument();
      }
    }
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: x, clientY: 400 });
    const preview = document.querySelector(`[aria-label="Release to dock at ${side} edge"]`)! as HTMLElement;
    expect(preview).toHaveClass("snap-preview--active");
    expect(preview).not.toHaveTextContent();
    expect(preview.querySelectorAll("svg")).toHaveLength(2);
    expect(preview.style.height).toBe("var(--app-player-edge-height)");
    expect(preview.style.top).toBe("50%");
    expect(preview.style.transform).toBe("translateY(-50%)");
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: x, clientY: 400 });
    expect(screen.getByRole("button", { name: `Open audio player docked at ${side} edge` })).toBeInTheDocument();
  });

  it("restores a floating position and clamps it to the viewport", () => {
    vi.stubGlobal("innerWidth", 750);
    vi.stubGlobal("innerHeight", 800);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("workspace-stage") || this.classList.contains("workspace-root")) return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      if (this.classList.contains("audio-player__minimize") || this.classList.contains("audio-player__drag")) {
        return { top: 468, height: 32 } as DOMRect;
      }
      return { left: 700, top: 500, width: 200, height: 100 } as DOMRect;
    });
    mocks.community.mockReturnValue(community([dub], "one"));
    const app = render(<App />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Move audio player/ }), { key: "ArrowLeft" });
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" }).style.getPropertyValue("--floating-player-left")).toBe("550px");
    app.unmount();
    vi.stubGlobal("innerWidth", 500);
    render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("300px");
    expect(player.style.getPropertyValue("--floating-player-top")).toBe("500px");
  });

  it("reserves right-bar space for desktop footer resizing and collapse, and clears it on mobile or removal", () => {
    vi.stubGlobal("innerWidth", 1440);
    const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];
    vi.stubGlobal("ResizeObserver", class {
      targets: Element[] = [];
      constructor(callback: ResizeObserverCallback) { observers.push({ callback, targets: this.targets }); }
      observe(target: Element) { this.targets.push(target); }
      disconnect() {}
    });
    let height = 180;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, 0, 1440, this.classList.contains("app-player") ? height : 900);
    });
    mocks.community.mockReturnValue(community([dub], "one"));
    const app = render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    const workspace = player.closest<HTMLElement>(".workspace-root")!;
    expect(workspace.style.getPropertyValue("--workspace-footer-height")).toBe("180px");
    height = 210;
    observers.filter(observer => observer.targets.includes(player)).forEach(observer => observer.callback([], {} as ResizeObserver));
    expect(workspace.style.getPropertyValue("--workspace-footer-height")).toBe("210px");
    height = 44;
    fireEvent.click(screen.getByRole("button", { name: "Collapse audio player" }));
    expect(workspace.style.getPropertyValue("--workspace-footer-height")).toBe("44px");
    vi.stubGlobal("innerWidth", 390);
    fireEvent(window, new Event("resize"));
    expect(workspace.style.getPropertyValue("--workspace-footer-height")).toBe("");
    vi.stubGlobal("innerWidth", 1440);
    fireEvent(window, new Event("resize"));
    expect(workspace.style.getPropertyValue("--workspace-footer-height")).toBe("44px");
    mocks.community.mockReturnValue(community([], null));
    app.rerender(<App />);
    expect(workspace.style.getPropertyValue("--workspace-footer-height")).toBe("");
  });

  it("measures minimized and expanded player heights and responds to changes", () => {
    vi.stubGlobal("innerWidth", 375);
    let update: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { update = callback; }
      observe() {}
      disconnect() { disconnect(); }
    });
    let height = 140;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return { height } as DOMRect;
    });
    window.history.replaceState(null, "", "/#messenger");
    mocks.community.mockReturnValue(community([dub], "one"));
    render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    const footer = screen.getByRole("contentinfo", { name: "Media and navigation" });
    expect(footer).toContainElement(player);
    expect(footer).toContainElement(screen.getByRole("navigation", { name: "Main sections" }));
    expect(player).toHaveClass("audio-player--playable", "audio-player--controller");
    expect(screen.getByRole("main")).toHaveClass("community-dashboard-template--player-docked");
    expect(screen.getByRole("main").style.getPropertyValue("--measured-minimized-player-height")).toBe("140px");
    height = 160;
    update?.([], {} as ResizeObserver);
    expect(screen.getByRole("main").style.getPropertyValue("--measured-minimized-player-height")).toBe("160px");
    fireEvent.click(screen.getByRole("button", { name: "Expand audio player" }));
    expect(player).toHaveClass("audio-player--playable", "audio-player--controller");
    expect(screen.getByRole("main").style.getPropertyValue("--measured-minimized-player-height")).toBe("");
    expect(screen.getByRole("main").style.getPropertyValue("--measured-app-player-height")).toBe("160px");
    height = 185;
    update?.([], {} as ResizeObserver);
    expect(screen.getByRole("main").style.getPropertyValue("--measured-app-player-height")).toBe("185px");
    fireEvent.click(screen.getByRole("button", { name: "Minimize audio player" }));
    expect(player).toHaveClass("audio-player--playable", "audio-player--controller");
    expect(disconnect).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("main").style.getPropertyValue("--measured-app-player-height")).toBe("");
  });

  it("hides the player with no dubs or when dubs have not been played", () => {
    mocks.community.mockReturnValue(community([], null));
    const { rerender } = render(<App />);
    expect(screen.queryByRole("region", { name: /Audio player/ })).not.toBeInTheDocument();
    expect(screen.getByRole("contentinfo", { name: "Media and navigation" }))
      .toContainElement(screen.getByRole("navigation", { name: "Main sections" }));
    expect(screen.getByRole("main")).not.toHaveClass("community-dashboard-template--has-player", "community-dashboard-template--player-minimized");
    mocks.community.mockReturnValue(community([dub], null));
    rerender(<App />);
    expect(screen.queryByRole("region", { name: /Audio player/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Night Drive")).not.toBeInTheDocument();
  });

  it("shows the selected or restored track and returns to empty when unavailable", () => {
    vi.stubGlobal("innerWidth", 390);
    mocks.community.mockReturnValue(community([dub], "one"));
    const { rerender } = render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).toHaveClass("app-player");
    expect(player).toHaveClass("audio-player--minimized");
    fireEvent.click(screen.getByRole("button", { name: "Expand audio player" }));
    expect(player).not.toHaveClass("audio-player--minimized");
    rerender(<App />);
    expect(player).not.toHaveClass("audio-player--minimized");
    expect(screen.getByRole("main")).toHaveClass("community-dashboard-template--has-player");
    expect(within(player).getByText("00:42")).toBeInTheDocument();
    mocks.community.mockReturnValue(community([], "one"));
    rerender(<App />);
    expect(screen.queryByRole("region", { name: /Audio player/ })).not.toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveClass("community-dashboard-template--has-player");
  });



  it("previews the mobile footer target and expands only when dropped there", () => {
    vi.stubGlobal("PointerEvent", class extends MouseEvent {
      pointerId: number;
      isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.isPrimary = init.isPrimary ?? true;
      }
    });
    vi.stubGlobal("innerWidth", 375);
    vi.stubGlobal("innerHeight", 800);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("mobile-tabs")) return { left: 0, right: 375, top: 728, bottom: 800, width: 375, height: 72 } as DOMRect;
      if (this.classList.contains("app-header-region")) return { width: 0, height: 0 } as DOMRect;
      if (this.classList.contains("audio-player__minimize")) return { top: 572, height: 32 } as DOMRect;
      return {
        left: Number.parseFloat(this.style.getPropertyValue("--floating-player-left") || "170"),
        top: Number.parseFloat(this.style.getPropertyValue("--floating-player-top") || "604"),
        width: 192, height: 80,
      } as DOMRect;
    });
    mocks.community.mockReturnValue(community([dub], "one"));
    render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    const handle = screen.getByRole("button", { name: /Move audio player/ });
    handle.setPointerCapture = vi.fn();

    fireEvent.pointerDown(handle, { pointerId: 1, isPrimary: true, button: 0, clientX: 180, clientY: 620 });
    expect(screen.getByText("Drop to expand at footer")).toBeInTheDocument();
    expect(screen.queryByText(/(?:Drop|Release) to dock player/)).not.toBeInTheDocument();
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 180, clientY: 750 });
    const preview = screen.getByText("Release to expand at footer");
    expect(preview).toHaveAttribute("aria-hidden", "true");
    expect(preview.style.top).toBe("728px");
    expect(preview).toHaveClass("snap-preview--active");
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150, clientY: 400 });
    expect(screen.queryByText("Release to expand at footer")).not.toBeInTheDocument();
    expect(screen.getByText("Drop to expand at footer")).toBeInTheDocument();
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 180, clientY: 750 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(screen.queryByText("Release to expand at footer")).not.toBeInTheDocument();
    expect(player).toHaveClass("audio-player--minimized");

    fireEvent.pointerDown(handle, { pointerId: 2, isPrimary: true, button: 0, clientX: 180, clientY: 650 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 180, clientY: 750 });
    fireEvent.pointerUp(handle, { pointerId: 2, clientX: 180, clientY: 750 });
    expect(player).not.toHaveClass("audio-player--minimized");
    expect(screen.queryByText("Release to expand at footer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Minimize audio player" }));
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("");
  });

  it.each([375])("previews and expands into the header at width %i", (width) => {
    vi.stubGlobal("PointerEvent", class extends MouseEvent {
      pointerId: number;
      isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.isPrimary = init.isPrimary ?? true;
      }
    });
    vi.stubGlobal("innerWidth", width);
    vi.stubGlobal("innerHeight", 800);
    const left = width > 760 ? 240 : 0;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("app-header-region")) return { left, right: width, top: 0, bottom: 100, width: width - left, height: 100 } as DOMRect;
      if (this.classList.contains("app-header-player-slot")) return { top: 100 } as DOMRect;
      if (this.classList.contains("mobile-tabs")) return { left: 0, right: width, top: 728, bottom: 800, width, height: 72 } as DOMRect;
      if (this.classList.contains("app-player-footer-target")) return { left, right: width, top: 724, bottom: 800, width: width - left, height: 76 } as DOMRect;
      if (this.classList.contains("app-sidebar")) return { left: 0, right: left, top: 0, bottom: 800, width: left, height: 800 } as DOMRect;
      if (this.classList.contains("audio-player__minimize")) return { height: 32 } as DOMRect;
      return { left: 100, top: 500, width: 192, height: 80 } as DOMRect;
    });
    mocks.community.mockReturnValue(community([dub], "one"));
    render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    const handle = screen.getByRole("button", { name: /Move audio player/ });
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { pointerId: 1, isPrimary: true, button: 0, clientX: 120, clientY: 520 });
    expect(screen.getByText("Drop to expand at header")).toBeInTheDocument();
    expect(screen.getByText("Drop to expand at footer")).toBeInTheDocument();
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: left + 40, clientY: 40 });
    expect(screen.getByText("Release to expand at header")).toHaveClass("snap-preview--active");
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: left + 40, clientY: 40 });
    expect(player).not.toHaveClass("audio-player--minimized");
    expect(screen.getByRole("main")).toHaveClass("community-dashboard-template--player-header");
    expect(screen.getByRole("main").style.getPropertyValue("--header-player-top")).toBe("100px");
    expect(screen.queryByText("Release to expand at header")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: width > 760 ? "Open player window" : "Minimize audio player" }));
    expect(screen.getByRole("main")).not.toHaveClass("community-dashboard-template--player-header");
    if (width > 760) {
      expect(JSON.parse(window.localStorage.getItem("cre8:player-layout")!)).toMatchObject({ placement: { other: "window" } });
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Expand audio player" }));
      expect(screen.getByRole("main")).toHaveClass("community-dashboard-template--player-header");
    }
  });

  it("moves the minimized player with mouse or touch, clamps its tab, and preserves its position", () => {
    vi.stubGlobal("PointerEvent", class extends MouseEvent {
      pointerId: number;
      isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.isPrimary = init.isPrimary ?? true;
      }
    });
    vi.stubGlobal("innerWidth", 750);
    vi.stubGlobal("innerHeight", 800);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("workspace-stage") || this.classList.contains("workspace-root")) return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      if (this.classList.contains("app-sidebar")) return { left: 0, right: 240, top: 0, bottom: 800, width: 240, height: 800 } as DOMRect;
      if (this.classList.contains("audio-player__minimize")) return { height: 32 } as DOMRect;
      if (this.classList.contains("app-header-region")) return { width: 0, height: 0 } as DOMRect;
      return {
        left: Number.parseFloat(this.style.getPropertyValue("--floating-player-left") || (window.innerWidth <= 760 ? "72" : "632")),
        top: Number.parseFloat(this.style.getPropertyValue("--floating-player-top") || (window.innerWidth <= 760 ? "420" : "688")),
        width: window.innerWidth <= 760 ? 240 : 352,
        height: 96,
      } as DOMRect;
    });
    window.history.replaceState(null, "", "/#messenger");
    const togglePlayback = vi.fn();
    const seekPlaybackProgress = vi.fn();
    mocks.community.mockReturnValue({ ...community([dub], "one"), togglePlayback, seekPlaybackProgress });
    render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    const handle = screen.getByRole("button", { name: /Move audio player/ });
    handle.setPointerCapture = vi.fn();
    const waveform = within(player).getByRole("slider", { name: "Night Drive playback progress" });
    fireEvent.keyDown(waveform, { key: "ArrowRight" });
    expect(seekPlaybackProgress).toHaveBeenCalledWith(expect.closeTo(42 / 180 + 0.01), dub);

    fireEvent.pointerDown(handle, { pointerId: 1, isPrimary: true, button: 0, clientX: 650, clientY: 730 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: -500, clientY: -500 });
    expect(screen.getByRole("main")).not.toHaveClass("community-dashboard-template--player-docked");
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("0px");
    expect(player.style.getPropertyValue("--floating-player-top")).toBe("32px");
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 2000, clientY: 2000 });
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("510px");
    expect(player.style.getPropertyValue("--floating-player-top")).toBe("704px");
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("510px");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(togglePlayback).toHaveBeenCalledWith(dub);
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("510px");

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("494px");
    vi.stubGlobal("innerWidth", 320);
    vi.stubGlobal("innerHeight", 600);
    fireEvent(window, new Event("resize"));
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("80px");
    expect(player.style.getPropertyValue("--floating-player-top")).toBe("504px");
    const mobileHandle = screen.getByRole("button", { name: /Move audio player/ });
    mobileHandle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(mobileHandle, { pointerId: 2, pointerType: "touch", isPrimary: true, button: 0, clientX: 90, clientY: 520 });
    fireEvent.pointerMove(mobileHandle, { pointerId: 2, pointerType: "touch", clientX: 40, clientY: 100 });
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("30px");
    expect(player.style.getPropertyValue("--floating-player-top")).toBe("84px");
    fireEvent.pointerUp(mobileHandle, { pointerId: 2, clientX: 40, clientY: 100 });
    fireEvent.pointerMove(mobileHandle, { pointerId: 2, clientX: 300, clientY: 300 });
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("30px");
    fireEvent.keyDown(mobileHandle, { key: "ArrowRight" });
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("46px");
    fireEvent.keyDown(waveform, { key: "ArrowRight" });
    expect(seekPlaybackProgress).toHaveBeenCalledTimes(2);
    fireEvent.pointerDown(mobileHandle, { pointerId: 3, isPrimary: true, button: 0, clientX: 50, clientY: 100 });
    fireEvent.pointerMove(mobileHandle, { pointerId: 3, clientX: 78, clientY: 428 });
    fireEvent.pointerUp(mobileHandle, { pointerId: 3, clientX: 78, clientY: 428 });
    expect(screen.getByRole("main")).not.toHaveClass("community-dashboard-template--player-docked");
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("74px");
    fireEvent.keyDown(mobileHandle, { key: "ArrowLeft" });
    expect(screen.getByRole("main")).not.toHaveClass("community-dashboard-template--player-docked");
    fireEvent.keyDown(mobileHandle, { key: "Home" });
    expect(screen.getByRole("main")).toHaveClass("community-dashboard-template--player-docked");
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("");
    fireEvent.keyDown(mobileHandle, { key: "ArrowLeft" });
    expect(screen.getByRole("main")).not.toHaveClass("community-dashboard-template--player-docked");
    vi.stubGlobal("innerWidth", 800);
    fireEvent(window, new Event("resize"));
    expect(player.style.getPropertyValue("--floating-player-left")).toBe("");
  });
});
