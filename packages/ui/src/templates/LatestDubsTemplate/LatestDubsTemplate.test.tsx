import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LatestDubsTemplate } from "./LatestDubsTemplate";
import type { Dub } from "../communityTypes";

afterEach(cleanup);

const dub: Dub = {
  id: "owned", title: "My Dub", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z", bpm: 174,
  genre: "Jungle", duration: "03:30", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "Fresh dub",
};

describe("LatestDubsTemplate ownership controls", () => {
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

  it("shares a feed dub through the friend-sharing action", () => {
    const onShareWithFriend = vi.fn();
    render(<LatestDubsTemplate
      dubs={[dub]} likedDubIds={new Set()} nowPlayingId={null} isPlaying={false}
      onDownload={vi.fn()} onOpenProfile={vi.fn()} onPlay={vi.fn()}
      currentUsername="meladee" onShareWithFriend={onShareWithFriend}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Share My Dub with a friend" }));
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
