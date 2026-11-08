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
