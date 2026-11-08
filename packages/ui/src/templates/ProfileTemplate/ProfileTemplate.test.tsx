import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileTemplate } from "./ProfileTemplate";
import type { Dub, MemberProfile } from "../communityTypes";

afterEach(cleanup);

const profile: MemberProfile = {
  id: "amber", username: "amber", displayName: "Amber", presence: "online",
  genre: "Jungle", role: "DJ", bio: "Making tunes", groups: [],
};
const dub: Dub = {
  id: "owned", title: "My Dub", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z", bpm: 174,
  genre: "Jungle", duration: "03:30", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "Fresh dub",
};

describe("ProfileTemplate ownership controls", () => {
  it("shows dub management actions on the signed-in user's profile", () => {
    const onEditDub = vi.fn();
    const onDeleteDub = vi.fn();
    render(<ProfileTemplate
      profile={profile}
      uploads={[dub]}
      isOwnProfile
      playingDubId={null}
      isPlaying={false}
      onEditProfile={vi.fn()}
      onMessage={vi.fn()}
      onPlay={vi.fn()}
      onDownload={vi.fn()}
      onEditDub={onEditDub}
      onDeleteDub={onDeleteDub}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Actions for My Dub" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit My Dub" }));
    fireEvent.click(screen.getByRole("button", { name: "Actions for My Dub" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete My Dub" }));
    expect(onEditDub).toHaveBeenCalledWith(dub);
    expect(onDeleteDub).toHaveBeenCalledWith(dub);
  });
});
