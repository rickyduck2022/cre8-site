import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileTemplate } from "./ProfileTemplate";
import type { Dub, MemberProfile } from "../communityTypes";
import type { DubPack } from "../../organisms/DubPackCard/DubPackCard";

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
  it("shows both pack types on the owner's profile and only public releases on other profiles", () => {
    const pack: DubPack = { id: "pack", title: "Dub release", description: "", kind: "dub", status: "published",
      distribution: "private", aListPublic: false, licence: "", ownerUsername: "amber", ownerDisplayName: "Amber",
      items: [{ dub }], totalBytes: 1200, createdAt: dub.uploadedAt, updatedAt: dub.uploadedAt };
    const props = { profile, uploads: [dub], playingDubId: null, isPlaying: false, onEditProfile: vi.fn(),
      onMessage: vi.fn(), onPlay: vi.fn(), onDownload: vi.fn(), onPlayPack: vi.fn(), onOpenPack: vi.fn(), onEditPack: vi.fn(),
      packs: [pack, { ...pack, id: "sample", title: "Sample release", kind: "sample" as const, distribution: "worldwide" as const },
        { ...pack, id: "draft", title: "Hidden draft", status: "draft" as const },
        { ...pack, id: "other", title: "Other artist", ownerUsername: "other" }] };
    const { rerender } = render(<ProfileTemplate {...props} isOwnProfile currentUsername="amber" />);
    expect(screen.getByRole("article", { name: "Dub Pack: Dub release" })).toBeVisible();
    expect(screen.getByRole("article", { name: "Sample Pack: Sample release" })).toBeVisible();
    expect(screen.queryByText("Hidden draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Other artist")).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("article", { name: "Dub Pack: Dub release" })).getByRole("button", { name: "Edit pack" }));
    expect(props.onEditPack).toHaveBeenCalledWith(pack);
    rerender(<ProfileTemplate {...props} isOwnProfile={false} currentUsername="other" />);
    expect(screen.queryByRole("article", { name: "Dub Pack: Dub release" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Sample Pack: Sample release" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit pack" })).not.toBeInTheDocument();
  });

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
