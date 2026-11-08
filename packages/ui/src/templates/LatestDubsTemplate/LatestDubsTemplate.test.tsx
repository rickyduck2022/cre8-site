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
