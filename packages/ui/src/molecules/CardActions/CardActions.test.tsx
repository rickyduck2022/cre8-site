import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Button } from "../../atoms/Button/Button";
import { CardActions } from "./CardActions";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let width = 290;
let resize: () => void;

it("supports a labelled separate action row with a token-based divider", () => {
  render(<CardActions title="Pack" label="Pack controls" layout="grid" separated>
    <Button>Open pack</Button><Button>Edit pack</Button>
  </CardActions>);
  expect(screen.getByRole("group", { name: "Pack controls" })).toHaveClass("card-actions--separated");
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "molecules", "CardActions", "CardActions.css"), "utf8");
  document.head.append(style);
  try {
    const rule = Array.from(style.sheet!.cssRules).find((rule): rule is CSSStyleRule =>
      rule instanceof CSSStyleRule && rule.selectorText === ".card-actions--separated");
    expect(rule?.style.getPropertyValue("border-top")).toBe("1px solid var(--border-default)");
    expect(rule?.style.getPropertyValue("padding-top")).toBe("var(--spacing-3)");
  } finally { style.remove(); }
});

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const measured = this.classList.contains("card-actions") ? width
      : this.getAttribute("aria-haspopup") === "dialog" ? 44 : 100;
    return { width: measured, height: 32, x: 0, y: 0, top: 0, bottom: 32, left: 0, right: measured, toJSON() {} };
  });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  width = 290;
});

it("moves only actions that do not fit into the mobile dialog and restores them on resize", () => {
  const share = vi.fn();
  render(<CardActions title="Night Sessions">
    <Button>Play all</Button><Button>Show 7 samples</Button><Button onClick={share}>Share pack</Button>
  </CardActions>);
  expect(screen.getByRole("button", { name: "Play all" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Show 7 samples" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Share pack" })).not.toBeInTheDocument();
  const trigger = screen.getByRole("button", { name: "More actions for Night Sessions" });
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "More actions for Night Sessions" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Share pack" }));
  expect(share).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  width = 400;
  act(() => resize());
  expect(screen.getByRole("button", { name: "Share pack" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "More actions for Night Sessions" })).not.toBeInTheDocument();
});

it("keeps all grid actions visible on mobile rather than moving them into overflow", () => {
  width = 80;
  const edit = vi.fn();
  render(<CardActions title="Grid release" layout="grid">
    <Button>Open pack</Button><Button onClick={edit}>Edit pack</Button><Button>Download ZIP</Button>
  </CardActions>);
  expect(screen.getByRole("button", { name: "Open pack" }).closest(".card-actions")).toHaveClass("card-actions--grid");
  expect(screen.getByRole("button", { name: "Download ZIP" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "More actions for Grid release" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit pack" }));
  expect(edit).toHaveBeenCalledOnce();
});

it("keeps every action reachable at narrow widths, including disabled actions and Escape dismissal", () => {
  width = 80;
  render(<CardActions title="Draft"><Button disabled>Download ZIP</Button><Button>Open pack</Button></CardActions>);
  const trigger = screen.getByRole("button", { name: "More actions for Draft" });
  fireEvent.click(trigger);
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Download ZIP" })).toBeDisabled();
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
});

it("does not collapse desktop actions", () => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  width = 80;
  render(<CardActions title="Pack"><Button>Download ZIP</Button><Button>Open pack</Button></CardActions>);
  expect(screen.getByRole("button", { name: "Download ZIP" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Open pack" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "More actions for Pack" })).not.toBeInTheDocument();
});

it("labels icon-only overflow actions visibly and keeps their callbacks", () => {
  width = 80;
  const share = vi.fn();
  render(<CardActions title="Pack"><Button aria-label="Share Pack" onClick={share}>{false}</Button></CardActions>);
  fireEvent.click(screen.getByRole("button", { name: "More actions for Pack" }));
  const action = within(screen.getByRole("dialog")).getByRole("button", { name: "Share Pack" });
  expect(action).toHaveTextContent("Share Pack");
  fireEvent.click(action);
  expect(share).toHaveBeenCalledOnce();
});
