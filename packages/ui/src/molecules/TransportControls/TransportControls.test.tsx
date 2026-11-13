import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RepeatSolid as Repeat } from "@craft/icons";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransportControls } from "./TransportControls";

afterEach(cleanup);

describe("TransportControls", () => {
  it("renders only play/pause in minimal mode and preserves full controls by default", () => {
    const change = vi.fn();
    const { rerender } = render(<TransportControls variant="minimal" onPlayChange={change} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(change).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();
    rerender(<TransportControls />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("keeps the play button icon as its only flex item", () => {
    render(<TransportControls />);

    const playButton = screen.getByRole("button", { name: "Play" });
    expect(playButton.children).toHaveLength(1);
    expect(playButton.firstElementChild).toHaveClass("button__icon");
    expect(playButton.querySelector("g")).toHaveAttribute("fill", "currentColor");
  });

  it("uses the repeat icon and toggles the repeat state", () => {
    const onRepeatChange = vi.fn();
    render(<TransportControls onRepeatChange={onRepeatChange} />);
    const repeatButton = screen.getByRole("button", { name: "Enable repeat" });
    const reference = render(<Repeat />);
    expect(repeatButton.querySelector("path")?.getAttribute("d"))
      .toBe(reference.container.querySelector("path")?.getAttribute("d"));
    expect(repeatButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(repeatButton);
    expect(onRepeatChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Disable repeat" })).toHaveAttribute("aria-pressed", "true");
  });
});
