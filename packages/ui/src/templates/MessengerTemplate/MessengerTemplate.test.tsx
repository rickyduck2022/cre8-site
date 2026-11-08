import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    render(<MessengerTemplate
      buddies={[{ id: "friend-1", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [], avatarUrl: "/amber.png" }]}
      conversations={[]}
      dubs={[ownDub, foreignDub]}
      shareableDubs={[ownDub]}
      initialBuddyId="friend-1"
      chatConnectionStatus="connected"
      nowPlayingId={null}
      isPlaying={false}
      onOpenProfile={vi.fn()}
      onPlay={vi.fn()}
      onStartConversation={vi.fn()}
      onCreateAndShareDub={onCreateAndShareDub}
      onSelectConversation={vi.fn()}
      onLoadOlderMessages={vi.fn(async () => null)}
      onSendMessage={onSendMessage}
    />);
    expect(screen.getAllByRole("img", { name: "Amber" })).toHaveLength(2);
    for (const avatar of screen.getAllByRole("img", { name: "Amber" })) {
      expect(avatar.querySelector("img")).toHaveAttribute("src", "/amber.png");
    }
    const trigger = screen.getByRole("button", { name: "Share one of My Dubs" });
    fireEvent.click(trigger);
    expect(screen.getByText("My Release")).toBeInTheDocument();
    expect(screen.queryByText("Someone Else's")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit My Release" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete My Release" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share Dub" })).not.toBeInTheDocument();
    const uploadButton = screen.getByRole("button", { name: "Upload and share a dub" });
    expect(uploadButton).toHaveClass("button--primary");
    expect(uploadButton.querySelector("svg")).toBeInTheDocument();
    expect(uploadButton).not.toHaveTextContent("Upload");
    fireEvent.click(uploadButton);
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
    render(<MessengerTemplate
      buddies={[{ id: "friend-1", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] }]}
      conversations={[{ buddyId: "friend-1", messages: [{ id: "message-1", sender: "them", text: "Shared a dub: Jungle Drop", sentAt: "2026-11-01T12:00:00.000Z", dubId: dub.id }] }]}
      dubs={[dub]}
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
      onStartConversation={vi.fn()}
      onSelectConversation={vi.fn()}
      onLoadOlderMessages={vi.fn(async () => null)}
      onSendMessage={vi.fn(async () => true)}
    />);
    expect(screen.getByRole("region", { name: "Audio player: Jungle Drop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Jungle Drop" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Jungle Drop" })).not.toBeInTheDocument();
    expect(screen.getByText("WAV")).toBeInTheDocument();
    expect(screen.getAllByText("320 kbps avg").length).toBeGreaterThan(0);
    const player = screen.getByRole("region", { name: "Audio player: Jungle Drop" });
    const details = within(player).getByRole("region", { name: "Track details" });
    expect(details).toHaveClass("track-metadata--inline");
    expect(details).toHaveAttribute("tabindex", "0");
    for (const tag of ["Jungle", "Rollers", "174 BPM", "WAV", "320 kbps avg"]) {
      expect(within(details).getByText(tag)).toHaveClass("track-tag--dark");
    }
    expect(within(details).getByLabelText("Audio file details")).toHaveClass("track-file-metadata--inline");
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
