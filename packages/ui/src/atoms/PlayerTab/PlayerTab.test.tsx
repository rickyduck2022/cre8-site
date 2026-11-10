import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlayerTab } from "./PlayerTab";

afterEach(cleanup);

it("preserves native button behavior, refs and accessibility", () => {
  const ref = createRef<HTMLButtonElement>();
  const click = vi.fn();
  render(<PlayerTab ref={ref} aria-label="Move player" aria-expanded={false} className="custom-tab" onClick={click} />);
  const tab = screen.getByRole("button", { name: "Move player" });
  expect(ref.current).toBe(tab);
  expect(tab).toHaveClass("button", "player-tab", "custom-tab", "button--small", "button--tertiary");
  expect(tab).toHaveAttribute("type", "button");
  expect(tab).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(tab);
  expect(click).toHaveBeenCalledOnce();
});

it("does not invoke actions when disabled", () => {
  const click = vi.fn();
  render(<PlayerTab disabled onClick={click}>Close</PlayerTab>);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(click).not.toHaveBeenCalled();
});
