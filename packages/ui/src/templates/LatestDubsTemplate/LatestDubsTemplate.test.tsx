import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
