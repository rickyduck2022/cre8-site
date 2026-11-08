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
  it("shows all supplied distribution types in My Dubs with their management actions", () => {
    const uploads: Dub[] = [
      { ...dub, distribution: "worldwide", title: "Worldwide dub" },
      { ...dub, id: "alist", distribution: "alist", title: "A-List dub" },
      { ...dub, id: "private", distribution: "private", title: "Private dub" },
    ];
    const onEditDub = vi.fn();
    render(<ProfileTemplate
      profile={profile} uploads={uploads} isOwnProfile playingDubId={null} isPlaying={false}
      onEditProfile={vi.fn()} onMessage={vi.fn()} onPlay={vi.fn()} onDownload={vi.fn()} onEditDub={onEditDub} onDeleteDub={vi.fn()}
    />);
    expect(screen.getByRole("heading", { name: /My Dubs 3/ })).toBeVisible();
    for (const upload of uploads) {
      expect(screen.getByRole("region", { name: `Audio player: ${upload.title}` })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: `Actions for ${upload.title}` }));
      fireEvent.click(screen.getByRole("button", { name: `Edit ${upload.title}` }));
      expect(onEditDub).toHaveBeenLastCalledWith(upload);
    }
  });

  it("shows approval beside the profile name only while approved", () => {
    const props = {
      uploads: [], isOwnProfile: true, playingDubId: null, isPlaying: false,
      onEditProfile: vi.fn(), onMessage: vi.fn(), onPlay: vi.fn(), onDownload: vi.fn(),
    };
    const { rerender } = render(<ProfileTemplate {...props} profile={{ ...profile, aListApproved: true }} />);
    expect(screen.getByRole("heading", { name: /Amber/ })).toContainElement(screen.getByRole("img", { name: "A-List approved" }));
    rerender(<ProfileTemplate {...props} profile={{ ...profile, aListApproved: false }} />);
    expect(screen.queryByRole("img", { name: "A-List approved" })).not.toBeInTheDocument();
  });

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
