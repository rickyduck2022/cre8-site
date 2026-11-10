import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FloatingWindow, WindowLayer } from "./Window";

beforeEach(() => {
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("releases the native modal layer before restoring focus to its opener", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const opener = document.createElement("button");
  document.body.append(opener);
  opener.focus();
  const { unmount } = render(<FloatingWindow title="Test pack" active order={0} onActivate={vi.fn()} onClose={vi.fn()}><p>Playlist</p></FloatingWindow>);
  const dialog = screen.getByRole("dialog");
  if (!(dialog instanceof HTMLDialogElement)) throw new Error("Missing pack window");
  const close = vi.spyOn(dialog, "close");
  unmount();
  expect(close).toHaveBeenCalledOnce();
  expect(opener).toHaveFocus();
  opener.remove();
});

it("provides keyboard docking, minimize, restore and fullscreen without blocking the app", () => {
  const close = vi.fn();
  render(<FloatingWindow title="Test pack" active order={0} onActivate={vi.fn()} onClose={close}><button>Play track</button></FloatingWindow>);
  const dialog = screen.getByRole("dialog", { name: "Test pack" });
  expect(dialog).not.toHaveAttribute("aria-modal");
  fireEvent.change(screen.getByRole("combobox", { name: "Position Test pack" }), { target: { value: "right" } });
  expect(dialog).toHaveClass("floating-window--right");
  fireEvent.click(screen.getByRole("button", { name: "Minimize Test pack" }));
  expect(screen.queryByRole("button", { name: "Play track" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Restore Test pack" }));
  expect(screen.getByRole("button", { name: "Play track" })).toBeVisible();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "fullscreen" } });
  expect(dialog).toHaveClass("floating-window--fullscreen");
  fireEvent.keyDown(screen.getByRole("button", { name: "Close Test pack" }), { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
});

it("keeps only the active mobile pack in a fullscreen modal and restores desktop placement", () => {
  let mobile = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({ get matches() { return mobile; },
    addEventListener: (_: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_: string, callback: () => void) => listeners.delete(callback) }));
  const props = { title: "Test pack", order: 0, onActivate: vi.fn(), onClose: vi.fn() };
  const { rerender } = render(<FloatingWindow {...props} active><p>Playlist</p></FloatingWindow>);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "left" } });
  act(() => { mobile = true; listeners.forEach((listener) => listener()); });
  expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  rerender(<FloatingWindow {...props} active={false}><p>Playlist</p></FloatingWindow>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  rerender(<FloatingWindow {...props} active><p>Playlist</p></FloatingWindow>);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(props.onClose).toHaveBeenCalledOnce();
  act(() => { mobile = false; listeners.forEach((listener) => listener()); });
  expect(screen.getByRole("dialog")).toHaveClass("floating-window--left");
  expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-modal");
});

it("moves with arrow keys, clamps to viewport bounds and resets with Home", () => {
  vi.stubGlobal("innerWidth", 900); vi.stubGlobal("innerHeight", 700);
  const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 200, y: 100, left: 200, top: 100, width: 640, height: 500, right: 840, bottom: 600, toJSON() {},
  });
  render(<FloatingWindow title="Test pack" active order={0} onActivate={vi.fn()} onClose={vi.fn()}><p>Playlist</p></FloatingWindow>);
  const handle = screen.getByRole("button", { name: /^Move Test pack/ });
  const dialog = screen.getByRole("dialog");
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(dialog.style.left).toBe("216px");
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  expect(dialog.style.top).toBe("116px");
  bounds.mockReturnValue({ x: 890, y: 690, left: 890, top: 690, width: 640, height: 500, right: 1530, bottom: 1190, toJSON() {} });
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(dialog.style.left).toBe("260px");
  expect(dialog.style.top).toBe("200px");
  fireEvent.keyDown(handle, { key: "Home" });
  expect(dialog.style.left).not.toBe("260px");
  expect(within(dialog).getByText("Playlist")).toBeVisible();
});

it("stacks minimized packs without moving DOM nodes, compacts after close and restores mounted content", () => {
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  function Windows({ closeFirst = false, request = 0 }) {
    return <WindowLayer>{["One", "Two", "Three"].filter((title) => title !== "One" || !closeFirst).map((title, order) =>
      <FloatingWindow key={title} title={title} active={title === "Three"} order={order} openRequest={title === "Two" ? request : 0}
        onActivate={vi.fn()} onClose={vi.fn()}><input aria-label={`${title} state`} defaultValue="Saved" /></FloatingWindow>)}</WindowLayer>;
  }
  const { rerender } = render(<Windows />);
  const two = screen.getByRole("dialog", { name: "Two" });
  fireEvent.change(screen.getByLabelText("Two state"), { target: { value: "Keep me" } });
  fireEvent.click(screen.getByRole("button", { name: "Minimize One" }));
  expect(Number(screen.getByRole("dialog", { name: "One" }).style.zIndex)).toBeGreaterThan(Number(screen.getByRole("dialog", { name: "Three" }).style.zIndex));
  for (const title of ["Two", "Three"]) fireEvent.click(screen.getByRole("button", { name: `Minimize ${title}` }));
  expect(screen.getByRole("dialog", { name: "One" }).style.bottom).toBe("16px");
  expect(two.style.bottom).toBe("76px");
  expect(screen.getByRole("dialog", { name: "Three" }).style.bottom).toBe("136px");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  rerender(<Windows closeFirst />);
  expect(screen.getByRole("dialog", { name: "Two" })).toBe(two);
  expect(two.style.bottom).toBe("16px");
  expect(screen.getByRole("dialog", { name: "Three" }).style.bottom).toBe("76px");
  rerender(<Windows closeFirst request={1} />);
  expect(two).not.toHaveClass("floating-window--minimized");
  expect(screen.getByLabelText("Two state")).toHaveValue("Keep me");
  expect(screen.getByRole("dialog", { name: "Three" }).style.bottom).toBe("16px");
});

it("wraps the minimized stack into columns on short viewports", () => {
  vi.stubGlobal("innerWidth", 900); vi.stubGlobal("innerHeight", 180);
  render(<WindowLayer>{["One", "Two", "Three"].map((title, order) =>
    <FloatingWindow key={title} title={title} active={order === 2} order={order} onActivate={vi.fn()} onClose={vi.fn()}>Playlist</FloatingWindow>)}</WindowLayer>);
  for (const title of ["One", "Two", "Three"]) fireEvent.click(screen.getByRole("button", { name: `Minimize ${title}` }));
  const one = screen.getByRole("dialog", { name: "One" });
  const two = screen.getByRole("dialog", { name: "Two" });
  const three = screen.getByRole("dialog", { name: "Three" });
  expect(one.style.right).toBe(two.style.right);
  expect(three.style.right).not.toBe(one.style.right);
  expect(Number.parseFloat(two.style.bottom) + Number.parseFloat(two.style.height)).toBeLessThan(180);
  fireEvent.click(within(three).getByRole("button", { name: "Three" }));
  expect(three).not.toHaveClass("floating-window--minimized");
});

it("retains resized dimensions through minimize, docking and fullscreen and clamps after viewport changes", () => {
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 100, y: 80, left: 100, top: 80, width: 600, height: 500, right: 700, bottom: 580, toJSON() {},
  });
  render(<FloatingWindow title="Test pack" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>Playlist</FloatingWindow>);
  const dialog = screen.getByRole("dialog");
  fireEvent.keyDown(screen.getByRole("button", { name: /^Resize Test pack/ }), { key: "ArrowRight" });
  expect(dialog.style.width).toBe("616px");
  expect(dialog.style.height).toBe("500px");
  fireEvent.click(screen.getByRole("button", { name: "Minimize Test pack" }));
  fireEvent.click(screen.getByRole("button", { name: "Restore Test pack" }));
  expect(dialog.style.width).toBe("616px");
  for (const placement of ["left", "right", "fullscreen"]) {
    fireEvent.change(screen.getByRole("combobox"), { target: { value: placement } });
    if (placement === "fullscreen") expect(screen.queryByRole("button", { name: /^Resize/ })).not.toBeInTheDocument();
  }
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "floating" } });
  expect(dialog.style.width).toBe("616px");
  fireEvent.keyDown(screen.getByRole("button", { name: /^Move Test pack/ }), { key: "ArrowRight" });
  act(() => { vi.stubGlobal("innerWidth", 800); vi.stubGlobal("innerHeight", 400); window.dispatchEvent(new Event("resize")); });
  expect(Number.parseFloat(dialog.style.width)).toBeLessThanOrEqual(784);
  expect(Number.parseFloat(dialog.style.height)).toBeLessThanOrEqual(384);
  expect(Number.parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(0);
});

it("uses semantic tokens for dark borders, stronger active shadows and a labelled focus cue", () => {
  const css = readFileSync(resolve("src", "organisms", "Window", "Window.css"), "utf8");
  expect(css).toContain("border: 3px solid var(--window-border)");
  expect(css).toContain("box-shadow: var(--window-shadow-active)");
  expect(css).toContain("background: var(--window-header-active)");
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(|color-mix\(|var\(--color-/i);
  const props = { title: "Test pack", order: 0, onActivate: vi.fn(), onClose: vi.fn() };
  const { rerender } = render(<FloatingWindow {...props} active>Playlist</FloatingWindow>);
  expect(screen.getByText("Active")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveClass("floating-window--active");
  rerender(<FloatingWindow {...props} active={false}>Playlist</FloatingWindow>);
  expect(screen.getByText("Inactive")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).not.toHaveClass("floating-window--active");
});
