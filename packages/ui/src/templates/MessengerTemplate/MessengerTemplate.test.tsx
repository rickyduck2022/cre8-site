import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MessengerTemplate } from "./MessengerTemplate";
import type { Dub } from "../communityTypes";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("MessengerTemplate shared dubs", () => {
  it.each([false, true])("uses compact dub cards in the share picker (mobile: %s)", (mobile) => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const dub: Dub = {
      id: "dub", title: "My Release", artist: "You", uploader: "you", uploaderDisplayName: "You",
      uploadedAt: "2026-11-01T12:00:00Z", bpm: 174, genre: "Jungle", duration: "03:30",
      likes: 0, downloads: 0, artwork: "whitelabel", message: "", distribution: "private",
      sharedBuddyIds: ["friend"],
    };
    const open = vi.fn();
    render(<MessengerTemplate
      buddies={[{ id: "friend", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] }]}
      conversations={[]} dubs={[dub]} shareableDubs={[dub]} initialBuddyId="friend"
      chatConnectionStatus="connected" nowPlayingId={null} isPlaying={false}
      onOpenProfile={open} onPlay={vi.fn()} onStartConversation={vi.fn()}
      onSelectConversation={vi.fn()} onLoadOlderMessages={vi.fn(async () => null)} onSendMessage={vi.fn(async () => true)}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Share one of My Dubs" }));
    const picker = mobile
      ? screen.getByRole("dialog", { name: "Share one of My Dubs" })
      : screen.getByRole("region", { name: "My Dubs available to share" });
    const card = within(picker).getByRole("article");
    expect(card).toHaveClass("dub-card", "dub-card--compact", "dub-card--private");
    expect(within(card).getByLabelText("Distribution: Private")).toHaveClass("dub-card__distribution--private");
    expect(within(card).getByText("Shared")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Share My Release again with Amber" })).toBeEnabled();
    expect(within(card).queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "You" }));
    expect(open).toHaveBeenCalledWith("you");
  });

  it("uses the mobile modal and preserves its search when switching layout", () => {
    let mobile = true;
    let listener: (() => void) | undefined;
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: mobile,
      addEventListener: (_event: string, callback: () => void) => { listener = callback; },
      removeEventListener: vi.fn(),
    })));
    render(<MessengerTemplate
      buddies={[{ id: "friend", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] }]}
      conversations={[]} dubs={[]} initialBuddyId="friend" chatConnectionStatus="connected" nowPlayingId={null} isPlaying={false}
      onOpenProfile={vi.fn()} onPlay={vi.fn()} onStartConversation={vi.fn()} onSelectConversation={vi.fn()}
      onLoadOlderMessages={vi.fn(async () => null)} onSendMessage={vi.fn(async () => true)}
    />);
    const trigger = screen.getByRole("button", { name: "Share one of My Dubs" });
    expect(trigger).toHaveClass("button", "button--primary", "button--small");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Share one of My Dubs" });
    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search My Dubs to share" }), { target: { value: "jungle" } });
    act(() => { mobile = false; listener?.(); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "My Dubs available to share" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search My Dubs to share" })).toHaveValue("jungle");
    act(() => { mobile = true; listener?.(); });
    const reopened = screen.getByRole("dialog", { name: "Share one of My Dubs" });
    expect(within(reopened).getByRole("searchbox")).toHaveValue("jungle");
    fireEvent(reopened, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates between the mobile list and thread, preserving drafts per conversation", async () => {
    const select = vi.fn();
    const showConversations = vi.fn();
    const start = vi.fn();
    const send = vi.fn(async () => true);
    const buddies = [
      { id: "friend", username: "amber", displayName: "Amber", presence: "online" as const, genre: "Jungle", role: "DJ", bio: "", groups: [] },
      { id: "other", username: "ben", displayName: "Ben", presence: "offline" as const, genre: "Jungle", role: "DJ", bio: "", groups: [], unread: 2 },
    ];
    const props = {
      buddies, conversations: [], dubs: [], initialBuddyId: "", chatConnectionStatus: "connected" as const,
      nowPlayingId: null, isPlaying: false, onOpenProfile: vi.fn(), onPlay: vi.fn(),
      onStartConversation: start, onSelectConversation: select, onShowConversations: showConversations, onLoadOlderMessages: vi.fn(async () => null), onSendMessage: send,
    };
    const { container, rerender } = render(<MessengerTemplate {...props} />);
    const messenger = container.querySelector(".messenger");
    expect(screen.getByRole("heading", { name: "Messages" })).toBeVisible();
    expect(screen.queryByText("PRIVATE CONVERSATIONS")).not.toBeInTheDocument();
    expect(messenger).not.toHaveClass("messenger--thread-open");
    fireEvent.click(screen.getByRole("button", { name: "Start a conversation" }));
    expect(start).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Open conversation with Amber" }));
    expect(messenger).toHaveClass("messenger--thread-open");
    expect(select).toHaveBeenCalledWith("friend");
    fireEvent.change(screen.getByLabelText("Message Amber"), { target: { value: "Amber draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(messenger).not.toHaveClass("messenger--thread-open");
    expect(showConversations).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Open conversation with Ben" }));
    expect(screen.getByLabelText("Message Ben")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Message Ben"), { target: { value: "Hello Ben" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(send).toHaveBeenCalledWith("other", "Hello Ben"));
    await waitFor(() => expect(screen.getByLabelText("Message Ben")).toHaveValue(""));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Open conversation with Amber" }));
    expect(screen.getByLabelText("Message Amber")).toHaveValue("Amber draft");
    rerender(<MessengerTemplate {...props} initialBuddyId="other" navigationKey={1} />);
    expect(messenger).toHaveClass("messenger--thread-open");
    expect(screen.getByLabelText("Message Ben")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    rerender(<MessengerTemplate {...props} initialBuddyId="other" navigationKey={2} />);
    expect(messenger).toHaveClass("messenger--thread-open");
  });

  it("only offers restricted A-List dubs to approved recipients, while public A-List dubs remain shareable", () => {
    const dub: Dub = { id: "restricted", title: "Restricted", artist: "You", uploader: "you", uploaderDisplayName: "You", uploadedAt: "", bpm: 0, genre: "Jungle", duration: "1:00", likes: 0, downloads: 0, artwork: "", message: "", distribution: "alist" };
    const publicDub = { ...dub, id: "public", title: "Public", aListPublic: true };
    render(<MessengerTemplate
      buddies={[
        { id: "friend", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] },
        { id: "approved", username: "ben", displayName: "Ben", presence: "offline", genre: "Jungle", role: "DJ", bio: "", groups: [], aListApproved: true },
      ]}
      conversations={[]} dubs={[dub, publicDub]} shareableDubs={[dub, publicDub]} initialBuddyId="friend" chatConnectionStatus="connected" nowPlayingId={null} isPlaying={false}
      onOpenProfile={vi.fn()} onPlay={vi.fn()} onStartConversation={vi.fn()} onSelectConversation={vi.fn()} onLoadOlderMessages={vi.fn(async () => null)} onSendMessage={vi.fn(async () => true)}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Share one of My Dubs" }));
    expect(screen.queryByRole("button", { name: "Share Restricted with Amber" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share Public with Amber" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open conversation with Ben" }));
    fireEvent.click(screen.getByRole("button", { name: "Share one of My Dubs" }));
    expect(screen.getByRole("button", { name: "Share Restricted with Ben" })).toBeVisible();
  });
  it("selects conversations from the entire row and keeps profile access in the header", () => {
    const open = vi.fn();
    const select = vi.fn();
    render(<MessengerTemplate
      buddies={[
        { id: "friend", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] },
        { id: "other", username: "ben", displayName: "Ben", presence: "offline", genre: "Jungle", role: "DJ", bio: "", groups: [], unread: 2 },
      ]}
      conversations={[{ buddyId: "other", messages: [{ id: "msg", sender: "them", text: "Hello", sentAt: "2026-11-01T12:00:00Z" }] }]} dubs={[]} initialBuddyId="friend" chatConnectionStatus="connected" nowPlayingId={null} isPlaying={false}
      onOpenProfile={open} onPlay={vi.fn()} onStartConversation={vi.fn()} onSelectConversation={select} onLoadOlderMessages={vi.fn(async () => null)} onSendMessage={vi.fn(async () => true)}
    />);
    const row = screen.getByRole("button", { name: "Open conversation with Ben" });
    expect(row).not.toHaveAttribute("aria-current");
    fireEvent.click(within(row).getByRole("img", { name: "Ben" }));
    expect(select).toHaveBeenCalledWith("other");
    expect(row).toHaveAttribute("aria-current", "true");
    fireEvent.click(within(row).getByText("Ben"));
    fireEvent.click(within(row).getByText("Hello"));
    fireEvent.click(within(row).getByText("2"));
    expect(select).toHaveBeenCalledTimes(4);
    expect(open).not.toHaveBeenCalled();
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "View Ben's profile" })[0]);
    expect(open).toHaveBeenCalledWith("ben");
  });
  it("offers an explicit share again action for dubs already sent to the selected friend", async () => {
    const dub: Dub = {
      id: "dub", title: "My Release", artist: "You", uploader: "you", uploaderDisplayName: "You",
      uploadedAt: "2026-11-01T12:00:00Z", bpm: 0, genre: "Jungle", duration: "03:30",
      likes: 0, downloads: 0, artwork: "whitelabel", message: "", sharedBuddyIds: ["friend-1"],
    };
    const send = vi.fn(async () => true);
    render(<MessengerTemplate
      buddies={[{ id: "friend-1", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] }]}
      conversations={[]} dubs={[dub]} shareableDubs={[dub]} initialBuddyId="friend-1"
      chatConnectionStatus="connected" nowPlayingId={null} isPlaying={false}
      onOpenProfile={vi.fn()} onPlay={vi.fn()} onStartConversation={vi.fn()}
      onSelectConversation={vi.fn()} onLoadOlderMessages={vi.fn(async () => null)} onSendMessage={send}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Share one of My Dubs" }));
    expect(screen.queryByRole("button", { name: "Share My Release with Amber" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Share My Release again with Amber" }));
    await waitFor(() => expect(send).toHaveBeenCalledWith("friend-1", "Shared a dub: My Release", "dub"));
  });

  it("offers only owned dubs and can open the existing upload flow", async () => {
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
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Share My Release with Amber" }));
    expect(onSendMessage).toHaveBeenCalledWith("friend-1", "Shared a dub: My Release", "my-dub");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));

    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

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
      conversations={[{ buddyId: "friend-1", messages: [{ id: "message-1", sender: "them", text: "Have a listen", sentAt: "2026-11-01T12:00:00.000Z", dubId: dub.id }] }]}
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
    expect(within(screen.getByRole("log", { name: "Conversation messages" })).getByText("Have a listen")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit Jungle Drop" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Jungle Drop" })).not.toBeInTheDocument();
    expect(screen.getByText("WAV")).toBeInTheDocument();
    expect(screen.getAllByText("320 kbps avg").length).toBeGreaterThan(0);
    const player = screen.getByRole("region", { name: "Audio player: Jungle Drop" });
    expect(player).not.toHaveClass("audio-player--playable");
    const details = within(player).getByRole("region", { name: "Track details" });
    expect(details).toHaveClass("track-metadata--inline");
    expect(details).toHaveAttribute("tabindex", "0");
    for (const tag of ["Jungle", "Rollers", "174 BPM", "WAV", "320 kbps avg"]) {
      expect(within(details).getByText(tag)).toHaveClass("track-tag--dark");
    }
    expect(within(details).getByLabelText("Audio file details")).toHaveClass("track-file-metadata--inline");
    const download = within(player).getByRole("button", { name: "Download Jungle Drop" });
    expect(download.parentElement).toBe(details.parentElement);
    expect(details.nextElementSibling).toBe(download);
    expect(player.querySelector(".audio-player__end-action")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Download Jungle Drop" }));
    const inlineControls = screen
      .getByRole("region", { name: "Audio player: Jungle Drop" })
      .querySelectorAll(".transport-controls__play, .audio-player__timeline, .shared-dub__download");
    expect(inlineControls).toHaveLength(3);
    expect(inlineControls[0]).toHaveClass("transport-controls__play");
    expect(inlineControls[1]).toHaveClass("audio-player__timeline");
    expect(inlineControls[2]).toHaveClass("shared-dub__download");
    expect(onPlay).toHaveBeenCalledWith(dub);
    expect(onDownload).toHaveBeenCalledWith(dub);
  });

  it("keeps the share menu open if sending fails and supports searching", async () => {
    const dub: Dub = {
      id: "my-dub", title: "My Release", artist: "You", uploader: "you",
      uploaderDisplayName: "You", uploadedAt: "2026-11-01T12:00:00Z", bpm: 174,
      genre: "Jungle", duration: "03:30", likes: 0, downloads: 0, artwork: "whitelabel", message: "",
    };
    render(<MessengerTemplate
      buddies={[{ id: "friend", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] }]}
      conversations={[]} dubs={[dub]} shareableDubs={[dub]} initialBuddyId="friend"
      chatConnectionStatus="connected" nowPlayingId={null} isPlaying={false}
      onOpenProfile={vi.fn()} onPlay={vi.fn()} onStartConversation={vi.fn()}
      onSelectConversation={vi.fn()} onLoadOlderMessages={vi.fn(async () => null)}
      onSendMessage={vi.fn(async () => false)}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Share one of My Dubs" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search My Dubs to share" }), { target: { value: "missing" } });
    expect(screen.getByText("No dubs match your search.")).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search My Dubs to share" }), { target: { value: "release" } });
    fireEvent.click(screen.getByRole("button", { name: "Share My Release with Amber" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not send this dub");
    expect(screen.getByRole("button", { name: "Share one of My Dubs" })).toHaveAttribute("aria-expanded", "true");
  });
});
