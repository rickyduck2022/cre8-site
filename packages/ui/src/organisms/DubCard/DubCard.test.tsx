import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dub } from "../../templates/communityTypes";
import { DubCard } from "./DubCard";

afterEach(cleanup);

const dub: Dub = {
  id: "dub-1", title: "Night Drive", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z",
  bpm: 174, genre: "Jungle", duration: "03:30", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "Fresh dub",
};

describe("DubCard actions", () => {
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
    const metadata = tag.parentElement!;
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
