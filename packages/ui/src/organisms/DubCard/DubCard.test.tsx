import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Dub } from "../../types/domain";
import { DubCard } from "./DubCard";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const dub: Dub = {
  id: "dub-1", title: "Night Drive", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z",
  bpm: 174, genre: "Jungle", duration: "03:30", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "Fresh dub",
};

describe("DubCard actions", () => {
  it("offers a streamlined playlist variant with shared artwork, seeking and downloads", () => {
    const onPlay = vi.fn();
    const onSeekProgress = vi.fn();
    const onDownload = vi.fn();
    render(<DubCard dub={dub} variant="playlist" trackNumber={2} musicalKey="F minor"
      isCurrentTrack isPlaying currentTimeSeconds={30} durationSeconds={120}
      onPlay={onPlay} onSeekProgress={onSeekProgress} onDownload={onDownload} />);
    const card = screen.getByRole("article", { name: dub.title });
    expect(card).toHaveClass("dub-card--playlist", "dub-card--current");
    expect(within(card).getByLabelText("Track 2")).toHaveTextContent("2");
    expect(within(card).getByRole("img", { name: "Night Drive artwork" })).toBeVisible();
    expect(within(card).getByText("174 BPM")).toBeVisible();
    expect(within(card).getByText("F minor")).toBeVisible();
    expect(within(card).queryByText("Fresh dub")).not.toBeInTheDocument();
    expect(within(card).queryByText("@amber")).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Enable shuffle" })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Pause" }));
    expect(onPlay).toHaveBeenCalledWith(dub);
    const waveform = within(card).getByRole("slider", { name: "Night Drive playback progress" });
    expect(waveform).toHaveAttribute("aria-valuenow", "25");
    fireEvent.keyDown(waveform, { key: "End" });
    expect(onSeekProgress).toHaveBeenCalledWith(1, dub);
    fireEvent.click(within(card).getByRole("button", { name: "Download · Like" }));
    expect(onDownload).toHaveBeenCalledWith(dub);
  });

  it("disables draft playlist playback including waveform seeking and downloads", () => {
    const onSeek = vi.fn();
    const onSeekProgress = vi.fn();
    render(<DubCard dub={dub} variant="playlist" playbackDisabled downloadDisabled
      onPlay={vi.fn()} onDownload={vi.fn()} onSeek={onSeek} onSeekProgress={onSeekProgress} />);
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download · Like" })).toBeDisabled();
    expect(screen.queryByRole("slider", { name: "Night Drive playback progress" })).not.toBeInTheDocument();
    const waveform = screen.getByRole("img", { name: "Night Drive playback progress" });
    fireEvent.keyDown(waveform, { key: "End" });
    expect(onSeek).not.toHaveBeenCalled();
    expect(onSeekProgress).not.toHaveBeenCalled();
  });

  it("keeps playlist download available and labelled at mobile widths", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const onDownload = vi.fn();
    render(<DubCard dub={dub} variant="playlist" onPlay={vi.fn()} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole("button", { name: "Download and like" }));
    expect(onDownload).toHaveBeenCalledWith(dub);
  });

  it("uses equal player padding on all sides at mobile widths", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(resolve("src", "organisms", "DubCard", "DubCard.css"), "utf8");
    document.head.append(style);
    try {
      const base = Array.from(style.sheet?.cssRules ?? []).find(
        (rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-card .organism-card.audio-player",
      ) as CSSStyleRule;
      const mobile = Array.from(style.sheet?.cssRules ?? []).find(
        (rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px)",
      ) as CSSMediaRule;
      const player = Array.from(mobile.cssRules).find(
        (rule) => rule instanceof CSSStyleRule && rule.selectorText === ".dub-card .organism-card.audio-player",
      ) as CSSStyleRule;
      expect(base.style.getPropertyValue("padding-left")).toBe("0.75rem");
      expect(base.style.getPropertyValue("padding-right")).toBe("0.75rem");
      expect(player.style.getPropertyValue("padding-top")).toBe("0.75rem");
      expect(player.style.getPropertyValue("padding-bottom")).toBe("0.75rem");
    } finally {
      style.remove();
    }
  });

  it("places owner actions beneath the upload time and opens a mobile dialog", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { container } = render(<DubCard dub={dub} manageable onDownload={vi.fn()} onPlay={vi.fn()} onEdit={onEdit} onDelete={onDelete} />);
    const trigger = screen.getByRole("button", { name: "Actions for Night Drive" });
    const end = container.querySelector(".dub-card__topline-end")!;
    expect(end).toContainElement(trigger);
    expect(end.firstElementChild).toHaveClass("dub-card__uploaded");
    expect(container.querySelector(".dub-card__footer")).not.toContainElement(trigger);
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Actions for Night Drive" });
    expect(dialog).toHaveClass("modal", "dub-actions-menu__dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Edit Night Drive" }));
    expect(onEdit).toHaveBeenCalledWith(dub);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Night Drive" }));
    expect(onDelete).toHaveBeenCalledWith(dub);
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("does not show owner actions on mobile for unmanageable dubs", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    render(<DubCard dub={dub} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Actions for Night Drive" })).not.toBeInTheDocument();
  });

  it("shows a compact mobile download label and broad sharing action", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const onDownload = vi.fn();
    const onShareWithFriend = vi.fn();
    const { container, rerender } = render(<DubCard dub={dub} onDownload={onDownload} onPlay={vi.fn()} onShareWithFriend={onShareWithFriend} />);
    const tag = screen.getByLabelText("Distribution: Worldwide");
    const actions = container.querySelector(".dub-card__mobile-actions");
    const download = screen.getByRole("button", { name: "Download and like" });
    const share = screen.getByRole("button", { name: "Share Night Drive" });
    expect(tag.closest(".dub-card__metadata")).not.toContainElement(download);
    expect(actions).toContainElement(download);
    expect(actions).toContainElement(share);
    expect(download).toHaveTextContent("Download · Like");
    expect(download).toHaveAttribute("aria-label", "Download and like");
    expect(share).not.toHaveTextContent("Share");
    expect(container.querySelector(".dub-card__footer")).toContainElement(download);
    const details = container.querySelector(".dub-card__mobile-details")!;
    const timestamp = details.querySelector("time")!;
    expect(details.firstElementChild).toHaveClass("dub-card__likes");
    expect(details.lastElementChild).toBe(timestamp);
    expect(timestamp).toHaveAttribute("datetime", dub.uploadedAt);
    expect(timestamp).toHaveTextContent(new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(dub.uploadedAt)));
    expect(timestamp).not.toHaveTextContent("Uploaded:");
    expect(container.querySelector(".dub-card__download-count")).not.toBeInTheDocument();
    fireEvent.click(download);
    fireEvent.click(share);
    expect(onDownload).toHaveBeenCalledWith(dub);
    expect(onShareWithFriend).toHaveBeenCalledWith(dub);
    rerender(<DubCard dub={dub} hasLiked onDownload={onDownload} onPlay={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Download again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share Night Drive" })).not.toBeInTheDocument();
  });

  it("opens the uploader profile from their avatar and artist name", () => {
    const onOpenProfile = vi.fn();
    render(<DubCard dub={dub} onDownload={vi.fn()} onPlay={vi.fn()} onOpenProfile={onOpenProfile} />);
    fireEvent.click(screen.getByRole("button", { name: "View Amber's profile" }));
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).not.toHaveClass("audio-player--playable");
    fireEvent.click(player.querySelector(".now-playing__artist-button")!);
    expect(onOpenProfile).toHaveBeenCalledTimes(2);
    expect(onOpenProfile).toHaveBeenCalledWith("amber");
  });

  it("marks the current dub whether playing or paused", () => {
    const { rerender } = render(<DubCard dub={dub} isPlaying={false} onDownload={vi.fn()} onPlay={vi.fn()} />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).not.toHaveClass("dub-card__player--current");
    expect(screen.getByRole("button", { name: "Play" })).not.toHaveClass("is-playing");
    rerender(<DubCard dub={dub} isCurrentTrack isPlaying onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(player).toHaveClass("dub-card__player--current");
    expect(player).toHaveTextContent("Now playing");
    expect(screen.getByRole("button", { name: "Pause" })).toHaveClass("is-playing");
    rerender(<DubCard dub={dub} isCurrentTrack isPlaying={false} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(player).toHaveClass("dub-card__player--current");
    expect(player).toHaveTextContent("Paused");
    expect(screen.getByRole("button", { name: "Play" })).not.toHaveClass("is-playing");
    rerender(<DubCard dub={dub} isPlaying={false} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(player).not.toHaveClass("dub-card__player--current");
  });
  it("marks A-List distribution and badges approval independently", () => {
    const { rerender, container } = render(<DubCard dub={{ ...dub, distribution: "alist" }} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(container.querySelector("article")).toHaveClass("dub-card--alist");
    expect(screen.queryByRole("img", { name: "A-List approved" })).not.toBeInTheDocument();

    rerender(<DubCard dub={{ ...dub, distribution: "worldwide", artistAListApproved: true, uploaderAListApproved: true }} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(container.querySelector("article")).not.toHaveClass("dub-card--alist");
    expect(screen.getAllByRole("img", { name: "A-List approved" })).toHaveLength(2);
    rerender(<DubCard dub={{ ...dub, distribution: "private", artistAListApproved: false, uploaderAListApproved: false }} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(screen.queryByRole("img", { name: "A-List approved" })).not.toBeInTheDocument();
  });

  it("retains distribution-specific classes for card details", () => {
    const { container, rerender } = render(<DubCard dub={{ ...dub, distribution: "private" }} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(container.querySelector("article")).toHaveClass("dub-card--private");
    expect(container.querySelector("article")).not.toHaveClass("dub-card--alist");
    rerender(<DubCard dub={{ ...dub, distribution: "worldwide" }} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(container.querySelector("article")).not.toHaveClass("dub-card--private");
    rerender(<DubCard dub={{ ...dub, distribution: "alist" }} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(container.querySelector("article")).toHaveClass("dub-card--alist");
    expect(container.querySelector("article")).not.toHaveClass("dub-card--private");
  });

  it.each(["worldwide", "private", "alist", undefined] as const)(
    "passes %s distribution to the embedded player",
    (distribution) => {
      render(<DubCard dub={{ ...dub, distribution }} onDownload={vi.fn()} onPlay={vi.fn()} />);
      expect(screen.getByRole("region", { name: "Audio player: Night Drive" }))
        .toHaveClass(`audio-player--${distribution ?? "worldwide"}`);
    },
  );

  it.each([
    ["worldwide", "Worldwide"],
    ["private", "Private"],
    ["alist", "A-List"],
    [undefined, "Worldwide"],
  ] as const)("shows %s distribution distinctly from track metadata", (distribution, label) => {
    render(<DubCard dub={{ ...dub, distribution, tags: ["Jungle", "Rollers"], audioFormat: "WAV" }} onDownload={vi.fn()} onPlay={vi.fn()} />);
    const tag = screen.getByLabelText(`Distribution: ${label}`);
    expect(tag).toHaveTextContent(label);
    expect(tag).toHaveClass("track-tag--accent", "dub-card__distribution");
    expect(tag).toHaveClass(`dub-card__distribution--${distribution ?? "worldwide"}`);
    const metadata = tag.closest(".dub-card__metadata")!;
    expect(metadata).toHaveClass("dub-card__metadata");
    expect(metadata.querySelector(".dub-card__metadata-tags")).toHaveTextContent("Jungle");
    expect(metadata.querySelector(".dub-card__metadata-tags")).toHaveTextContent("WAV");
    expect(tag.closest(".dub-card__metadata-tags")).toBeNull();
  });

  it("shows the uploader's profile picture and falls back to initials", () => {
    const { rerender } = render(<DubCard dub={{ ...dub, uploaderAvatarUrl: "/avatar.png?v=1" }} onDownload={vi.fn()} onPlay={vi.fn()} />);
    const avatar = screen.getByRole("img", { name: "Amber" });
    expect(avatar.querySelector("img")).toHaveAttribute("src", "/avatar.png?v=1");
    fireEvent.error(avatar.querySelector("img")!);
    expect(avatar).toHaveTextContent("A");
    rerender(<DubCard dub={{ ...dub, uploaderAvatarUrl: "/avatar.png?v=2" }} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(avatar.querySelector("img")).toHaveAttribute("src", "/avatar.png?v=2");
    rerender(<DubCard dub={dub} onDownload={vi.fn()} onPlay={vi.fn()} />);
    expect(avatar).toHaveTextContent("A");
  });

  it("seeks an inactive track and forwards transport controls", () => {
    const onSeek = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(<DubCard dub={dub} onDownload={vi.fn()} onPlay={vi.fn()} onSeek={onSeek} onNext={onNext} onPrevious={onPrevious} />);
    const waveform = screen.getByRole("slider", { name: "Night Drive playback progress" });
    vi.spyOn(waveform, "getBoundingClientRect").mockReturnValue({ left: 10, width: 200 } as DOMRect);
    fireEvent.click(waveform, { clientX: 110 });
    expect(onSeek).toHaveBeenCalledWith(105, dub);
    fireEvent.click(screen.getByRole("button", { name: "Next track" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous track" }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  it("offers a waveform seek when the track duration is unknown", () => {
    const onSeekProgress = vi.fn();
    render(<DubCard dub={{ ...dub, duration: "00:00" }} onDownload={vi.fn()} onPlay={vi.fn()} onSeekProgress={onSeekProgress} />);
    const waveform = screen.getByRole("slider", { name: "Night Drive playback progress" });
    vi.spyOn(waveform, "getBoundingClientRect").mockReturnValue({ left: 0, width: 200 } as DOMRect);
    fireEvent.click(waveform, { clientX: 50 });
    expect(onSeekProgress).toHaveBeenCalledWith(0.25, expect.objectContaining({ id: dub.id }));
    fireEvent.keyDown(waveform, { key: "End" });
    expect(onSeekProgress).toHaveBeenLastCalledWith(1, expect.objectContaining({ id: dub.id }));
  });

  it("toggles the actions and closes after invoking each callback", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<DubCard dub={dub} manageable onDownload={vi.fn()} onPlay={vi.fn()} onEdit={onEdit} onDelete={onDelete} />);
    const trigger = screen.getByRole("button", { name: "Actions for Night Drive" });

    expect(trigger.querySelector(".button__icon svg")).toBeInTheDocument();
    expect(trigger).toHaveClass("dub-actions-menu__trigger--icon-only");
    expect(trigger).not.toHaveTextContent("Actions");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Edit Night Drive" })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Edit Night Drive" }).querySelector(".button__icon svg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Night Drive" }).querySelector(".button__icon svg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Night Drive" }));
    expect(onEdit).toHaveBeenCalledWith(dub);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Delete Night Drive" }));
    expect(onDelete).toHaveBeenCalledWith(dub);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape, outside pointer interaction, and focus leaving", () => {
    render(<DubCard dub={dub} manageable onDownload={vi.fn()} onPlay={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Actions for Night Drive" });
    fireEvent.click(trigger);
    screen.getByRole("button", { name: "Edit Night Drive" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.blur(trigger, { relatedTarget: document.body });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("does not offer actions without ownership and both callbacks", () => {
    const { rerender } = render(<DubCard dub={dub} onDownload={vi.fn()} onPlay={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Actions for Night Drive" })).not.toBeInTheDocument();
    rerender(<DubCard dub={dub} manageable onDownload={vi.fn()} onPlay={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Actions for Night Drive" })).not.toBeInTheDocument();
  });
});
