import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { LatestDubsTemplate } from "./LatestDubsTemplate";
import type { Dub } from "../communityTypes";
import type { DubPack } from "../../organisms/DubPackCard/DubPackCard";
import { CollectionHeaderContext } from "../shared/CollectionHeaderContext";
import { createEmptyDubSearchFilters } from "../../organisms/DubSearch/DubSearch";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const dub: Dub = {
  id: "owned", title: "My Dub", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z", bpm: 174,
  genre: "Jungle", duration: "03:30", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "Fresh dub",
};

describe("LatestDubsTemplate ownership controls", () => {
  const second = { ...dub, id: "two", title: "Closing Dub" };
  const pack: DubPack = {
    id: "pack", title: "Night Sessions", description: "", kind: "dub", status: "published",
    distribution: "worldwide", aListPublic: false, licence: "", ownerUsername: "amber", ownerDisplayName: "Amber",
    items: [{ dub }, { dub: second }], createdAt: dub.uploadedAt, updatedAt: dub.uploadedAt, totalBytes: 1200,
  };
  const packProps = {
    likedDubIds: new Set<string>(), nowPlayingId: null, isPlaying: false,
    onDownload: vi.fn(), onOpenProfile: vi.fn(), onPlay: vi.fn(), onPlayPack: vi.fn(), onOpenPack: vi.fn(),
  };
  it("distinguishes standalone file playback from pack playback callbacks", () => {
    const onPlaySingle = vi.fn();
    const onPlay = vi.fn();
    const playable = { ...dub, audioUrl: "/audio/check" };
    render(<LatestDubsTemplate {...packProps} onPlay={onPlay} onPlaySingle={onPlaySingle} mediaKind="dub"
      dubs={[playable]} packs={[{ ...pack, items: [{ dub: playable }] }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Play", exact: true }));
    expect(onPlaySingle).toHaveBeenCalledWith(playable);
    expect(onPlay).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Show 1 track", exact: true }));
    fireEvent.click(screen.getAllByRole("button", { name: "Play", exact: true }).at(-1)!);
    expect(onPlay).toHaveBeenCalledWith(playable);
    expect(onPlaySingle).toHaveBeenCalledTimes(1);
  });
  it.each(["dub", "sample"] as const)("keeps %s mobile search compact, accessible and stateful", (kind) => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    function Vault() {
      const [query, setQuery] = useState("");
      const [filters, setFilters] = useState(createEmptyDubSearchFilters);
      return <LatestDubsTemplate {...packProps} compactHeader mediaKind={kind} dubs={[dub, second]} packs={[{ ...pack, kind }]}
        query={query} onQueryChange={setQuery} filters={filters} onFiltersChange={setFilters} searchError="Search unavailable" />;
    }
    render(<Vault />);
    const toggle = screen.getByRole("button", { name: "Search and filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Search unavailable");
    fireEvent.click(screen.getByRole("tab", { name: "Packs" }));
    expect(screen.getByRole("tab", { name: "Packs" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(toggle);
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "Night" } });
    expect(toggle).toHaveAccessibleName("Search and filters, 1 active");
    fireEvent.click(screen.getByRole("button", { name: "Filters", exact: true }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Private" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(toggle).toHaveAccessibleName("Search and filters, 2 active");
    fireEvent.click(toggle);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Search unavailable");
    fireEvent.click(toggle);
    expect(screen.getByRole("searchbox")).toHaveValue("Night");
    expect(screen.getByRole("button", { name: "Filters, 1 active", exact: true })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Packs" })).toHaveAttribute("aria-selected", "true");
  });
  it.each(["dub", "sample"] as const)("places %s tabs and compact search in the mobile header", (kind) => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const header = document.createElement("div");
    document.body.append(header);
    const { container } = render(<CollectionHeaderContext.Provider value={header}>
      <LatestDubsTemplate {...packProps} mediaKind={kind} compactHeader dubs={[dub, second]} packs={[{ ...pack, kind }]} />
    </CollectionHeaderContext.Provider>);
    const tabs = within(header).getByRole("tablist", { name: /view/ });
    const toggle = within(header).getByRole("button", { name: "Search and filters" });
    expect(container).not.toContainElement(tabs);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(within(tabs).getByRole("tab", { name: "Packs" }));
    expect(within(container).getByRole("tabpanel")).toHaveAccessibleName("Packs");
    fireEvent.click(toggle);
    expect(within(header).getByRole("searchbox")).toBeVisible();
    header.remove();
  });
  it.each(["dub", "sample"] as const)("separates individual %s files from a pack grid while retaining filters and playback", (kind) => {
    const play = vi.fn();
    const single = { ...dub, id: "single", title: "Standalone" };
    const release = { ...pack, kind: "sample" as const };
    const { rerender } = render(<LatestDubsTemplate {...packProps} mediaKind={kind} dubs={[dub, second, single]}
      packs={[{ ...pack, kind }, { ...release, id: "draft", status: "draft" }]} onPlayPack={play} />);
    const feed = screen.getByRole("region", { name: "Community uploads" });
    const tabs = within(screen.getByRole("tablist", { name: "Dub Vault view" })).getAllByRole("tab");
    expect(tabs.map(tab => tab.textContent)).toEqual(kind === "sample" ? ["Packs", "Samples"] : ["Dubs", "Packs"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    if (kind === "sample") {
      expect(within(feed).getByRole("button", { name: "Open pack" })).toBeVisible();
      fireEvent.click(screen.getByRole("tab", { name: "Samples", exact: true }));
    }
    expect(screen.getByRole("tab", { name: kind === "sample" ? "Samples" : "Dubs", exact: true }).parentElement)
      .toHaveClass("collection-tabs", `media-kind--${kind}`);
    expect(within(feed).getAllByRole("article")).toHaveLength(3);
    expect(within(feed).queryByRole("button", { name: "Open pack" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
    expect(screen.getByRole("tab", { name: "Packs", exact: true })).toHaveAttribute("aria-selected", "true");
    expect(feed).toHaveClass("vault-pack-grid");
    expect(within(feed).getAllByRole("article")).toHaveLength(1);
    expect(within(feed).getByRole("article")).toHaveClass("dub-pack-card--grid");
    expect(within(feed).getByRole("region", { name: "Audio player: My Dub" })).toBeVisible();
    expect(within(feed).queryByRole("button", { name: "Play all" })).not.toBeInTheDocument();
    fireEvent.click(within(feed).getByRole("button", { name: "Play", exact: true }));
    expect(play).toHaveBeenCalledWith(pack.items.map(({ dub }) => dub), pack.id);
    rerender(<LatestDubsTemplate {...packProps} mediaKind={kind} dubs={[single]} packs={[{ ...pack, kind }]} queryAlreadyFiltered />);
    expect(screen.getByText("No packs found")).toBeVisible();
    expect(within(feed).queryByRole("article")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: kind === "sample" ? "Samples" : "Dubs", exact: true }));
    expect(within(feed).getByRole("region", { name: "Audio player: Standalone" })).toBeVisible();
  });

  it("finds a pack by title in Packs and preserves a matching subset in its playlist", () => {
    const { rerender } = render(<LatestDubsTemplate {...packProps} mediaKind="dub" dubs={[dub, second]} packs={[pack]} query="Night Sessions" />);
    fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
    expect(screen.getByRole("article", { name: "Dub Pack: Night Sessions" })).toBeVisible();
    rerender(<LatestDubsTemplate {...packProps} mediaKind="dub" dubs={[second]} packs={[pack]} queryAlreadyFiltered query="Closing" />);
    fireEvent.click(screen.getByRole("button", { name: "Show 2 tracks" }));
    expect(screen.getByText(/1 track matches your filters/)).toBeVisible();
    expect(screen.queryByRole("article", { name: "My Dub" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Closing Dub" })).toBeVisible();
  });

  it("groups pack members into one expandable release before pagination without duplicate standalone cards", () => {
    const standalone = { ...dub, id: "single", title: "Standalone" };
    render(<LatestDubsTemplate {...packProps} dubs={[dub, second, standalone]} packs={[pack]} />);
    const feed = screen.getByRole("region", { name: "Community uploads" });
    expect(within(feed).getAllByRole("article")).toHaveLength(2);
    expect(within(feed).getByRole("article", { name: "Dub Pack: Night Sessions" })).toBeVisible();
    expect(within(feed).getByRole("region", { name: "Audio player: Standalone" })).toBeVisible();
    const packCard = within(feed).getByRole("article", { name: "Dub Pack: Night Sessions" });
    expect(packCard).toContainElement(within(feed).getByRole("region", { name: "Audio player: My Dub" }));
    expect(within(feed).queryByRole("article", { name: "My Dub" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 2 tracks" }));
    expect(within(feed).getByRole("article", { name: "My Dub" })).toBeVisible();
    expect(within(feed).getByRole("article", { name: "Closing Dub" })).toBeVisible();
  });

  it("preserves filtered tracks, multiple-pack membership and standalone crate behavior", () => {
    const { rerender } = render(<LatestDubsTemplate {...packProps} dubs={[second]} packs={[pack, { ...pack, id: "other", title: "Other release" }]} queryAlreadyFiltered />);
    const feed = screen.getByRole("region", { name: "Community uploads" });
    expect(within(feed).getAllByRole("article")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Show 2 tracks" })[0]);
    expect(screen.getByText(/1 track matches your filters/)).toBeVisible();
    expect(within(feed).queryByRole("article", { name: "My Dub" })).not.toBeInTheDocument();
    rerender(<LatestDubsTemplate {...packProps} dubs={[dub, second]} packs={[pack]} crateId="crate" />);
    expect(within(feed).queryByRole("article", { name: "Dub Pack: Night Sessions" })).not.toBeInTheDocument();
    expect(within(feed).getAllByRole("region", { name: /^Audio player:/ })).toHaveLength(2);
  });

  it("finds published packs by title without exposing draft pack metadata", () => {
    const { rerender } = render(<LatestDubsTemplate {...packProps} dubs={[dub, second]} packs={[pack]} query="Night Sessions" />);
    expect(screen.getByRole("article", { name: "Dub Pack: Night Sessions" })).toBeVisible();
    rerender(<LatestDubsTemplate {...packProps} dubs={[dub, second]} packs={[{ ...pack, status: "draft" }]} query="Night Sessions" />);
    expect(screen.queryByRole("article", { name: "Dub Pack: Night Sessions" })).not.toBeInTheDocument();
    expect(screen.getByText("No dubs found")).toBeVisible();
  });

  it("paginates releases rather than splitting a pack's tracks across feed pages", () => {
    const tracks = Array.from({ length: 7 }, (_, index) => ({ ...dub, id: `track-${index}`, title: `Track ${index}` }));
    const standalone = { ...dub, id: "standalone", title: "Standalone" };
    render(<LatestDubsTemplate {...packProps} dubs={[...tracks, standalone]} packs={[{ ...pack, items: tracks.map((dub) => ({ dub })) }]} />);
    const feed = screen.getByRole("region", { name: "Community uploads" });
    expect(within(feed).getByRole("article", { name: "Dub Pack: Night Sessions" })).toBeVisible();
    expect(within(feed).getByRole("region", { name: "Audio player: Standalone" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Releases pagination" })).not.toBeInTheDocument();
  });

  it("shows a loading indicator in place of stale results and pagination while searching", () => {
    const props = {
      dubs: [dub], likedDubIds: new Set<string>(), nowPlayingId: null, isPlaying: false,
      onDownload: vi.fn(), onOpenProfile: vi.fn(), onPlay: vi.fn(),
    };
    const { rerender } = render(<LatestDubsTemplate {...props} isSearching />);
    const feed = screen.getByRole("region", { name: "Community uploads" });
    expect(within(feed).getByRole("status")).toHaveTextContent("Searching dubs");
    expect(feed.querySelector(".button__spinner")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Audio player: My Dub" })).not.toBeInTheDocument();
    expect(screen.queryByText("No dubs found")).not.toBeInTheDocument();
    rerender(<LatestDubsTemplate {...props} isSearching={false} />);
    expect(within(feed).queryByText("Searching dubs")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Audio player: My Dub" })).toBeVisible();
  });

  it("prioritizes A-List dubs before pagination while sorting within each tier", () => {
    const dubs: Dub[] = [
      { ...dub, id: "public", title: "Public", distribution: "worldwide", uploadedAt: "2026-11-08T12:00:00Z", likes: 100 },
      { ...dub, id: "a1", title: "A1", distribution: "alist", uploadedAt: "2026-11-01T12:00:00Z", likes: 2 },
      { ...dub, id: "a2", title: "A2", distribution: "alist", uploadedAt: "2026-11-02T12:00:00Z", likes: 1 },
      ...[3, 4, 5, 6].map((n): Dub => ({ ...dub, id: `a${n}`, title: `A${n}`, distribution: "alist", uploadedAt: `2026-10-${20 + n}T12:00:00Z`, likes: 0 })),
    ];
    const { rerender } = render(<LatestDubsTemplate
      dubs={dubs} prioritizeAList likedDubIds={new Set()} nowPlayingId={null} isPlaying={false}
      onDownload={vi.fn()} onOpenProfile={vi.fn()} onPlay={vi.fn()}
    />);
    const titles = () => within(screen.getByRole("region", { name: "Community uploads" }))
      .getAllByRole("region", { name: /^Audio player:/ }).map((region) => region.getAttribute("aria-label"));
    expect(titles()).toEqual(["Audio player: A2", "Audio player: A1", "Audio player: A6", "Audio player: A5", "Audio player: A4"]);
    expect(screen.getByText(/A-List dubs appear first/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next Dubs page" }));
    expect(titles()).toEqual(["Audio player: A3", "Audio player: Public"]);
    fireEvent.click(screen.getByRole("tab", { name: "Most liked" }));
    expect(titles().slice(0, 2)).toEqual(["Audio player: A1", "Audio player: A2"]);
    fireEvent.click(screen.getByRole("button", { name: "Next Dubs page" }));
    expect(titles().at(-1)).toBe("Audio player: Public");
    rerender(<LatestDubsTemplate
      dubs={dubs} likedDubIds={new Set()} nowPlayingId={null} isPlaying={false}
      onDownload={vi.fn()} onOpenProfile={vi.fn()} onPlay={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Previous Dubs page" }));
    expect(titles()[0]).toBe("Audio player: Public");
  });

  it("does not discard matches already filtered by the server", () => {
    render(<LatestDubsTemplate
      dubs={[{ ...dub, distribution: "alist", message: "rare description" }]} query="rare description" queryAlreadyFiltered prioritizeAList
      likedDubIds={new Set()} nowPlayingId={null} isPlaying={false}
      onDownload={vi.fn()} onOpenProfile={vi.fn()} onPlay={vi.fn()}
    />);
    expect(screen.getByRole("region", { name: "Audio player: My Dub" })).toBeVisible();
  });

  it("keeps the priority explanation outside the toolbar and sort above search", () => {
    render(<LatestDubsTemplate
      dubs={[{ ...dub, distribution: "alist" }]} prioritizeAList
      likedDubIds={new Set()} nowPlayingId={null} isPlaying={false}
      onDownload={vi.fn()} onOpenProfile={vi.fn()} onPlay={vi.fn()}
    />);
    const priority = screen.getByText(/A-List dubs appear first/);
    const sort = screen.getByRole("tablist", { name: "Sort dubs" });
    const search = screen.getByRole("region", { name: "Search dubs" });
    expect(priority.closest(".dub-search-toolbar")).toBeNull();
    expect(sort.closest(".dub-search-toolbar")).toBe(search.closest(".dub-search-toolbar"));
    expect(sort.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shares a feed dub through the friend-sharing action", () => {
    const onShareWithFriend = vi.fn();
    render(<LatestDubsTemplate
      dubs={[dub]} likedDubIds={new Set()} nowPlayingId={null} isPlaying={false}
      onDownload={vi.fn()} onOpenProfile={vi.fn()} onPlay={vi.fn()}
      currentUsername="meladee" onShareWithFriend={onShareWithFriend}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Share My Dub" }));
    expect(onShareWithFriend).toHaveBeenCalledWith(dub);
  });

  it("can show a compact music-first heading without the rotation introduction", () => {
    render(<LatestDubsTemplate
      dubs={[dub]}
      likedDubIds={new Set()}
      nowPlayingId={null}
      isPlaying={false}
      onDownload={vi.fn()}
      onOpenProfile={vi.fn()}
      onPlay={vi.fn()}
      showIntro={false}
      feedName="The Dub Vault"
    />);
    expect(screen.getByRole("heading", { name: "The Dub Vault" })).toBeInTheDocument();
    expect(screen.queryByText("YOUR COMMUNITY, IN ROTATION")).not.toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Sort dubs" })).toBeInTheDocument();
  });

  it("offers a compact archive heading while retaining the sorting explanation for assistive technology", () => {
    render(<LatestDubsTemplate
      dubs={[{ ...dub, distribution: "alist" }]} prioritizeAList compactHeader
      likedDubIds={new Set()} nowPlayingId={null} isPlaying={false}
      onDownload={vi.fn()} onOpenProfile={vi.fn()} onPlay={vi.fn()}
    />);
    expect(screen.getByRole("heading", { name: "Dub Vault" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Dub Vault" })).not.toHaveClass("sr-only");
    expect(screen.getByText("Community archive")).toBeVisible();
    expect(screen.getByText("Browse · Play · Collect")).toBeVisible();
    expect(screen.queryByText("YOUR COMMUNITY, IN ROTATION")).not.toBeInTheDocument();
    expect(screen.getByText(/A-List dubs appear first/)).toHaveClass("sr-only");
    expect(screen.getByRole("tablist", { name: "Sort dubs" })).toHaveAccessibleDescription(/A-List dubs appear first/);
    expect(screen.getByRole("region", { name: "Audio player: My Dub" })).toBeVisible();
  });

  it("shows the playing indicator only on the active dub card", () => {
    const otherDub = { ...dub, id: "other", title: "Other Dub", uploader: "someone-else" };
    const props = {
      dubs: [dub, otherDub], likedDubIds: new Set<string>(), onDownload: vi.fn(),
      onOpenProfile: vi.fn(), onPlay: vi.fn(),
    };
    const { rerender } = render(<LatestDubsTemplate {...props} nowPlayingId={dub.id} isPlaying />);
    const first = screen.getByRole("region", { name: "Audio player: My Dub" });
    const second = screen.getByRole("region", { name: "Audio player: Other Dub" });
    expect(within(first).getByRole("status", { name: "Now playing" })).toBeVisible();
    expect(within(second).queryByRole("status", { name: "Now playing" })).not.toBeInTheDocument();

    rerender(<LatestDubsTemplate {...props} nowPlayingId={otherDub.id} isPlaying />);
    expect(within(first).queryByRole("status", { name: "Now playing" })).not.toBeInTheDocument();
    expect(within(second).getByRole("status", { name: "Now playing" })).toBeVisible();

    rerender(<LatestDubsTemplate {...props} nowPlayingId={otherDub.id} isPlaying={false} />);
    expect(screen.queryByRole("status", { name: "Now playing" })).not.toBeInTheDocument();
  });

  it("shows edit and delete controls for the current user's tracks only", () => {
    const onEditDub = vi.fn();
    const onDeleteDub = vi.fn();
    const otherDub = { ...dub, id: "other", title: "Other Dub", uploader: "someone-else" };
    render(<LatestDubsTemplate
      dubs={[dub, otherDub]}
      likedDubIds={new Set()}
      nowPlayingId={null}
      isPlaying={false}
      onDownload={vi.fn()}
      onOpenProfile={vi.fn()}
      onPlay={vi.fn()}
      currentUsername="amber"
      onEditDub={onEditDub}
      onDeleteDub={onDeleteDub}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Actions for My Dub" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit My Dub" }));
    fireEvent.click(screen.getByRole("button", { name: "Actions for My Dub" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete My Dub" }));
    expect(onEditDub).toHaveBeenCalledWith(dub);
    expect(onDeleteDub).toHaveBeenCalledWith(dub);
    expect(screen.queryByRole("button", { name: "Actions for Other Dub" })).not.toBeInTheDocument();
  });
});
