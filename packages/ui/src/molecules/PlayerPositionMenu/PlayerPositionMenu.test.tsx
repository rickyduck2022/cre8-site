import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlayerPositionMenu } from "./PlayerPositionMenu";

afterEach(cleanup);

it("shows position diagrams, selects a position and closes", () => {
  const onSelect = vi.fn();
  render(<PlayerPositionMenu positions={["header", "footer", "sidebar", "default", "floating", "left-edge", "right-edge"]} current="footer" onSelect={onSelect} />);
  const trigger = screen.getByRole("button", { name: "Choose player position" });
  expect(trigger).toHaveClass("player-tab");
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Footer" })).toHaveAttribute("aria-pressed", "true");
  for (const [label, position] of [["Header", "header"], ["Footer", "footer"], ["Left sidebar", "sidebar"], ["Default mini position", "default"], ["Pop out", "floating"], ["Left edge", "left-edge"], ["Right edge", "right-edge"]]) {
    const icon = screen.getByRole("button", { name: label }).querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon?.querySelector(`[data-position="${position}"]`)).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole("button", { name: "Left sidebar" }));
  expect(onSelect).toHaveBeenCalledWith("sidebar");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("group", { name: "Player positions" })).not.toBeInTheDocument();
});

it("adjusts transparency without closing or fading the menu", () => {
  const onChange = vi.fn();
  const { rerender, container } = render(<PlayerPositionMenu positions={["floating"]} onSelect={() => undefined} opacityControl={{ value: 100, onChange }} />);
  fireEvent.click(screen.getByRole("button", { name: "Choose player position" }));
  const slider = screen.getByRole("slider", { name: "Opacity" });
  expect(slider).toHaveAttribute("min", "30");
  expect(slider).toHaveAttribute("max", "100");
  expect(container).not.toContainElement(slider);
  fireEvent.change(slider, { target: { value: "35" } });
  expect(onChange).toHaveBeenCalledWith(35);
  rerender(<PlayerPositionMenu positions={["floating"]} onSelect={() => undefined} opacityControl={{ value: 35, onChange }} />);
  expect(slider).toHaveAttribute("aria-valuetext", "35% opacity");
  expect(screen.getByRole("group", { name: "Player positions" })).toBeInTheDocument();
});
