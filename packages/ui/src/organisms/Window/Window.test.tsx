import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FloatingWindow, WindowLayer, WindowVisibility } from "./Window";
import { useState } from "react";
import type { WindowWorkspace } from "./workspace";
import { TutorialNavigationContext } from "../../foundations/TutorialNavigationContext";

beforeEach(() => {
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function contentSizingMeasurements(width = 1000, height = 1000) {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
  let nextFrame: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { nextFrame = callback; return 1; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn(() => { nextFrame = undefined; }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("floating-window")
      ? new DOMRect(8, 8, 640, this.classList.contains("floating-window--measuring") ? 760 : 480)
      : new DOMRect();
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(640);
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(634);
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(820);
  return () => act(() => { const callback = nextFrame; nextFrame = undefined; callback?.(0); });
}
it("keeps a guided mobile window non-modal until its next ordinary opening", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const modal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
  function Guided({ guiding, request }: { guiding: boolean; request: number }) {
    return <TutorialNavigationContext.Provider value={guiding ? { id: 1, ready: true, surface: "upload" } : null}>
      <WindowLayer><FloatingWindow title="Guided upload" windowId="guided-upload" active order={0} openRequest={request} onActivate={vi.fn()} onClose={vi.fn()}>
        <input aria-label="Draft title" defaultValue="Keep my draft" />
      </FloatingWindow></WindowLayer>
    </TutorialNavigationContext.Provider>;
  }
  const view = render(<Guided guiding request={1} />);
  expect(screen.getByRole("dialog", { name: "Guided upload" })).toBeVisible();
  expect(modal).not.toHaveBeenCalled();
  view.rerender(<Guided guiding={false} request={1} />);
  expect(modal).not.toHaveBeenCalled();
  view.rerender(<Guided guiding={false} request={2} />);
  expect(modal).toHaveBeenCalled();
  expect(screen.getByRole("textbox", { name: "Draft title" })).toHaveValue("Keep my draft");
});

it.each([false, true])("restores and focuses a minimized window on an open request on mobile=%s", (mobile) => {
  vi.stubGlobal("matchMedia", () => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  function Windows({ request = 0 }) {
    const [active, setActive] = useState("Requested");
    return <WindowLayer><button onClick={() => setActive("Other")}>Activate other</button>{["Requested", "Other"].map((title, order) =>
      <FloatingWindow key={title} windowId={title} title={title} active={active === title} order={order}
        openRequest={title === "Requested" ? request : 0} onActivate={() => setActive(title)} onClose={vi.fn()}>
        Content
      </FloatingWindow>)}</WindowLayer>;
  }
  const { rerender } = render(<Windows />);
  fireEvent.click(screen.getByRole("button", { name: "Minimize Requested" }));
  fireEvent.click(screen.getByRole("button", { name: "Activate other" }));
  expect(screen.queryByRole("dialog", { name: "Requested", exact: true })).not.toBeInTheDocument();
  rerender(<Windows request={1} />);
  const requested = screen.getByRole("dialog", { name: "Requested", exact: true });
  expect(requested).toBeVisible();
  expect(requested).toContainElement(document.activeElement as HTMLElement);
});

it.each([
  [1000, 1000, "826px", "760px"],
  [800, 420, "784px", "404px"],
])("fits first-open content inside a %s by %s viewport", (width, height, expectedWidth, expectedHeight) => {
  const measure = contentSizingMeasurements(width, height);
  const save = vi.fn();
  const view = render(<WindowLayer onWorkspaceChange={save}>
    <FloatingWindow windowId="fit" title="Fit content" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>Content</FloatingWindow>
  </WindowLayer>);
  measure();
  const dialog = screen.getByRole("dialog", { name: "Fit content" });
  expect(dialog.style.width).toBe(expectedWidth);
  expect(dialog.style.height).toBe(expectedHeight);
  expect(dialog).not.toHaveClass("floating-window--measuring");
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ windows: [expect.objectContaining({
    frame: expect.objectContaining({ size: { width: Number.parseInt(expectedWidth), height: Number.parseInt(expectedHeight) } }),
  })] }));
  view.rerender(<WindowLayer onWorkspaceChange={save}>
    <FloatingWindow windowId="fit" title="Fit content" active order={0} openRequest={2} onActivate={vi.fn()} onClose={vi.fn()}>Changed content</FloatingWindow>
  </WindowLayer>);
  measure();
  expect(dialog.style.height).toBe(expectedHeight);
});

it("preserves restored dimensions instead of fitting saved windows again", () => {
  const measure = contentSizingMeasurements();
  const workspace: WindowWorkspace = { version: 1, playerTrackId: null, dockWidths: {}, windows: [{
    id: "saved", frame: { placement: "floating", position: { x: 10, y: 10 }, size: { width: 500, height: 400 } },
    restoreFrame: null, minimized: false, title: null, group: null, order: 0, dockOrder: 0,
  }] };
  render(<WindowLayer initialWorkspace={workspace}>
    <FloatingWindow windowId="saved" title="Saved size" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>Content</FloatingWindow>
  </WindowLayer>);
  measure();
  expect(screen.getByRole("dialog", { name: "Saved size" })).toHaveStyle({ width: "500px", height: "400px" });
});

it("grows a floating group for a first-open tab and shares the fitted frame", () => {
  const measure = contentSizingMeasurements();
  const save = vi.fn();
  const workspace: WindowWorkspace = { version: 1, playerTrackId: null, dockWidths: {}, windows: [{
    id: "original", frame: { placement: "floating", position: { x: 10, y: 10 }, size: { width: 500, height: 400 } },
    restoreFrame: null, minimized: false, title: null, group: null, order: 0, dockOrder: 0,
  }] };
  render(<WindowLayer initialWorkspace={workspace} onWorkspaceChange={save}>
    <FloatingWindow windowId="original" title="Original" kind="dub" active={false} order={0} onActivate={vi.fn()} onClose={vi.fn()}>Original</FloatingWindow>
    <FloatingWindow windowId="new" title="New tab" kind="dub" autoGroup active order={1} onActivate={vi.fn()} onClose={vi.fn()}>New content</FloatingWindow>
  </WindowLayer>);
  measure();
  expect(screen.getByRole("dialog", { name: "New tab" })).toHaveStyle({ width: "826px", height: "760px" });
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ windows: expect.arrayContaining(
    ["original", "new"].map((id) => expect.objectContaining({ id, frame: expect.objectContaining({ size: { width: 826, height: 760 } }) })),
  ) }));
});

it("does not override a manual resize made before the first measurement", () => {
  const measure = contentSizingMeasurements();
  render(<FloatingWindow title="Manual size" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>Content</FloatingWindow>);
  fireEvent.keyDown(screen.getByRole("button", { name: /^Resize Manual size/ }), { key: "ArrowRight" });
  measure();
  expect(screen.getByRole("dialog", { name: "Manual size" })).toHaveStyle({ width: "656px", height: "480px" });
});

it("waits for initially busy content before fitting its first frame", () => {
  const measure = contentSizingMeasurements();
  const props = { title: "Loading content", active: true, order: 0, onActivate: vi.fn(), onClose: vi.fn() };
  const view = render(<FloatingWindow {...props}><section aria-busy="true">Loading</section></FloatingWindow>);
  measure();
  expect(screen.getByRole("dialog", { name: "Loading content" }).style.height).toBe("");
  view.rerender(<FloatingWindow {...props}><section aria-busy="false">Loaded</section></FloatingWindow>);
  measure();
  expect(screen.getByRole("dialog", { name: "Loading content" }).style.height).toBe("760px");
});

it("keeps mobile windows full-screen without desktop content sizing", () => {
  const measure = contentSizingMeasurements(390, 844);
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<FloatingWindow title="Mobile content" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>Content</FloatingWindow>);
  measure();
  const dialog = screen.getByRole("dialog", { name: "Mobile content" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog.style.width).toBe("");
  expect(dialog.style.height).toBe("");
});

it.each(["Visible", "Maximized", "Minimized", "Minimized with workspace", "Hidden", "Hidden with workspace", "Inactive tab"] as const)(
  "normalizes %s visibility and uses the visible icon's selected variant only when visible",
  (state) => {
    const visible = state === "Visible" || state === "Maximized";
    const app = render(<WindowVisibility state={state} focused />);
    const icon = screen.getByRole("img", { name: visible ? "Visible (selected)" : "Hidden", exact: true });
    expect(icon.hasAttribute("data-selected")).toBe(visible);
    const path = icon.querySelector("path")?.getAttribute("d");
    app.rerender(<WindowVisibility state={state} />);
    expect(screen.getByRole("img", { name: visible ? "Visible" : "Hidden", exact: true }).querySelector("path")).toHaveAttribute("d", path);
    expect(screen.getByRole("img")).not.toHaveAttribute("data-selected");
  },
);

it("cascades default positions within the workspace stage even when windows mount with the same activation order", () => {
  const stage = document.createElement("div");
  stage.className = "workspace-stage";
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1440, 900));
  document.body.append(stage);
  const view = render(<WindowLayer container={stage}>
    {["One", "Two", "Three"].map((id) => <FloatingWindow key={id} windowId={id} title={id} active order={0} onActivate={vi.fn()} onClose={vi.fn()}>Content</FloatingWindow>)}
  </WindowLayer>);
  expect(["One", "Two", "Three"].map((id) => screen.getByRole("dialog", { name: id }).style.left)).toEqual(["8px", "40px", "72px"]);
  expect(["One", "Two", "Three"].map((id) => screen.getByRole("dialog", { name: id }).style.top)).toEqual(["8px", "40px", "72px"]);
  view.unmount(); stage.remove();
});

it("reports focused group membership and returns to global outside while keeping main player controls in the system", () => {
  const change = vi.fn();
  render(<><button>Outside</button><div data-window-system><button>Main player</button></div>
    <WindowLayer onActiveGroupChange={change}>
      <FloatingWindow windowId="pack:one" title="One" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>Tracks</FloatingWindow>
    </WindowLayer></>);
  expect(change).toHaveBeenLastCalledWith({
    id: "pack:one", title: "One", activeWindowId: "pack:one", windows: [{ id: "pack:one", title: "One" }],
  });
  fireEvent.pointerDown(screen.getByRole("button", { name: "Main player" }));
  expect(screen.getByRole("dialog", { name: "One" })).not.toHaveClass("floating-window--minimized");
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
  expect(change).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByRole("button", { name: "Restore One", exact: true }));
  expect(change.mock.calls.at(-1)?.[0]?.id).toBe("pack:one");
});

it("minimizes every grouped window on outside interaction without losing groups, drafts or playback", () => {
  const toggle = vi.fn();
  const save = vi.fn();
  const workspace: WindowWorkspace = { version: 1, playerTrackId: null, dockWidths: {}, windows:
    ["Pack", "Chat", "Player"].map((id, order) => ({
      id, title: null, frame: { placement: "right", position: "initial", size: null },
      restoreFrame: null, minimized: false, group: "studio", order, dockOrder: order,
    })),
  };
  render(<><button>Outside</button><WindowLayer initialWorkspace={workspace} onWorkspaceChange={save}>
    {workspace.windows.map((entry) => <FloatingWindow key={entry.id} windowId={entry.id} title={entry.id}
      active={entry.id === "Player"} order={entry.order} onActivate={vi.fn()} onClose={vi.fn()}
      playback={entry.id === "Player" ? { isPlaying: true, onToggle: toggle } : undefined}>
      <input aria-label={`${entry.id} draft`} defaultValue="Keep me" />
    </FloatingWindow>)}
  </WindowLayer></>);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }), { pointerType: "touch" });
  for (const entry of workspace.windows) {
    expect(document.getElementById(entry.id)?.closest("dialog")).toHaveClass("floating-window--minimized");
  }
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
    windows: expect.arrayContaining(workspace.windows.map((entry) => expect.objectContaining({
      id: entry.id, minimized: true, group: "studio", frame: entry.frame,
    }))),
  }));
  expect(toggle).not.toHaveBeenCalled();
  const dock = screen.getByRole("navigation", { name: "Minimized windows" });
  expect(within(dock).getByRole("region", { name: "Minimized group: Pack" })).toBeVisible();
  fireEvent.pointerDown(within(dock).getByRole("button", { name: "Restore Player", exact: true }));
  fireEvent.click(within(dock).getByRole("button", { name: "Restore Player", exact: true }));
  expect(screen.getByRole("textbox", { name: "Player draft" })).toHaveValue("Keep me");
  expect(document.getElementById("Pack")?.closest("dialog")).toHaveClass("floating-window--minimized");
  fireEvent.click(screen.getByRole("button", { name: "Restore group: Pack", exact: true }));
  expect(screen.getByRole("tab", { name: "Pack", exact: true })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Chat", exact: true })).toBeVisible();
});

it("ignores interactions in window content, portaled menus and other window layers", () => {
  render(<><WindowLayer><FloatingWindow title="One" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>
    <input aria-label="Draft" />
  </FloatingWindow></WindowLayer><WindowLayer><FloatingWindow title="Two" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>
    <button>Inside</button>
  </FloatingWindow></WindowLayer></>);
  fireEvent.pointerDown(screen.getByRole("textbox", { name: "Draft" }));
  fireEvent.wheel(screen.getByRole("textbox", { name: "Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Inside" }));
  fireEvent.click(screen.getByRole("button", { name: "Window options for One" }));
  fireEvent.pointerDown(screen.getByRole("button", { name: "Rename window" }));
  fireEvent.click(screen.getByRole("button", { name: "Rename window" }));
  expect(screen.getByRole("textbox", { name: "Window name" })).toBeVisible();
  expect(screen.getByRole("dialog", { name: "One" })).not.toHaveClass("floating-window--minimized");
  expect(screen.getByRole("dialog", { name: "Two" })).not.toHaveClass("floating-window--minimized");
});

it.each(["wheel", "click", "keydown"] as const)("minimizes windows for an outside %s without swallowing the action", (interaction) => {
  const click = vi.fn();
  render(<><button onClick={click}>Outside</button><WindowLayer>
    <FloatingWindow title="One" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>Content</FloatingWindow>
  </WindowLayer></>);
  const outside = screen.getByRole("button", { name: "Outside" });
  if (interaction === "wheel") fireEvent.wheel(outside);
  else if (interaction === "keydown") fireEvent.keyDown(outside, { key: "ArrowDown" });
  else { fireEvent.click(outside); expect(click).toHaveBeenCalledOnce(); }
  expect(screen.queryByRole("dialog", { name: "One" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Restore One", exact: true })).toBeVisible();
});

it("minimizes on keyboard focus leaving the system, not on programmatic focus changes", () => {
  render(<><button>Outside</button><WindowLayer>
    <FloatingWindow title="One" active order={0} onActivate={vi.fn()} onClose={vi.fn()}><input aria-label="Draft" /></FloatingWindow>
  </WindowLayer></>);
  const outside = screen.getByRole("button", { name: "Outside" });
  act(() => outside.focus());
  expect(screen.getByRole("dialog", { name: "One" })).not.toHaveClass("floating-window--minimized");
  const draft = screen.getByRole("textbox", { name: "Draft" });
  act(() => draft.focus());
  fireEvent.keyDown(draft, { key: "Tab" });
  act(() => outside.focus());
  expect(screen.queryByRole("dialog", { name: "One" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Restore One", exact: true })).toBeVisible();
});

it("keeps the mobile restore dock usable after outside interaction", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  render(<><button>Outside</button><WindowLayer>
    <FloatingWindow title="One" active order={0} onActivate={vi.fn()} onClose={vi.fn()}><input aria-label="Draft" defaultValue="Saved" /></FloatingWindow>
  </WindowLayer></>);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }), { pointerType: "touch" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const dock = screen.getByRole("navigation", { name: "Minimized windows" });
  const restore = within(dock).getByRole("button", { name: "Restore One", exact: true });
  fireEvent.pointerDown(restore, { pointerType: "touch" });
  fireEvent.click(restore);
  expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Saved");
});

it("renames a window locally, validates empty names and retains its content through minimization", () => {
  render(<WindowLayer><FloatingWindow title="Original" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>
    <input aria-label="Retained draft" defaultValue="Hello" />
  </FloatingWindow></WindowLayer>);
  fireEvent.click(screen.getByRole("button", { name: "Window options for Original" }));
  fireEvent.click(screen.getByRole("button", { name: "Rename window" }));
  const input = screen.getByRole("textbox", { name: "Window name" });
  fireEvent.change(input, { target: { value: "  " } });
  fireEvent.submit(input.closest("form")!);
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a window name");
  fireEvent.change(input, { target: { value: "Studio" } });
  fireEvent.submit(input.closest("form")!);
  expect(screen.getByRole("dialog", { name: "Studio" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Minimize Studio" }));
  expect(screen.getByRole("region", { name: "Minimized window: Studio" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Restore Studio", exact: true }));
  expect(screen.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Hello");
});

it("shows playback status and pause controls while minimized without restoring the window", () => {
  const toggle = vi.fn();
  render(<WindowLayer><FloatingWindow title="Music" active order={0} onActivate={vi.fn()} onClose={vi.fn()}
    playback={{ isPlaying: true, onToggle: toggle }}>Tracks</FloatingWindow></WindowLayer>);
  fireEvent.click(screen.getByRole("button", { name: "Minimize Music" }));
  expect(screen.getByRole("status", { name: "Now playing" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Pause audio in Music" }));
  expect(toggle).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Minimized window: Music" })).toBeVisible();
});

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

it("uses the same minimized container for single windows, compacts after close and restores mounted content", () => {
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
  expect(screen.getByRole("region", { name: "Minimized window: One" })).toBeVisible();
  for (const title of ["Two", "Three"]) fireEvent.click(screen.getByRole("button", { name: `Minimize ${title}` }));
  const dock = screen.getByRole("navigation", { name: "Minimized windows" });
  expect(within(dock).getAllByRole("region")).toHaveLength(3);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  rerender(<Windows closeFirst />);
  expect(two).toBeInTheDocument();
  expect(within(dock).getAllByRole("region")).toHaveLength(2);
  expect(within(dock).queryByRole("region", { name: "Minimized window: One" })).not.toBeInTheDocument();
  rerender(<Windows closeFirst request={1} />);
  expect(two).not.toHaveClass("floating-window--minimized");
  expect(screen.getByLabelText("Two state")).toHaveValue("Keep me");
  expect(within(dock).getAllByRole("region")).toHaveLength(1);
});

it("keeps all minimized controls in the shared dock on short viewports", () => {
  vi.stubGlobal("innerWidth", 900); vi.stubGlobal("innerHeight", 180);
  render(<WindowLayer>{["One", "Two", "Three"].map((title, order) =>
    <FloatingWindow key={title} title={title} active={order === 2} order={order} onActivate={vi.fn()} onClose={vi.fn()}>Playlist</FloatingWindow>)}</WindowLayer>);
  for (const title of ["One", "Two", "Three"]) fireEvent.click(screen.getByRole("button", { name: `Minimize ${title}` }));
  const dock = screen.getByRole("navigation", { name: "Minimized windows" });
  expect(within(dock).getAllByRole("region")).toHaveLength(3);
  fireEvent.click(within(dock).getByRole("button", { name: "Restore Three", exact: true }));
  expect(screen.getByRole("dialog", { name: "Three" })).not.toHaveClass("floating-window--minimized");
  expect(within(dock).getAllByRole("region")).toHaveLength(2);
});

it("highlights only outside-minimized windows for four seconds without restarting on the follow-up click", () => {
  vi.useFakeTimers();
  try {
    render(<><button>Outside</button><WindowLayer>{["Manual", "Automatic"].map((title, order) =>
      <FloatingWindow key={title} title={title} order={order} active={order === 1} onActivate={vi.fn()} onClose={vi.fn()}>Draft</FloatingWindow>
    )}</WindowLayer></>);
    fireEvent.click(screen.getByRole("button", { name: "Minimize Manual" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    const manual = screen.getByRole("region", { name: "Minimized window: Manual" });
    const automatic = screen.getByRole("region", { name: "Minimized window: Automatic" });
    expect(manual).not.toHaveClass("window-layer__minimized-group--highlight");
    expect(automatic).toHaveClass("window-layer__minimized-group--highlight");
    expect(screen.getByText("1 window minimized. Restore from Minimized windows.")).toHaveAttribute("role", "status");
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.click(screen.getByRole("button", { name: "Outside" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(automatic).not.toHaveClass("window-layer__minimized-group--highlight");
    expect(screen.queryByText("1 window minimized. Restore from Minimized windows.")).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it("keeps compact close locks and window options functional without restoring on playback", () => {
  const close = vi.fn();
  const props = { title: "Upload", active: true, order: 0, onActivate: vi.fn(), onClose: close };
  const { rerender } = render(<WindowLayer><FloatingWindow {...props} closeDisabled>Form</FloatingWindow></WindowLayer>);
  fireEvent.click(screen.getByRole("button", { name: "Minimize Upload" }));
  expect(screen.getByRole("button", { name: "Close Upload" })).toBeDisabled();
  rerender(<WindowLayer><FloatingWindow {...props}>Form</FloatingWindow></WindowLayer>);
  fireEvent.click(screen.getByRole("button", { name: "Window options for Upload" }));
  fireEvent.click(screen.getByRole("button", { name: "Rename window" }));
  expect(screen.getByRole("textbox", { name: "Window name" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Window name" }), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Minimize Upload" }));
  fireEvent.click(screen.getByRole("button", { name: "Close Upload" }));
  expect(close).toHaveBeenCalledOnce();
});

it("clears restored highlights and does not extend the remaining windows' notification", () => {
  vi.useFakeTimers();
  try {
    render(<><button>Outside</button><WindowLayer>{["One", "Two"].map((title, order) =>
      <FloatingWindow key={title} title={title} active={order === 1} order={order} onActivate={vi.fn()} onClose={vi.fn()}>Draft</FloatingWindow>
    )}</WindowLayer></>);
    fireEvent.click(screen.getByRole("button", { name: "Outside" }));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole("button", { name: "Restore One", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Minimize One", exact: true }));
    expect(screen.getByRole("region", { name: "Minimized window: One" })).not.toHaveClass("window-layer__minimized-group--highlight");
    const remaining = screen.getByRole("region", { name: "Minimized window: Two" });
    expect(remaining).toHaveClass("window-layer__minimized-group--highlight");
    act(() => vi.advanceTimersByTime(2000));
    expect(remaining).not.toHaveClass("window-layer__minimized-group--highlight");
  } finally { vi.useRealTimers(); }
});

it("captures only the visible view when outside-minimizing a group, without duplicating live controls or media", () => {
  const action = vi.fn();
  const frame = { placement: "floating" as const, position: "initial" as const, size: null };
  const workspace: WindowWorkspace = { version: 1, playerTrackId: null, dockWidths: {}, windows:
    ["Pack", "Chat"].map((id, order) => ({ id, title: null, frame, restoreFrame: null, group: "studio", minimized: false, order, dockOrder: order })) };
  render(<><button>Outside</button><WindowLayer initialWorkspace={workspace}>
    <FloatingWindow windowId="Pack" title="Pack" active={false} order={0} onActivate={vi.fn()} onClose={vi.fn()}>Hidden pack</FloatingWindow>
    <FloatingWindow windowId="Chat" title="Chat" active order={1} onActivate={vi.fn()} onClose={vi.fn()}>
      <label htmlFor="message-draft">Message draft</label><textarea id="message-draft" defaultValue="Keep my message" />
      <input type="password" aria-label="Private value" defaultValue="never-preview" />
      <button id="live-action" data-window-system onClick={action}>Live action</button>
      <audio src="/test-audio" />
    </FloatingWindow>
  </WindowLayer></>);
  const liveDraft = screen.getByRole("textbox", { name: "Message draft" });
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
  const group = screen.getByRole("region", { name: "Minimized group: Pack" });
  const preview = group.querySelector<HTMLElement>(".window-layer__preview");
  expect(preview).toHaveAttribute("aria-hidden", "true");
  expect(preview).toHaveAttribute("inert");
  expect(preview?.textContent).toContain("Keep my message");
  expect(preview?.textContent).not.toContain("Hidden pack");
  expect(preview?.querySelector("audio, video, [id], [data-window-system]")).toBeNull();
  expect(preview?.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe("");
  expect(screen.queryByRole("button", { name: "Live action" })).not.toBeInTheDocument();
  const clonedButton = preview?.querySelector("button");
  if (!clonedButton) throw new Error("Missing thumbnail button");
  fireEvent.click(clonedButton);
  expect(action).not.toHaveBeenCalled();
  expect(document.querySelectorAll("#message-draft")).toHaveLength(1);
  fireEvent.click(within(group).getByRole("button", { name: "Restore Chat", exact: true }));
  expect(screen.getByRole("textbox", { name: "Message draft" })).toBe(liveDraft);
  expect(group.querySelector(".window-layer__preview")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Minimize Chat", exact: true }));
  expect(group.querySelector(".window-layer__preview")).toBeNull();
});

it("collapses the entire dock to one Windows button without restoring windows or losing previews", () => {
  const toggle = vi.fn();
  render(<><button>Outside</button><WindowLayer>
    <FloatingWindow title="Music" active order={0} onActivate={vi.fn()} onClose={vi.fn()}
      playback={{ isPlaying: true, onToggle: toggle }}><input aria-label="Draft" defaultValue="Keep me" /></FloatingWindow>
  </WindowLayer></>);
  const draft = screen.getByRole("textbox", { name: "Draft" });
  fireEvent.click(screen.getByRole("button", { name: "Outside" }));
  const dock = screen.getByRole("navigation", { name: "Minimized windows" });
  const preview = dock.querySelector(".window-layer__preview");
  const collapse = within(dock).getByRole("button", { name: "Collapse minimized windows" });
  act(() => collapse.focus());
  fireEvent.click(collapse);
  const expand = within(dock).getByRole("button", { name: "Show minimized windows (1)" });
  expect(expand).toHaveFocus();
  expect(expand).toHaveAttribute("aria-expanded", "false");
  expect(within(expand).getByText("Windows (1)")).toBeVisible();
  expect(within(expand).getByLabelText("Now playing")).toBeVisible();
  expect(dock).toHaveClass("window-layer__dock--highlight");
  expect(within(dock).queryByRole("button", { name: "Restore Music", exact: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(draft).toBeInTheDocument();
  expect(toggle).not.toHaveBeenCalled();
  fireEvent.click(expand);
  expect(within(dock).getByRole("button", { name: "Collapse minimized windows" })).toHaveFocus();
  expect(dock.querySelector(".window-layer__preview")).toBe(preview);
  expect(within(dock).getByRole("button", { name: "Collapse minimized windows" })).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(within(dock).getByRole("button", { name: "Restore Music", exact: true }));
  expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
  expect(draft).toHaveValue("Keep me");
});

it("pads the translucent dock around its scrollable groups and fades inert previews using shared tokens", () => {
  const css = readFileSync(resolve("src", "organisms", "Window", "Window.css"), "utf8");
  const dock = css.match(/^\.window-layer__dock\s*\{([^}]+)\}/m)?.[1];
  expect(dock).toContain("padding: var(--spacing-3)");
  expect(dock).toContain("background: var(--window-dock-surface)");
  expect(css).toContain(".window-layer__dock-groups[hidden] { display: none; }");
  expect(css).toContain("opacity: var(--window-preview-opacity)");
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

it("minimizes on a header double-click and restores from a click on the minimized bar", () => {
  render(<FloatingWindow title="Test pack" active order={0} onActivate={vi.fn()} onClose={vi.fn()}><p>Playlist</p></FloatingWindow>);
  const dialog = screen.getByRole("dialog");
  const header = dialog.querySelector("header");
  if (!header) throw new Error("Missing window header");
  fireEvent.doubleClick(header);
  expect(dialog).toHaveClass("floating-window--minimized");
  fireEvent.click(header);
  expect(dialog).not.toHaveClass("floating-window--minimized");
  expect(screen.getByText("Playlist")).toBeVisible();
});

it("uses semantic window borders, stronger active shadows and a labelled focus cue", () => {
  const css = readFileSync(resolve("src", "organisms", "Window", "Window.css"), "utf8");
  expect(css).toContain("border: 3px solid var(--window-border)");
  expect(css).toMatch(/\.floating-window\.floating-window--active\s*\{[^}]*border: 3px solid var\(--window-focus\)/);
  expect(css).toContain("box-shadow: var(--window-shadow-active)");
  expect(css).toContain("background: var(--window-header-active)");
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(|color-mix\(|var\(--color-/i);
  const props = { title: "Test pack", order: 0, onActivate: vi.fn(), onClose: vi.fn() };
  const { rerender } = render(<FloatingWindow {...props} kind="sample" active>Playlist</FloatingWindow>);
  expect(screen.getByRole("dialog")).toHaveAttribute("data-window-kind", "sample");
  expect(screen.getByText("Active")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveClass("floating-window--active");
  rerender(<FloatingWindow {...props} active={false}>Playlist</FloatingWindow>);
  expect(screen.getByText("Inactive")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).not.toHaveClass("floating-window--active");
  expect(screen.getByRole("dialog")).toHaveAttribute("data-window-kind", "other");
});

it("maximizes and restores the previous dock and floating position", () => {
  render(<FloatingWindow title="Test pack" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>Playlist</FloatingWindow>);
  const dialog = screen.getByRole("dialog");
  fireEvent.keyDown(screen.getByRole("button", { name: /^Move Test pack/ }), { key: "ArrowRight" });
  const left = dialog.style.left;
  const top = dialog.style.top;
  fireEvent.click(screen.getByRole("button", { name: "Maximize Test pack" }));
  expect(dialog).toHaveClass("floating-window--fullscreen");
  fireEvent.click(screen.getByRole("button", { name: "Restore size of Test pack" }));
  expect(dialog).toHaveClass("floating-window--floating");
  expect(dialog.style.left).toBe(left);
  expect(dialog.style.top).toBe(top);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "right" } });
  fireEvent.click(screen.getByRole("button", { name: "Maximize Test pack" }));
  fireEvent.click(screen.getByRole("button", { name: "Restore size of Test pack" }));
  expect(dialog).toHaveClass("floating-window--right");
});

it("dismisses window options without closing the window and restores keyboard focus", () => {
  const close = vi.fn();
  const select = vi.fn();
  render(<FloatingWindow title="Player" active order={0} onActivate={vi.fn()} onClose={close}
    menuActions={[{ label: "Header", onSelect: vi.fn() }, { label: "Footer", onSelect: select }]}>Playback</FloatingWindow>);
  const trigger = screen.getByRole("button", { name: "Window options for Player" });
  fireEvent.click(trigger);
  expect(screen.getByRole("button", { name: "Header" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  const option = screen.getByRole("button", { name: "Footer" });
  expect(option).toHaveFocus();
  fireEvent.keyDown(option, { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("button", { name: "Footer" })).not.toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "Footer" }));
  expect(select).toHaveBeenCalledOnce();
  expect(trigger).toHaveFocus();
});

it("prevents selection on chrome and tabs without disabling text selection in window content", () => {
  const css = readFileSync(resolve("src", "organisms", "Window", "Window.css"), "utf8");
  expect(css).toMatch(/\.floating-window__header\s*\{[^}]*user-select: none/);
  expect(css).toMatch(/\.floating-window__tabs, \.window-layer__dock\s*\{[^}]*user-select: none/);
  expect(css).not.toMatch(/\.floating-window__content\s*\{[^}]*user-select: none/);
});

it("uses the theme-aware semantic border and nested corner radii without clipping window menus", () => {
  const css = readFileSync(resolve("src", "organisms", "Window", "Window.css"), "utf8");
  expect(css).toContain("border: 3px solid var(--window-border)");
  expect(css).toContain("border: 2px solid var(--window-border)");
  const theme = readFileSync(resolve("..", "tokens", "src", "theme.css"), "utf8");
  expect(theme).toContain("--window-border: var(--border-default)");
  expect(css).toContain("border-radius: max(0px, calc(var(--radius-md) - 3px))");
  expect(css).toMatch(/\.floating-window\s*\{[^}]*overflow: visible/);
  expect(css).toMatch(/\.floating-window--minimized \.floating-window__header\s*\{[^}]*box-sizing: border-box/);
});

it("drags from the title and empty header while excluding controls", () => {
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 100, y: 80, left: 100, top: 80, width: 600, height: 500, right: 700, bottom: 580, toJSON() {},
  });
  render(<FloatingWindow title="Test pack" active order={0} onActivate={vi.fn()} onClose={vi.fn()}
    menuActions={[{ label: "Footer", onSelect: vi.fn() }]}>Playlist</FloatingWindow>);
  const dialog = screen.getByRole("dialog");
  const header = dialog.querySelector("header")!;
  const capture = header.setPointerCapture = vi.fn();
  function pointer(target: Element, type: string, x: number, y: number) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    fireEvent(target, event);
  }
  for (const target of [screen.getByRole("heading", { name: "Test pack" }), header]) {
    pointer(target, "pointerdown", 150, 100);
    pointer(header, "pointermove", 250, 150);
    pointer(header, "pointerup", 250, 150);
    expect(dialog.style.left).toBe("200px");
    expect(dialog.style.top).toBe("130px");
  }
  expect(capture).toHaveBeenCalledTimes(2);
  for (const control of [
    screen.getByRole("combobox"), screen.getByRole("button", { name: "Minimize Test pack" }),
    screen.getByRole("button", { name: "Maximize Test pack" }), screen.getByRole("button", { name: "Close Test pack" }),
    screen.getByRole("button", { name: "Window options for Test pack" }),
  ]) {
    pointer(control.querySelector("svg") ?? control, "pointerdown", 150, 100);
    pointer(header, "pointermove", 350, 250);
    pointer(header, "pointerup", 350, 250);
    expect(dialog.style.left).toBe("200px");
    expect(dialog.style.top).toBe("130px");
  }
  expect(capture).toHaveBeenCalledTimes(2);
  pointer(header, "pointerdown", 150, 100);
  pointer(header, "pointercancel", 150, 100);
  pointer(header, "pointermove", 350, 250);
  expect(dialog.style.left).toBe("200px");
});
