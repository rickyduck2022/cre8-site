import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ShareDubDialog, canShareDub, canShareDubExternally } from "./ShareDubDialog";
import type { Buddy, Dub } from "../../types/domain";

const dub: Dub = {
  id: "dub-1", title: "Night Drive", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00Z", bpm: 174,
  genre: "Jungle", duration: "03:30", likes: 0, downloads: 0, artwork: "whitelabel",
  message: "", distribution: "private",
};
const buddies: Buddy[] = [
  { id: "friend-1", username: "meladee", displayName: "Meladee", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] },
  { id: "friend-2", username: "holik", displayName: "Holik", presence: "offline", genre: "Jungle", role: "DJ", bio: "", groups: [] },
];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

describe("ShareDubDialog", () => {
  it("lets the uploader save a preview length for all links and guards duplicate saves and dismissal", async () => {
    let finish!: () => void;
    const update = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const close = vi.fn();
    render(<ShareDubDialog dub={{ ...dub, distribution: "worldwide", previewSeconds: 30 }} buddies={[]}
      externalShareUrl="https://cre8.example/#share?dub=dub-1" onUpdatePreview={update}
      onClose={close} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "External link" }));
    expect(screen.getByLabelText("Logged-out preview length")).toHaveValue("30");
    expect(screen.getByRole("button", { name: "Save preview length" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Logged-out preview length"), { target: { value: "60" } });
    expect(screen.getByRole("button", { name: "Copy link" })).toBeDisabled();
    const save = screen.getByRole("button", { name: "Save preview length" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(60);
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByLabelText("Logged-out preview length")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Find friends", hidden: true })).toBeDisabled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(close).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(await screen.findByText("Preview length saved for all external links.")).toHaveAttribute("role", "status");
    expect(screen.getByText(/hear a 60-second preview/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save preview length" })).toBeDisabled();
  });

  it("retains the selected preview after failure, keeps the old public setting, and allows retry", async () => {
    const update = vi.fn().mockRejectedValueOnce(new Error("Could not save setting")).mockResolvedValueOnce(undefined);
    render(<ShareDubDialog dub={{ ...dub, distribution: "worldwide", previewSeconds: 30 }} buddies={[]}
      externalShareUrl="https://cre8.example/#share?dub=dub-1" onUpdatePreview={update}
      onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "External link" }));
    fireEvent.change(screen.getByLabelText("Logged-out preview length"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Save preview length" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save setting");
    expect(screen.getByLabelText("Logged-out preview length")).toHaveValue("90");
    expect(screen.getByText(/hear a 30-second preview/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save preview length" }));
    await screen.findByText("Preview length saved for all external links.");
    expect(update).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/hear a 90-second preview/)).toBeVisible();
  });

  it("copies public links without requiring friends, and allows manual copying after failure", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("Clipboard permission denied")).mockResolvedValueOnce(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    try {
      render(<ShareDubDialog dub={{ ...dub, distribution: "worldwide" }} buddies={[]}
        externalShareUrl="https://cre8.example/#share?dub=dub-1"
        onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={vi.fn()} />);
      fireEvent.click(screen.getByRole("tab", { name: "External link" }));
      expect(screen.getByLabelText("External share link")).toHaveValue("https://cre8.example/#share?dub=dub-1");
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't copy the link. Select it above and copy it manually.");
      expect(screen.getByLabelText("External share link")).toHaveAttribute("readonly");
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
      expect(await screen.findByText("Link copied.")).toHaveAttribute("role", "status");
      expect(writeText).toHaveBeenLastCalledWith("https://cre8.example/#share?dub=dub-1");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    ["worldwide", false, true], ["alist", true, true], ["alist", false, false], ["private", true, false],
  ] as const)("keeps external eligibility separate from friend sharing for %s/%s", (distribution, aListPublic, eligible) => {
    expect(canShareDubExternally({ ...dub, distribution, aListPublic })).toBe(eligible);
    render(<ShareDubDialog dub={{ ...dub, distribution, aListPublic }} buddies={buddies}
      externalShareUrl="https://cre8.example/#share?dub=dub-1"
      onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "External link" }));
    expect(Boolean(screen.queryByRole("button", { name: "Copy link" }))).toBe(eligible);
    expect(Boolean(screen.queryByLabelText("External share link"))).toBe(eligible);
    expect(screen.queryByLabelText("Logged-out preview length")).not.toBeInTheDocument();
    if (!eligible) expect(screen.getByText(/This dub stays protected/)).toBeVisible();
  });

  it.each(["desktop", "mobile"] as const)("makes friend sharing primary and external sharing discoverable on %s", (device) => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: device === "mobile", addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    try {
      render(<ShareDubDialog dub={{ ...dub, distribution: "worldwide" }} buddies={buddies}
        externalShareUrl="https://cre8.example/#share?dub=dub-1"
        onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={vi.fn()} />);
      expect(screen.getByRole("dialog", { name: "Share Night Drive" })).toBeVisible();
      expect(screen.getByRole("tablist", { name: "Sharing options" })).toBeVisible();
      expect(screen.getByRole("tab", { name: "Friends" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "External link" })).toHaveAttribute("aria-selected", "false");
      expect(screen.getByRole("tabpanel", { name: "Friends" })).toBeVisible();
      expect(screen.queryByRole("tabpanel", { name: "External link" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("tab", { name: "External link" }));
      expect(screen.getByRole("tabpanel", { name: "External link" })).toBeVisible();
      expect(screen.getByLabelText("External share link")).toBeVisible();
      fireEvent.click(screen.getByRole("tab", { name: "Friends" }));
      expect(screen.getByRole("tabpanel", { name: "Friends" })).toBeVisible();
      expect(screen.getByRole("searchbox", { name: "Search friends" })).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("prevents dismissing or navigating away while sending and retains the message after failure", async () => {
    let finish!: (value: boolean) => void;
    const send = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const close = vi.fn();
    const profile = vi.fn();
    const { container } = render(<ShareDubDialog
      dub={dub} buddies={buddies} onClose={close} onFindFriends={vi.fn()}
      onOpenChat={vi.fn()} onOpenProfile={profile} onPlay={vi.fn()} onSendMessage={send}
    />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Meladee/ }));
    fireEvent.change(screen.getByLabelText(/Add a message/), { target: { value: "Keep this message" } });
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(send).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    const dialog = screen.getByRole("dialog");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog);
    expect(close).not.toHaveBeenCalled();
    expect(container.querySelector(".now-playing__artist-button")).not.toBeInTheDocument();
    await act(async () => { finish(false); });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not send to Meladee");
    expect(screen.getByLabelText(/Add a message/)).toHaveValue("Keep this message");
    expect(screen.getByRole("checkbox", { name: /Meladee/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
  });

  it("keeps successful recipients sent when another send rejects and retries only the failure", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const send = vi.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(true);
      render(<ShareDubDialog dub={dub} buddies={buddies} initialBuddyIds={["friend-1", "friend-2"]}
        onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={send} />);
      fireEvent.click(screen.getByRole("button", { name: "Send dub" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Could not send to Holik");
      expect(screen.getByText("Already sent to Meladee.")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Retry selected" }));
      await screen.findByText("Sent to Meladee, Holik");
      expect(send.mock.calls.map((call) => call[0])).toEqual(["friend-1", "friend-2", "friend-2"]);
    } finally {
      warning.mockRestore();
    }
  });

  it("uses the shared playback state and routes play, seek, and profile actions for the selected dub", () => {
    const play = vi.fn();
    const seek = vi.fn();
    const profile = vi.fn();
    const props = { dub, buddies, onClose: vi.fn(), onFindFriends: vi.fn(), onOpenChat: vi.fn(), onSendMessage: vi.fn(), onPlay: play, onSeekProgress: seek, onOpenProfile: profile };
    const { rerender } = render(<ShareDubDialog {...props} isPlaying currentTimeSeconds={45} durationSeconds={210} />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).toHaveClass("audio-player--inline", "audio-player--private");
    expect(player).not.toHaveClass("audio-player--playable");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(play).toHaveBeenCalledWith(dub);
    const waveform = screen.getByRole("slider", { name: "Night Drive playback progress" });
    vi.spyOn(waveform, "getBoundingClientRect").mockReturnValue({ left: 0, width: 100 } as DOMRect);
    fireEvent.click(waveform, { clientX: 50 });
    expect(seek).toHaveBeenCalledWith(0.5, dub);
    fireEvent.click(player.querySelector(".now-playing__artist-button")!);
    expect(profile).toHaveBeenCalledWith("amber");
    rerender(<ShareDubDialog {...props} isCurrentTrack isPlaying currentTimeSeconds={45} durationSeconds={210} />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(player).toHaveTextContent("00:45");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("shares restricted A-List dubs with non-friends and preserves stable recipients after a snapshot changes", async () => {
    const send = vi.fn(async () => true);
    const member = { ...buddies[1], id: "member:user-2", aListApproved: true };
    const props = { dub: { ...dub, distribution: "alist" as const }, buddies: [member], onClose: vi.fn(), onFindFriends: vi.fn(), onOpenChat: vi.fn(), onPlay: vi.fn(), onSendMessage: send };
    const { rerender } = render(<ShareDubDialog {...props} />);
    expect(screen.getByText(/non-friend adds them/)).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: /Holik/ }));
    rerender(<ShareDubDialog {...props} buddies={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Send dub" }));
    await screen.findByText("Sent to Holik");
    expect(send).toHaveBeenCalledWith("member:user-2", "Shared a dub: Night Drive", "dub-1");
  });
  it("requires an explicit share again for friends already sent this version", async () => {
    const send = vi.fn(async (_buddyId: string, _text: string, _dubId: string) => true);
    render(<ShareDubDialog dub={{ ...dub, sharedBuddyIds: ["friend-1"] }} buddies={buddies} onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={send} />);
    expect(screen.getByRole("checkbox", { name: /Meladee/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Holik/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Share again with Meladee" }));
    expect(screen.getByRole("checkbox", { name: /Meladee/ })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /Holik/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send dub" }));
    await screen.findByText("Sent to Meladee, Holik");
    expect(send.mock.calls.map((call) => call[0])).toEqual(["friend-1", "friend-2"]);
  });

  it("finds a friend, sends a note and opens the conversation after confirmation", async () => {
    const send = vi.fn(async () => true);
    const openChat = vi.fn();
    render(<ShareDubDialog dub={dub} buddies={buddies} onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={openChat} onPlay={vi.fn()} onSendMessage={send} />);
    expect(screen.getByText(/Unsend does not revoke/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Send dub" })).toBeDisabled();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search friends" }), { target: { value: "HOLIK" } });
    expect(screen.queryByText("Meladee")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Holik/ }));
    fireEvent.change(screen.getByLabelText(/Add a message/), { target: { value: "Have a listen" } });
    fireEvent.click(screen.getByRole("button", { name: "Send dub" }));
    await screen.findByText("Sent to Holik");
    expect(send).toHaveBeenCalledWith("friend-2", "Have a listen", "dub-1");
    fireEvent.click(screen.getByRole("button", { name: "Open conversation" }));
    expect(openChat).toHaveBeenCalledWith("friend-2");
  });

  it("keeps the selection on failure and permits a retry without duplicate sends", async () => {
    let resolveSend: (value: boolean) => void = () => undefined;
    const send = vi.fn()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => { resolveSend = resolve; }))
      .mockResolvedValueOnce(true);
    render(<ShareDubDialog dub={dub} buddies={buddies} onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={send} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Meladee/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send dub" }));
    expect(screen.getByRole("button", { name: "Send dub" })).toBeDisabled();
    expect(send).toHaveBeenCalledTimes(1);
    resolveSend(false);
    await screen.findByRole("alert");
    expect(screen.getByRole("checkbox", { name: /Meladee/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Retry selected" }));
    await waitFor(() => expect(screen.getByText("Sent to Meladee")).toBeVisible());
    expect(send).toHaveBeenLastCalledWith("friend-1", "Shared a dub: Night Drive", "dub-1");
  });

  it("sends to multiple friends and retries only failed recipients", async () => {
    const send = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<ShareDubDialog dub={dub} buddies={buddies} onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={send} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Meladee/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search friends" }), { target: { value: "holik" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Holik/ }));
    expect(screen.getByText("2 friends selected")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Send dub" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not send to Holik");
    expect(screen.getByText("Already sent to Meladee.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry selected" }));
    await screen.findByText("Sent to Meladee, Holik");
    expect(send.mock.calls.map((call) => call[0])).toEqual(["friend-1", "friend-2", "friend-2"]);
  });

  it("allows retrying failed upload deliveries without resending successful ones", async () => {
    const send = vi.fn(async () => true);
    render(<ShareDubDialog dub={{ ...dub, sharedBuddyIds: ["friend-1", "friend-2"] }} buddies={buddies} initialBuddyIds={["friend-2"]} initiallySentIds={["friend-1"]} initialFailure onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={send} />);
    expect(screen.getByRole("checkbox", { name: /Meladee/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Holik/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Retry selected" }));
    await screen.findByText("Sent to Meladee, Holik");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("friend-2", "Shared a dub: Night Drive", "dub-1");
  });

  it("does not report all deliveries complete when a failed friend is deselected", async () => {
    const send = vi.fn(async () => true);
    render(<ShareDubDialog dub={dub} buddies={buddies} initialBuddyIds={["friend-2"]} initialFailure onClose={vi.fn()} onFindFriends={vi.fn()} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={send} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Holik/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Meladee/ }));
    fireEvent.click(screen.getByRole("button", { name: "Retry selected" }));
    await screen.findByText("Already sent to Meladee.");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not send to Holik");
    expect(screen.getByRole("checkbox", { name: /Holik/ })).toBeChecked();
    expect(screen.queryByText("Sent to Meladee")).not.toBeInTheDocument();
  });

  it("offers a route to find friends and restricts private forwarding", () => {
    const findFriends = vi.fn();
    render(<ShareDubDialog dub={dub} buddies={[]} onClose={vi.fn()} onFindFriends={findFriends} onOpenChat={vi.fn()} onPlay={vi.fn()} onSendMessage={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Find friends" }));
    expect(findFriends).toHaveBeenCalled();
    expect(canShareDub(dub, "amber")).toBe(true);
    expect(canShareDub(dub, "meladee")).toBe(false);
    expect(canShareDub({ ...dub, distribution: "worldwide" }, "meladee")).toBe(true);
    expect(canShareDub({ ...dub, distribution: "alist" }, "meladee")).toBe(true);
  });
});
