import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessengerTemplate } from "./MessengerTemplate";
import type { Dub } from "../communityTypes";

afterEach(cleanup);

describe("MessengerTemplate shared dubs", () => {
  it("offers only owned dubs and can open the existing upload flow", () => {
    const ownDub: Dub = {
      id: "my-dub", title: "My Release", artist: "You", uploader: "you",
      uploaderDisplayName: "You", uploadedAt: "2026-11-01T12:00:00.000Z", bpm: 174,
      genre: "Jungle", duration: "03:30", likes: 0, downloads: 0,
      artwork: "whitelabel", message: "Ready to send",
    };
    const foreignDub: Dub = { ...ownDub, id: "foreign", title: "Someone Else's", uploader: "other" };
    const onCreateAndShareDub = vi.fn();
    const onSendMessage = vi.fn(async () => true);
    const onEditDub = vi.fn();
    const onDeleteDub = vi.fn();
    render(<MessengerTemplate
      buddies={[{ id: "friend-1", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] }]}
      conversations={[]}
      dubs={[ownDub, foreignDub]}
      shareableDubs={[ownDub]}
      currentUsername="you"
      initialBuddyId="friend-1"
      chatConnectionStatus="connected"
      nowPlayingId={null}
      isPlaying={false}
      onOpenProfile={vi.fn()}
      onPlay={vi.fn()}
      onStartConversation={vi.fn()}
      onCreateAndShareDub={onCreateAndShareDub}
      onEditDub={onEditDub}
      onDeleteDub={onDeleteDub}
      onSelectConversation={vi.fn()}
      onLoadOlderMessages={vi.fn(async () => null)}
      onSendMessage={onSendMessage}
    />);
    const trigger = screen.getByRole("button", { name: "Share one of My Dubs" });
    fireEvent.click(trigger);
    expect(screen.getByText("My Release")).toBeInTheDocument();
    expect(screen.queryByText("Someone Else's")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit My Release" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete My Release" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share Dub" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload & share" }));
    expect(onCreateAndShareDub).toHaveBeenCalledWith("friend-1");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Share My Release with Amber" }));
    expect(onSendMessage).toHaveBeenCalledWith("friend-1", "Shared a dub: My Release", "my-dub");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("plays and downloads a shared dub inside its conversation", () => {
    const dub: Dub = {
      id: "dub-1", title: "Jungle Drop", artist: "Amber", uploader: "amber",
      uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z", bpm: 174,
      genre: "Jungle", tags: ["Jungle", "Rollers"], duration: "03:30", likes: 1,
      downloads: 1, artwork: "whitelabel", message: "Fresh dub", audioUrl: "/audio.wav",
      audioFormat: "WAV", bitrateKbps: 320,
    };
    const onPlay = vi.fn();
    const onDownload = vi.fn();
    const onEditDub = vi.fn();
    const onDeleteDub = vi.fn();
    render(<MessengerTemplate
      buddies={[{ id: "friend-1", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] }]}
      conversations={[{ buddyId: "friend-1", messages: [{ id: "message-1", sender: "them", text: "Shared a dub: Jungle Drop", sentAt: "2026-11-01T12:00:00.000Z", dubId: dub.id }] }]}
      dubs={[dub]}
      currentUsername="amber"
      initialBuddyId="friend-1"
      chatConnectionStatus="connected"
      nowPlayingId={dub.id}
      isPlaying
      currentTimeSeconds={35}
      durationSeconds={210}
      onSeek={vi.fn()}
      onOpenProfile={vi.fn()}
      onPlay={onPlay}
      onDownload={onDownload}
      onEditDub={onEditDub}
      onDeleteDub={onDeleteDub}
      onStartConversation={vi.fn()}
      onSelectConversation={vi.fn()}
      onLoadOlderMessages={vi.fn(async () => null)}
      onSendMessage={vi.fn(async () => true)}
    />);
    expect(screen.getByRole("region", { name: "Audio player: Jungle Drop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Jungle Drop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Jungle Drop" })).toBeInTheDocument();
    expect(screen.getByText("WAV")).toBeInTheDocument();
    expect(screen.getAllByText("320 kbps avg").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Download Jungle Drop" }));
    const inlineControls = screen
      .getByRole("region", { name: "Audio player: Jungle Drop" })
      .querySelectorAll(".transport-controls__play, .audio-player__timeline, .shared-dub__download");
    expect(Array.from(inlineControls, (element) => element.className)).toEqual([
      "button button--secondary button--small transport-controls__play",
      "audio-player__timeline",
      "button button--tertiary button--small app-icon-button shared-dub__download",
    ]);
    expect(onPlay).toHaveBeenCalledWith(dub);
    expect(onDownload).toHaveBeenCalledWith(dub);
  });
});
