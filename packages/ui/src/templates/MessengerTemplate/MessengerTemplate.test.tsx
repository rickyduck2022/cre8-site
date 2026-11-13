import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MessengerTemplate, type MessengerTemplateProps } from "./MessengerTemplate";
import type { Dub } from "../communityTypes";
import type { DubPack } from "../../types/domain";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(["dub", "sample"] as const)("shares and renders a %s pack through the Messenger picker", async (kind) => {
  const pack: DubPack = { id: "pack", title: "Toolkit", description: "", kind, status: "published",
    distribution: "private", aListPublic: false, licence: "Original works", ownerUsername: "you", ownerDisplayName: "You",
    items: [], totalBytes: 0, createdAt: "2026-11-10", updatedAt: "2026-11-10" };
  const onSendPack = vi.fn(async () => true);
  const onOpenSharedPack = vi.fn();
  render(<MessengerTemplate
    buddies={[{ id: "friend", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] }]}
    conversations={[{ buddyId: "friend", messages: [{ id: "message", sender: "them", text: "Shared pack", packId: "pack", sentAt: "2026-11-10T12:00:00Z" }] }]}
    dubs={[]} packs={[pack]} shareablePacks={[pack]} initialBuddyId="friend"
    chatConnectionStatus="connected" nowPlayingId={null} isPlaying={false}
    onOpenProfile={vi.fn()} onPlay={vi.fn()} onStartConversation={vi.fn()}
    onSelectConversation={vi.fn()} onLoadOlderMessages={vi.fn(async () => null)} onSendMessage={vi.fn(async () => true)}
    onSendPack={onSendPack} onPlayPack={vi.fn()} onOpenPack={vi.fn()} onOpenSharedPack={onOpenSharedPack} />);
  expect(screen.getByRole("article", { name: `${kind === "sample" ? "Sample" : "Dub"} Pack: Toolkit` })).toBeVisible();
  expect(within(screen.getByRole("log", { name: "Conversation messages" })).getByText("Shared pack")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Share a pack" }));
  const picker = screen.getByRole("region", { name: "Packs available to share" });
  fireEvent.click(within(picker).getByRole("button", { name: "Share Toolkit" }));
  const dialog = screen.getByRole("dialog", { name: `Share ${kind === "sample" ? "Sample" : "Dub"} Pack` });
  expect(within(dialog).getByRole("button", { name: "Send pack" })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("checkbox", { name: /Grant selected friends access/ }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Send pack" }));
  await waitFor(() => expect(onSendPack).toHaveBeenCalledWith("friend", pack, true));
  await waitFor(() => expect(onOpenSharedPack).toHaveBeenCalledWith("friend", pack));
});

describe("MessengerTemplate message submission", () => {
  function setup(onSendMessage: MessengerTemplateProps["onSendMessage"]) {
    render(<MessengerTemplate
      buddies={[
        { id: "amber", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] },
        { id: "ben", username: "ben", displayName: "Ben", presence: "offline", genre: "Jungle", role: "DJ", bio: "", groups: [] },
      ]}
      conversations={[]} dubs={[]} initialBuddyId="amber"
      chatConnectionStatus="connected" nowPlayingId={null} isPlaying={false}
      onOpenProfile={vi.fn()} onPlay={vi.fn()} onStartConversation={vi.fn()} onSelectConversation={vi.fn()}
      onLoadOlderMessages={vi.fn(async () => null)} onSendMessage={onSendMessage}
    />);
    fireEvent.change(screen.getByLabelText("Message Amber"), { target: { value: "  Hello Amber  " } });
    return screen.getByRole("button", { name: "Send message" }).closest("form")!;
  }

  it("guards duplicate form submissions, shows sending progress and clears only after success", async () => {
    let finish!: (value: boolean) => void;
    const send = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const form = setup(send);
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith("amber", "Hello Amber");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Sending to Amber…");
    expect(screen.getByLabelText("Message Amber")).toHaveValue("  Hello Amber  ");
    await act(async () => { finish(true); });
    expect(screen.getByLabelText("Message Amber")).toHaveValue("");
    expect(screen.queryByText("Sending to Amber…")).not.toBeInTheDocument();
  });

  it.each(["false", "rejection"])("keeps the draft and allows retry after %s", async (failure) => {
    const send = vi.fn<MessengerTemplateProps["onSendMessage"]>()
      .mockImplementationOnce(async () => {
        if (failure === "rejection") throw new Error("You are offline. Try again.");
        return false;
      })
      .mockResolvedValueOnce(true);
    setup(send);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(failure === "rejection" ? "You are offline. Try again." : "Message could not be sent.");
    expect(screen.getByLabelText("Message Amber")).toHaveValue("  Hello Amber  ");
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByLabelText("Message Amber")).toHaveValue(""));
    expect(send).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([true, false])("does not erase another conversation's draft when a pending send resolves %s", async (success) => {
    let finish!: (value: boolean) => void;
    setup(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Open conversation with Ben" }));
    fireEvent.change(screen.getByLabelText("Message Ben"), { target: { value: "Ben's unsent draft" } });
    await act(async () => { finish(success); });
    expect(screen.getByLabelText("Message Ben")).toHaveValue("Ben's unsent draft");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open conversation with Amber" }));
    expect(screen.getByLabelText("Message Amber")).toHaveValue(success ? "" : "  Hello Amber  ");
    if (!success) expect(screen.getByRole("alert")).toHaveTextContent("Message could not be sent.");
  });

  it("preserves edits to the same conversation made while sending", async () => {
    let finish!: (value: boolean) => void;
    setup(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.change(screen.getByLabelText("Message Amber"), { target: { value: "My next message" } });
    await act(async () => { finish(true); });
    expect(screen.getByLabelText("Message Amber")).toHaveValue("My next message");
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
  });
});

describe("MessengerTemplate shared dubs", () => {
  it("reserves the playback column and shrinks the waveform between timestamps", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8")
      + readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    document.head.append(style);
    try {
      const findRule = (selector: string) => {
        const rule = Array.from(style.sheet?.cssRules ?? []).find(
          (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === selector,
        ) as CSSStyleRule;
        return rule.style;
      };
      const player = ".shared-dub__player.audio-player--inline";
      expect(findRule(player).getPropertyValue("grid-template-columns")).toBe("2rem minmax(0, 1fr)");
      expect(findRule(".audio-player--inline .transport-controls").getPropertyValue("width")).toBe("2rem");
      const timeline = findRule(".audio-player--inline .audio-player__timeline");
      expect(timeline.getPropertyValue("display")).toBe("grid");
      expect(timeline.getPropertyValue("grid-column")).toBe("2");
      expect(timeline.getPropertyValue("grid-template-columns")).toBe("auto minmax(0, 1fr) auto");
    } finally {
      style.remove();
    }
  });

  it("aligns desktop headers with shared spacing and directional shadows", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(resolve("src", "templates", "MessengerTemplate", "MessengerTemplate.css"), "utf8");
    document.head.append(style);
    try {
      const desktop = Array.from(style.sheet?.cssRules ?? []).find(
        (rule) => rule instanceof CSSMediaRule && rule.conditionText === "(min-width: 761px)",
      ) as CSSMediaRule;
      const findRule = (selector: string) => {
        const rule = Array.from(desktop.cssRules).find(
          (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText.replace(/\s+/g, " ") === selector,
        ) as CSSStyleRule;
        return rule.style;
      };
      const headers = findRule(".messenger__sidebar-head, .chat-panel__header");
      expect(headers.getPropertyValue("height")).toBe("4.5rem");
      expect(headers.getPropertyValue("box-sizing")).toBe("border-box");
      expect(headers.getPropertyValue("box-shadow")).toBe("var(--shadow-edge-bottom)");
      expect(headers.getPropertyValue("margin")).toBe("0");
      expect(headers.getPropertyValue("padding")).toBe("0.75rem 1.125rem");
      expect(headers.getPropertyValue("border-bottom")).toBe("0");
      const conversationHeader = findRule(".chat-panel__header");
      expect(conversationHeader.getPropertyValue("padding")).toBe("0.25rem 0.75rem 0.5rem");
      expect(conversationHeader.getPropertyValue("height")).toBe("auto");
      expect(conversationHeader.getPropertyValue("min-height")).toBe("3.5rem");
      expect(findRule(".messenger__sidebar").getPropertyValue("padding")).toBe("0");
      expect(findRule(".messenger__conversation-list").getPropertyValue("padding")).toBe("0.75rem");
      expect(findRule(".messenger__conversation-list").getPropertyValue("gap")).toBe("0.5rem");
      expect(findRule(".conversation-link").getPropertyValue("background")).toBe("var(--surface-canvas)");
      expect(findRule(".conversation-link").getPropertyValue("box-shadow")).toBe("inset 0 0 0 1px var(--border-default), var(--shadow-input)");
      expect(findRule(".conversation-link.is-selected").getPropertyValue("box-shadow")).toBe("inset 0 0 0 1px var(--audio-active), var(--shadow-input)");
      expect(findRule(".chat-panel__header .conversation-link__profile").getPropertyValue("text-overflow")).toBe("ellipsis");
    } finally {
      style.remove();
    }
  });

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
      ? screen.getByRole("dialog", { name: "Share dubs and packs" })
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
    const dialog = screen.getByRole("dialog", { name: "Share dubs and packs" });
    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search My Dubs to share" }), { target: { value: "jungle" } });
    act(() => { mobile = false; listener?.(); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "My Dubs available to share" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search My Dubs to share" })).toHaveValue("jungle");
    act(() => { mobile = true; listener?.(); });
    const reopened = screen.getByRole("dialog", { name: "Share dubs and packs" });
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
    const start = vi.fn();
    const send = vi.fn(async () => true);
    const buddies = [
      { id: "friend", username: "amber", displayName: "Amber", presence: "online" as const, genre: "Jungle", role: "DJ", bio: "", groups: [] },
      { id: "other", username: "ben", displayName: "Ben", presence: "offline" as const, genre: "Jungle", role: "DJ", bio: "", groups: [], unread: 2 },
    ];
    const props = {
      buddies, conversations: [], dubs: [], initialBuddyId: "", chatConnectionStatus: "connected" as const,
      nowPlayingId: null, isPlaying: false, onOpenProfile: vi.fn(), onPlay: vi.fn(),
      onStartConversation: start, onSelectConversation: select, onLoadOlderMessages: vi.fn(async () => null), onSendMessage: send,
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
    expect(screen.queryByRole("button", { name: /Back/ })).not.toBeInTheDocument();
    rerender(<MessengerTemplate {...props} navigationKey={1} />);
    expect(messenger).not.toHaveClass("messenger--thread-open");
    fireEvent.click(screen.getByRole("button", { name: "Open conversation with Ben" }));
    expect(screen.getByLabelText("Message Ben")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Message Ben"), { target: { value: "Hello Ben" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(send).toHaveBeenCalledWith("other", "Hello Ben"));
    await waitFor(() => expect(screen.getByLabelText("Message Ben")).toHaveValue(""));
    rerender(<MessengerTemplate {...props} navigationKey={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Open conversation with Amber" }));
    expect(screen.getByLabelText("Message Amber")).toHaveValue("Amber draft");
    rerender(<MessengerTemplate {...props} initialBuddyId="other" navigationKey={3} />);
    expect(messenger).toHaveClass("messenger--thread-open");
    expect(screen.getByLabelText("Message Ben")).toBeInTheDocument();
    rerender(<MessengerTemplate {...props} navigationKey={4} />);
    expect(messenger).not.toHaveClass("messenger--thread-open");
    rerender(<MessengerTemplate {...props} initialBuddyId="other" navigationKey={5} />);
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
