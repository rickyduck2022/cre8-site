import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FloatingWindow, WindowLayer } from "./Window";

beforeEach(() => {
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Windows({ titles = ["One", "Two", "Three"], onPlay = vi.fn() }: { titles?: string[]; onPlay?: () => void }) {
  const [windows, setWindows] = useState(titles);
  const [requests, setRequests] = useState<Record<string, number>>({});
  const activate = (title: string) => setWindows((current) => [...current.filter((entry) => entry !== title), title]);
  return <><div>{titles.map((title) => <button key={title} onClick={() => {
    activate(title);
    setRequests((current) => ({ ...current, [title]: (current[title] ?? 0) + 1 }));
  }}>Open {title}</button>)}</div>
    <WindowLayer>{[...windows].sort().map((title) => <FloatingWindow key={title} title={title}
      order={windows.indexOf(title)} active={title === windows.at(-1)} openRequest={requests[title] ?? 0}
      onActivate={() => activate(title)} onClose={() => setWindows((current) => current.filter((entry) => entry !== title))}>
      <input aria-label={`${title} state`} defaultValue={title} /><button onClick={onPlay}>Play {title}</button>
    </FloatingWindow>)}</WindowLayer></>;
}

function dialog(title: string) {
  return screen.getByRole("dialog", { name: title });
}
function dock(title: string, side: "left" | "right" | "floating" | "fullscreen") {
  const select = within(dialog(title)).getByRole("combobox");
  fireEvent.focus(select);
  fireEvent.change(select, { target: { value: side } });
}
function tab(title: string) {
  return screen.getByRole("tab", { name: title });
}

function dragInto(source: string, target: string, cancel = false) {
  const handle = within(dialog(source)).getByRole("button", { name: /^Move/ });
  const targetWindow = dialog(target);
  const bounds = { x: 120, y: 120, left: 120, top: 120, right: 620, bottom: 620, width: 500, height: 500, toJSON() {} };
  vi.spyOn(targetWindow, "getBoundingClientRect").mockReturnValue(bounds);
  const header = targetWindow.querySelector("header");
  if (!header) throw new Error("Missing window header");
  vi.spyOn(header, "getBoundingClientRect").mockReturnValue({ ...bounds, bottom: 170, height: 50 });
  handle.setPointerCapture = vi.fn();
  const pointer = (type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    fireEvent(handle, event);
  };
  pointer("pointerdown", 700, 300);
  pointer("pointermove", 180, 145);
  expect(document.querySelector(".snap-preview--active")).toHaveAttribute("aria-label", `Release to group with ${target}`);
  pointer(cancel ? "pointercancel" : "pointerup", 180, 145);
}

it("groups same-side windows into tabs while keeping separate docks and floating packs independent", () => {
  render(<Windows titles={["One", "Two", "Three", "Four", "Five"]} />);
  const one = dialog("One");
  fireEvent.change(within(one).getByLabelText("One state"), { target: { value: "Keep my playlist" } });
  dock("One", "left");
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  dock("Two", "left");
  expect(one).not.toHaveAttribute("open");
  expect(screen.getByRole("tablist", { name: "Left docked packs" })).toBeVisible();
  expect(tab("Two")).toHaveAttribute("aria-selected", "true");
  dock("Three", "right");
  dock("Four", "right");
  expect(screen.getAllByRole("tablist")).toHaveLength(2);
  expect(dialog("Five")).toHaveClass("floating-window--floating");
  fireEvent.click(tab("One"));
  expect(dialog("One")).toBe(one);
  expect(screen.queryByRole("dialog", { name: "Two" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("One state")).toHaveValue("Keep my playlist");
  const panel = screen.getByRole("tabpanel", { name: "One" });
  expect(tab("One")).toHaveAttribute("aria-controls", panel.id);
  expect(panel).toHaveAttribute("aria-labelledby", tab("One").id);
  expect(dialog("Four")).toHaveClass("floating-window--right");
});

it("supports roving tab focus, arrow wrapping, Home and End without playback or DOM replacement", () => {
  const play = vi.fn();
  render(<Windows onPlay={play} />);
  const one = dialog("One");
  const two = dialog("Two");
  dock("One", "left"); dock("Two", "left"); dock("Three", "left");
  expect(tab("Three")).toHaveAttribute("tabindex", "0");
  expect(tab("One")).toHaveAttribute("tabindex", "-1");
  const order = screen.getAllByRole("tab").map((entry) => entry.textContent);
  fireEvent.keyDown(tab("Three"), { key: "End" });
  expect(tab("Two")).toHaveFocus();
  fireEvent.keyDown(tab("Two"), { key: "ArrowRight" });
  expect(tab("One")).toHaveFocus();
  expect(dialog("One")).toBe(one);
  fireEvent.keyDown(tab("One"), { key: "ArrowLeft" });
  expect(tab("Two")).toHaveFocus();
  fireEvent.keyDown(tab("Two"), { key: "Home" });
  expect(tab("One")).toHaveFocus();
  fireEvent.keyDown(tab("One"), { key: "End" });
  expect(tab("Two")).toHaveFocus();
  fireEvent.click(tab("Two"));
  expect(tab("Two")).toHaveFocus();
  expect(dialog("Two")).toBe(two);
  expect(screen.getAllByRole("tab").map((entry) => entry.textContent)).toEqual(order);
  expect(play).not.toHaveBeenCalled();
});

it("removes only the selected pack when undocking, maximizing, minimizing or closing and restores its tab on reopen", () => {
  render(<Windows />);
  dock("One", "left"); dock("Two", "left");
  fireEvent.click(screen.getByRole("button", { name: "Minimize Two" }));
  expect(dialog("One")).toHaveClass("floating-window--left");
  expect(dialog("Two")).toHaveClass("floating-window--minimized");
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  expect(tab("Two")).toHaveAttribute("aria-selected", "true");
  dock("Two", "fullscreen");
  expect(dialog("One")).toHaveClass("floating-window--left");
  expect(dialog("Two")).toHaveClass("floating-window--fullscreen", "floating-window--active");
  expect(dialog("One")).not.toHaveClass("floating-window--active");
  dock("Two", "left");
  fireEvent.keyDown(screen.getByRole("button", { name: /^Move Two/ }), { key: "ArrowRight" });
  expect(dialog("Two")).toHaveClass("floating-window--floating", "floating-window--active");
  expect(dialog("One")).not.toHaveClass("floating-window--active");
  expect(dialog("One")).toHaveClass("floating-window--left");
  dock("Two", "left");
  fireEvent.click(screen.getByRole("button", { name: "Close Two" }));
  expect(screen.queryByRole("dialog", { name: "Two" })).not.toBeInTheDocument();
  expect(dialog("One")).toHaveClass("floating-window--left");
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
});

it("shares resized width within a dock but not across sides and resets the whole region with Home", () => {
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 8, y: 8, left: 8, top: 8, width: 480, height: 884, right: 488, bottom: 892, toJSON() {},
  });
  render(<Windows />);
  dock("One", "left"); dock("Two", "left"); dock("Three", "right");
  fireEvent.keyDown(screen.getByRole("button", { name: /^Resize Two/ }), { key: "ArrowRight" });
  expect(dialog("Two").style.width).toBe("496px");
  fireEvent.click(tab("One"));
  expect(dialog("One").style.width).toBe("496px");
  expect(dialog("Three").style.width).toBe("");
  fireEvent.keyDown(screen.getByRole("button", { name: /^Resize One/ }), { key: "Home" });
  expect(dialog("One").style.width).toBe("");
  fireEvent.click(tab("Two"));
  expect(dialog("Two").style.width).toBe("");
});

it("uses the active mobile modal and restores dock grouping and playlist state on desktop", () => {
  let mobile = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({ get matches() { return mobile; },
    addEventListener: (_: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_: string, callback: () => void) => listeners.delete(callback) }));
  render(<Windows />);
  dock("One", "right"); dock("Two", "right");
  fireEvent.change(screen.getByLabelText("Two state"), { target: { value: "Retained" } });
  act(() => { mobile = true; listeners.forEach((listener) => listener()); });
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(dialog("Two")).toHaveAttribute("aria-modal", "true");
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  act(() => { mobile = false; listeners.forEach((listener) => listener()); });
  expect(dialog("Two")).not.toHaveAttribute("aria-modal");
  expect(screen.queryByRole("dialog", { name: "One" })).not.toBeInTheDocument();
  expect(tab("Two")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Two state")).toHaveValue("Retained");
});

it("snaps a dragged window onto a title bar into a floating group without replacing either playlist", () => {
  render(<Windows />);
  const one = dialog("One");
  fireEvent.change(screen.getByLabelText("One state"), { target: { value: "Keep my playlist" } });
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  dragInto("Two", "One");
  expect(screen.getByRole("tablist", { name: "Grouped packs" })).toBeVisible();
  expect(tab("Two")).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("dialog", { name: "One" })).not.toBeInTheDocument();
  expect(dialog("Two").style.width).toBe("500px");
  fireEvent.click(tab("One"));
  expect(dialog("One")).toBe(one);
  expect(screen.getByLabelText("One state")).toHaveValue("Keep my playlist");
  fireEvent.click(screen.getByRole("button", { name: "Ungroup this pack" }));
  expect(dialog("One")).toHaveClass("floating-window--floating");
  expect(dialog("Two")).toHaveClass("floating-window--floating");
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
});

it("moves and resizes floating groups together, merges another pack, and preserves group members after close", () => {
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  render(<Windows />);
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  dragInto("Two", "One");
  const current = dialog("Two");
  vi.spyOn(current, "getBoundingClientRect").mockReturnValue({
    x: 120, y: 120, left: 120, top: 120, width: 500, height: 500, right: 620, bottom: 620, toJSON() {},
  });
  fireEvent.keyDown(screen.getByRole("button", { name: /^Move Two/ }), { key: "ArrowRight" });
  fireEvent.keyDown(screen.getByRole("button", { name: /^Resize Two/ }), { key: "ArrowRight" });
  const width = current.style.width;
  fireEvent.click(tab("One"));
  expect(dialog("One").style.width).toBe(width);
  fireEvent.keyDown(screen.getByRole("button", { name: /^Move One/ }), { key: "Home" });
  const resetLeft = dialog("One").style.left;
  const resetTop = dialog("One").style.top;
  fireEvent.click(tab("Two"));
  expect(dialog("Two").style.left).toBe(resetLeft);
  expect(dialog("Two").style.top).toBe(resetTop);
  fireEvent.click(tab("One"));
  fireEvent.click(screen.getByRole("button", { name: "Open Three" }));
  dragInto("Three", "One");
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Close Three" }));
  expect(screen.getAllByRole("tab")).toHaveLength(2);
  expect(screen.getByRole("tablist", { name: "Grouped packs" })).toBeVisible();
});

it("cancels drag grouping without merging and groups onto an existing dock on release", () => {
  render(<Windows />);
  dock("One", "right");
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  dragInto("Two", "One", true);
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(dialog("Two")).toHaveClass("floating-window--floating");
  expect(document.querySelector(".snap-preview")).not.toBeInTheDocument();
  dragInto("Two", "One");
  expect(screen.getByRole("tablist", { name: "Right docked packs" })).toBeVisible();
  expect(dialog("Two")).toHaveClass("floating-window--right");
});

it("merges whole floating groups and keeps a detached target independent when regrouped later", () => {
  render(<Windows titles={["One", "Two", "Three", "Four", "Five"]} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  dragInto("Two", "One");
  fireEvent.click(screen.getByRole("button", { name: "Open Four" }));
  dragInto("Four", "Three");
  dragInto("Four", "Two");
  expect(screen.getAllByRole("tab")).toHaveLength(4);
  fireEvent.click(tab("One"));
  fireEvent.click(screen.getByRole("button", { name: "Ungroup this pack" }));
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Open Five" }));
  dragInto("Five", "One");
  expect(screen.getAllByRole("tablist")).toHaveLength(2);
  expect(within(screen.getByRole("dialog", { name: "Five" })).getAllByRole("tab")).toHaveLength(2);
  expect(screen.getAllByRole("tab")).toHaveLength(5);
});

it("styles selected tabs as connected raised content tabs using only semantic roles", () => {
  const css = readFileSync(resolve("src", "organisms", "Window", "Window.css"), "utf8");
  expect(css).toContain("border-radius: var(--radius-sm) var(--radius-sm) 0 0");
  expect(css).toContain("border-bottom-color: var(--window-tab-selected)");
  expect(css).toContain("box-shadow: inset 0 3px var(--window-tab-indicator)");
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(|color-mix\(|var\(--color-/i);
});
