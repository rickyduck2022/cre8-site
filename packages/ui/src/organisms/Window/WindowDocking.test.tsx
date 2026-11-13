import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FloatingWindow, WindowLayer } from "./Window";
import type { WindowWorkspace } from "./workspace";

beforeEach(() => {
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps docking guides narrow even when a wider dock has been saved", () => {
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  render(<WindowLayer initialWorkspace={{ version: 1, windows: [], dockWidths: { ":right": 600 }, playerTrackId: null }}>
    <FloatingWindow title="Guide" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>Content</FloatingWindow>
  </WindowLayer>);
  const header = screen.getByRole("dialog", { name: "Guide" }).querySelector("header")!;
  header.setPointerCapture = vi.fn();
  const event = new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 200, clientY: 100 });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
  fireEvent(header, event);
  const guides = document.querySelectorAll<HTMLElement>(".snap-preview");
  expect(guides).toHaveLength(2);
  guides.forEach(guide => expect(guide.style.width).toBe("64px"));
});

it("adds only the requested media tab to an existing conversation group", () => {
  function SharedWindows() {
    const [target, setTarget] = useState<{ id: string; request: number }>();
    return <WindowLayer><button onClick={() => setTarget({ id: "chat", request: 1 })}>Open shared media</button>
        <FloatingWindow windowId="one" title="One" autoGroup kind="dub" active={false} order={0} groupWith={target}
          onActivate={vi.fn()} onClose={vi.fn()}>One</FloatingWindow>
        <FloatingWindow windowId="two" title="Two" autoGroup kind="dub" active={false} order={1}
          onActivate={vi.fn()} onClose={vi.fn()}>Two</FloatingWindow>
        <FloatingWindow windowId="chat" title="Chat" kind="conversation" active order={2}
          onActivate={vi.fn()} onClose={vi.fn()}>Chat</FloatingWindow>
      </WindowLayer>;
  }
  render(<SharedWindows />);
  expect(within(screen.getByRole("dialog", { name: "Two" })).getAllByRole("tab")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Open shared media" }));
  const chat = screen.getByRole("dialog", { name: "Chat" });
  expect(within(chat).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Chat", "One"]);
  expect(screen.getByRole("dialog", { name: "Two" })).toBeVisible();
  expect(within(screen.getByRole("dialog", { name: "Two" })).queryByRole("tablist")).not.toBeInTheDocument();
});

it("exposes playback from a hidden child tab on the selected group header", () => {
  const toggle = vi.fn();
  render(<WindowLayer>
    <FloatingWindow title="Music" kind="dub" autoGroup active={false} order={0} onActivate={vi.fn()} onClose={vi.fn()}
      playback={{ isPlaying: true, onToggle: toggle }}>Tracks</FloatingWindow>
    <FloatingWindow title="Notes" kind="dub" autoGroup active order={1} onActivate={vi.fn()} onClose={vi.fn()}>Notes</FloatingWindow>
  </WindowLayer>);
  const group = screen.getByRole("dialog", { name: "Notes" });
  expect(within(group).getByRole("status", { name: "Playing audio in Notes or its tabs" })).toBeVisible();
  expect(within(group).getByRole("tab", { name: /Music/ })).toHaveTextContent("Music");
  fireEvent.click(within(group).getByRole("button", { name: "Pause audio in Notes" }));
  expect(toggle).toHaveBeenCalledOnce();
});

function Windows({ titles = ["One", "Two", "Three"], onPlay = vi.fn(), autoGroup = false, scopes = {}, kinds = {}, initialCount = titles.length, onWorkspaceChange }: {
  titles?: string[]; onPlay?: () => void; autoGroup?: boolean; scopes?: Record<string, string>; kinds?: Record<string, string>; initialCount?: number;
  onWorkspaceChange?: (workspace: WindowWorkspace) => void;
}) {
  const [windows, setWindows] = useState(titles.slice(0, initialCount));
  const [requests, setRequests] = useState<Record<string, number>>({});
  const activate = (title: string) => setWindows((current) => [...current.filter((entry) => entry !== title), title]);
  return <WindowLayer onWorkspaceChange={onWorkspaceChange}><div>{titles.map((title) => <button key={title} onClick={() => {
    activate(title);
    setRequests((current) => ({ ...current, [title]: (current[title] ?? 0) + 1 }));
  }}>Open {title}</button>)}</div>
    {[...windows].sort().map((title) => <FloatingWindow key={title} title={title}
      autoGroup={autoGroup} groupScope={scopes[title]} kind={kinds[title]}
      order={windows.indexOf(title)} active={title === windows.at(-1)} openRequest={requests[title] ?? 0}
      onActivate={() => activate(title)} onClose={() => setWindows((current) => current.filter((entry) => entry !== title))}>
      <input aria-label={`${title} state`} defaultValue={title} /><button onClick={onPlay}>Play {title}</button>
    </FloatingWindow>)}</WindowLayer>;
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

it("reopens the whole pure group after outside interaction minimizes its tabs", () => {
  render(<><button>Outside</button><Windows autoGroup titles={["One", "Two", "Three"]} initialCount={2} /></>);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
  expect(screen.getByRole("region", { name: "Minimized group: One" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open Three" }));
  expect(within(dialog("Three")).getAllByRole("tab")).toHaveLength(3);
  expect(document.querySelectorAll(".floating-window--minimized")).toHaveLength(0);
});

it("minimizes and restores the entire group from its menu without ungrouping tabs", () => {
  render(<Windows titles={["One", "Two"]} autoGroup />);
  fireEvent.click(screen.getByRole("button", { name: "Window options for Two" }));
  fireEvent.click(screen.getByRole("button", { name: "Minimize group", exact: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const container = screen.getByRole("region", { name: "Minimized group: One" });
  expect(within(container).getByRole("button", { name: "Restore One", exact: true })).toBeVisible();
  fireEvent.click(within(container).getByRole("button", { name: "Restore group: One", exact: true }));
  expect(within(dialog("Two")).getAllByRole("tab")).toHaveLength(2);
});

it("does not mistake an entirely minimized mixed group for a pure media group", () => {
  render(<><button>Outside</button><Windows titles={["One", "Two", "Three"]} initialCount={2}
    kinds={{ One: "dub", Two: "sample", Three: "sample" }} autoGroup /></>);
  dragInto("Two", "One");
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Three" }));
  expect(within(dialog("Three")).queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Minimized group: One" })).toBeVisible();
});

it.each(["floating", "left", "right", "fullscreen"] as const)("automatically opens a new pack in the existing %s group without moving it", (placement) => {
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  render(<Windows autoGroup initialCount={1} />);
  const first = dialog("One");
  if (placement !== "floating") dock("One", placement);
  const bounds = { x: 180, y: 120, left: 180, top: 120, right: 820, bottom: 620, width: 640, height: 500, toJSON() {} };
  vi.spyOn(first, "getBoundingClientRect").mockReturnValue(bounds);
  fireEvent.change(screen.getByLabelText("One state"), { target: { value: "Preserved" } });
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  expect(dialog("Two")).toHaveClass(`floating-window--${placement}`);
  expect(first).not.toHaveAttribute("open");
  expect(tab("Two")).toHaveAttribute("aria-selected", "true");
  if (placement === "floating") {
    expect(dialog("Two").style.left).toBe("180px");
    expect(dialog("Two").style.top).toBe("120px");
    expect(dialog("Two").style.width).toBe("640px");
    expect(dialog("Two").style.height).toBe("500px");
  }
  fireEvent.click(tab("One"));
  expect(dialog("One")).toBe(first);
  expect(screen.getByLabelText("One state")).toHaveValue("Preserved");
  fireEvent.click(screen.getByRole("button", { name: "Open Three" }));
  expect(tab("Three")).toHaveAttribute("aria-selected", "true");
  expect(screen.getAllByRole("tab")).toHaveLength(3);
});

it("mixes Dub and Sample windows in one group while new packs snap only onto pure same-kind groups", () => {
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  render(<Windows titles={["One", "Two", "Three", "Four"]} autoGroup initialCount={1}
    kinds={{ One: "dub", Two: "dub", Three: "sample", Four: "sample" }} />);
  dock("One", "left");
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  expect(dialog("Two")).toHaveClass("floating-window--left");
  expect(within(dialog("Two")).getByRole("tablist")).toHaveClass("collection-tabs", "media-kind--dub");
  expect(tab("One")).toHaveClass("media-kind--dub");
  fireEvent.click(screen.getByRole("button", { name: "Open Three" }));
  expect(dialog("Three")).toHaveClass("floating-window--floating");
  expect(screen.getAllByRole("tablist")).toHaveLength(1);
  dragInto("Three", "Two");
  expect(within(dialog("Three")).getAllByRole("tab")).toHaveLength(3);
  const mixed = within(dialog("Three")).getByRole("tablist");
  expect(mixed).not.toHaveClass("media-kind--dub");
  expect(mixed).not.toHaveClass("media-kind--sample");
  expect(tab("Three")).toHaveClass("media-kind--sample");
  expect(tab("One")).toHaveClass("media-kind--dub");
  fireEvent.click(screen.getByRole("button", { name: "Open Four" }));
  expect(dialog("Four")).toHaveClass("floating-window--floating");
  expect(within(dialog("Three")).getAllByRole("tab")).toHaveLength(3);
});

it("tears a tab out of a group into its own window at the release point", () => {
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  render(<Windows />);
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  dragInto("Two", "One");
  const handle = tab("One");
  handle.setPointerCapture = vi.fn();
  const pointer = (type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 7 }, isPrimary: { value: true } });
    fireEvent(handle, event);
  };
  pointer("pointerdown", 200, 150);
  pointer("pointermove", 420, 400);
  expect(document.querySelector(".collection-tabs__ghost")).toHaveTextContent("One");
  pointer("pointerup", 420, 400);
  expect(document.querySelector(".collection-tabs__ghost")).not.toBeInTheDocument();
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(dialog("One")).toHaveClass("floating-window--floating", "floating-window--active");
  expect(dialog("One").style.left).toBe("356px");
  expect(dialog("One").style.top).toBe("384px");
  expect(dialog("Two")).toHaveClass("floating-window--floating");
});

it("restores a minimized same-type window when opening another pack", () => {
  render(<Windows autoGroup initialCount={1} />);
  dock("One", "right");
  fireEvent.click(screen.getByRole("button", { name: "Minimize One" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  expect(dialog("Two")).toHaveClass("floating-window--right");
  expect(tab("One")).toBeVisible();
  expect(tab("Two")).toHaveAttribute("aria-selected", "true");
  fireEvent.click(tab("One"));
  expect(dialog("One")).not.toHaveClass("floating-window--minimized");
});

function dragInto(source: string, target: string, cancel = false) {
  const handle = within(dialog(source)).getByRole("button", { name: /^Move/ });
  const targetWindow = dialog(target);
  const bounds = { x: 120, y: 120, left: 120, top: 120, right: 620, bottom: 620, width: 500, height: 500, toJSON() {} };
  vi.spyOn(targetWindow, "getBoundingClientRect").mockReturnValue(bounds);
  const header = targetWindow.querySelector("header");
  if (!header) throw new Error("Missing window header");
  vi.spyOn(header, "getBoundingClientRect").mockReturnValue({ ...bounds, bottom: 170, height: 50 });
  const sourceHeader = dialog(source).querySelector("header");
  if (!sourceHeader) throw new Error("Missing source header");
  sourceHeader.setPointerCapture = vi.fn();
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

it("groups windows explicitly while keeping separate docks and floating packs independent", () => {
  render(<Windows titles={["One", "Two", "Three", "Four", "Five"]} />);
  const one = dialog("One");
  fireEvent.change(within(one).getByLabelText("One state"), { target: { value: "Keep my playlist" } });
  dock("One", "left");
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  dragInto("Two", "One");
  expect(one).not.toHaveAttribute("open");
  expect(screen.getByRole("tablist", { name: "Left docked packs" })).toBeVisible();
  expect(tab("Two")).toHaveAttribute("aria-selected", "true");
  dock("Three", "right");
  dragInto("Four", "Three");
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
  dock("One", "left"); dragInto("Two", "One"); dragInto("Three", "Two");
  expect(tab("Three")).toHaveAttribute("tabindex", "0");
  expect(tab("One")).toHaveAttribute("tabindex", "-1");
  const order = screen.getAllByRole("tab").map((entry) => entry.textContent);
  fireEvent.keyDown(tab("Three"), { key: "End" });
  expect(tab("Three")).toHaveFocus();
  fireEvent.keyDown(tab("Three"), { key: "ArrowRight" });
  expect(tab("One")).toHaveFocus();
  expect(dialog("One")).toBe(one);
  fireEvent.keyDown(tab("One"), { key: "ArrowLeft" });
  expect(tab("Three")).toHaveFocus();
  fireEvent.keyDown(tab("Three"), { key: "Home" });
  expect(tab("One")).toHaveFocus();
  fireEvent.keyDown(tab("One"), { key: "End" });
  expect(tab("Three")).toHaveFocus();
  fireEvent.click(tab("Two"));
  expect(tab("Two")).toHaveFocus();
  expect(dialog("Two")).toBe(two);
  expect(screen.getAllByRole("tab").map((entry) => entry.textContent)).toEqual(order);
  expect(play).not.toHaveBeenCalled();
});

it("retains minimized tab membership while undocking, maximizing and closing detach only the selected pack", () => {
  render(<Windows />);
  dock("One", "left"); dragInto("Two", "One");
  fireEvent.click(screen.getByRole("button", { name: "Minimize Two" }));
  expect(dialog("One")).toHaveClass("floating-window--left");
  expect(screen.getByRole("region", { name: "Minimized group: One" })).toHaveTextContent("1 minimized");
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  expect(screen.getByRole("tablist")).toBeVisible();
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
  dock("One", "left"); dragInto("Two", "One"); dock("Three", "right");
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

it("switches, minimizes and restores mobile windows and restores dock grouping on desktop", () => {
  let mobile = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({ get matches() { return mobile; },
    addEventListener: (_: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_: string, callback: () => void) => listeners.delete(callback) }));
  render(<Windows />);
  dock("One", "right"); dragInto("Two", "One");
  fireEvent.change(screen.getByLabelText("Two state"), { target: { value: "Retained" } });
  act(() => { mobile = true; listeners.forEach((listener) => listener()); });
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(dialog("Two")).toHaveAttribute("aria-modal", "true");
  const switcher = screen.getByRole("tablist", { name: "Open windows" });
  expect(within(switcher).getAllByRole("tab").map((entry) => entry.textContent)).toEqual(["One", "Three", "Two"]);
  fireEvent.click(within(switcher).getByRole("tab", { name: "One" }));
  expect(dialog("One")).toHaveAttribute("aria-modal", "true");
  expect(screen.queryByRole("dialog", { name: "Two" })).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("tablist", { name: "Open windows" })).getByRole("tab", { name: "Two" }));
  fireEvent.click(screen.getByRole("button", { name: "Minimize Two" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const minimizedDock = screen.getByRole("navigation", { name: "Minimized windows" });
  fireEvent.click(within(minimizedDock).getByRole("button", { name: "Restore Two", exact: true }));
  expect(dialog("Two")).toHaveAttribute("aria-modal", "true");
  act(() => { mobile = false; listeners.forEach((listener) => listener()); });
  expect(dialog("Two")).not.toHaveAttribute("aria-modal");
  expect(screen.getByRole("tab", { name: "One", exact: true })).toBeVisible();
  expect(screen.getByRole("tablist")).toBeVisible();
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
  expect(screen.queryByRole("button", { name: "Ungroup One" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Window options for One" }));
  fireEvent.click(screen.getByRole("button", { name: "Ungroup One" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Window options for One" }));
  fireEvent.click(screen.getByRole("button", { name: "Ungroup One" }));
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Open Five" }));
  dragInto("Five", "One");
  expect(screen.getAllByRole("tablist")).toHaveLength(2);
  expect(within(screen.getByRole("dialog", { name: "Five" })).getAllByRole("tab")).toHaveLength(2);
  expect(screen.getAllByRole("tab")).toHaveLength(5);
});

it("styles selected tabs as connected raised content tabs using only semantic roles", () => {
  const css = readFileSync(resolve("src", "molecules", "CollectionTabs", "CollectionTabs.css"), "utf8");
  expect(css).toContain("border-radius: var(--radius-sm) var(--radius-sm) 0 0");
  expect(css).toContain("border: 1px solid var(--window-tab-border)");
  expect(css).toContain("border-bottom: 0");
  expect(css).not.toContain("box-shadow: inset 0 -1px var(--window-tab-border)");
  expect(css).toContain("box-shadow: inset 0 3px var(--window-tab-indicator)");
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(|color-mix\(|var\(--color-/i);
});

it("stacks separate groups and single windows in a dock without merging, and compacts after removal", () => {
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  render(<Windows titles={["One", "Two", "Three", "Four", "Five"]} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Two" }));
  dragInto("Two", "One");
  dock("Two", "left");
  expect(tab("One")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open Four" }));
  dragInto("Four", "Three");
  dock("Four", "left");
  dock("Five", "left");
  expect(screen.getAllByRole("tablist")).toHaveLength(2);
  expect(within(dialog("Two")).getAllByRole("tab").map((entry) => entry.textContent)).toEqual(["One", "Two"]);
  expect(within(dialog("Four")).getAllByRole("tab").map((entry) => entry.textContent)).toEqual(["Three", "Four"]);
  const two = dialog("Two");
  const four = dialog("Four");
  const five = dialog("Five");
  expect(two.style.top).toBe("8px");
  const height = (900 - 16 - 16) / 3;
  expect(Number.parseFloat(four.style.top)).toBeCloseTo(8 + height + 8);
  expect(Number.parseFloat(five.style.top)).toBeCloseTo(8 + 2 * (height + 8));
  for (const entry of [two, four, five]) expect(Number.parseFloat(entry.style.height)).toBeCloseTo(height);
  fireEvent.click(tab("One"));
  expect(dialog("One").style.top).toBe("8px");
  expect(Number.parseFloat(four.style.top)).toBeCloseTo(8 + height + 8);
  fireEvent.click(screen.getByRole("button", { name: "Minimize Five" }));
  expect(dialog("One").style.height).toBe("438px");
  expect(four.style.top).toBe("454px");
  fireEvent.click(screen.getByRole("button", { name: "Close Five" }));
  dock("Four", "right");
  expect(dialog("Four").style.height).toBe("884px");
  expect(dialog("One").style.height).toBe("884px");
  expect(within(dialog("Four")).getAllByRole("tab")).toHaveLength(2);
  act(() => { vi.stubGlobal("innerHeight", 500); window.dispatchEvent(new Event("resize")); });
  expect(dialog("Four").style.height).toBe("484px");
});

it("does not capture a different docked group when merging onto a docked header", () => {
  render(<Windows titles={["One", "Two", "Three", "Four"]} />);
  dock("One", "left"); dock("Two", "left"); dock("Three", "left");
  dragInto("Four", "Two");
  expect(within(dialog("Four")).getAllByRole("tab").map((entry) => entry.textContent)).toEqual(["Two", "Four"]);
  expect(dialog("One")).toHaveClass("floating-window--left");
  expect(dialog("Three")).toHaveClass("floating-window--left");
});

it("drops a whole window group onto a minimized container and Undo restores the previous arrangements", () => {
  const save = vi.fn();
  render(<Windows titles={["One", "Two", "Three", "Four"]} onWorkspaceChange={save} />);
  dragInto("Two", "One"); dragInto("Four", "Three");
  fireEvent.click(screen.getByRole("button", { name: "Window options for Two" }));
  fireEvent.click(screen.getByRole("button", { name: "Minimize group", exact: true }));
  const before = save.mock.calls.at(-1)![0] as WindowWorkspace;
  const target = screen.getByRole("region", { name: "Minimized group: One" });
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
    x: 20, y: 650, left: 20, top: 650, right: 400, bottom: 800, width: 380, height: 150, toJSON() {},
  });
  const header = dialog("Four").querySelector("header")!;
  header.setPointerCapture = vi.fn();
  const pointer = (type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    fireEvent(header, event);
  };
  pointer("pointerdown", 600, 300); pointer("pointermove", 180, 700);
  expect(document.querySelector(".snap-preview--active")).toHaveAttribute("aria-label", "Release to add to group: One");
  pointer("pointercancel", 180, 700);
  expect(screen.getByRole("dialog", { name: "Four" })).toBeVisible();
  pointer("pointerdown", 600, 300); pointer("pointermove", 180, 700); pointer("pointerup", 180, 700);
  fireEvent.click(header);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(target).toHaveTextContent("4 tabs");
  expect(within(target).getAllByRole("button", { name: /^Restore (One|Two|Three|Four)$/ })).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  const after = save.mock.calls.at(-1)![0] as WindowWorkspace;
  for (const entry of before.windows) {
    expect(after.windows.find((item) => item.id === entry.id)).toEqual(expect.objectContaining({
      group: entry.group, minimized: entry.minimized, frame: entry.frame, tabOrder: entry.tabOrder, groupTitle: entry.groupTitle, dockOrder: entry.dockOrder,
    }));
  }
  expect(screen.getByRole("dialog", { name: "Four" })).toBeVisible();
  expect(target).toHaveTextContent("2 tabs");
});

it("drops only a torn-out tab onto a minimized group, leaving its siblings open", () => {
  render(<Windows titles={["One", "Two", "Three", "Four"]} />);
  dragInto("Two", "One"); dragInto("Four", "Three");
  fireEvent.click(screen.getByRole("button", { name: "Window options for Two" }));
  fireEvent.click(screen.getByRole("button", { name: "Minimize group", exact: true }));
  const target = screen.getByRole("region", { name: "Minimized group: One" });
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
    x: 20, y: 650, left: 20, top: 650, right: 400, bottom: 800, width: 380, height: 150, toJSON() {},
  });
  const source = tab("Three");
  source.setPointerCapture = vi.fn();
  const pointer = (type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    fireEvent(source, event);
  };
  pointer("pointerdown", 60, 30); pointer("pointermove", 180, 700);
  expect(document.querySelector(".collection-tabs__ghost")).toHaveTextContent("Release to add to group: One");
  pointer("pointerup", 180, 700);
  expect(dialog("Four")).toBeVisible();
  expect(within(dialog("Four")).queryByRole("tablist")).not.toBeInTheDocument();
  expect(target).toHaveTextContent("3 tabs");
  expect(within(target).getByRole("button", { name: "Restore Three", exact: true })).toBeVisible();
});

it("moves a single tab into a selected group through the mobile menu and offers accessible Undo", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  render(<Windows autoGroup kinds={{ One: "dub", Two: "dub", Three: "sample" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Window options for Three" }));
  fireEvent.click(screen.getByRole("button", { name: "Move to group", exact: true }));
  fireEvent.change(screen.getByRole("combobox", { name: "Destination group" }), {
    target: { value: screen.getByRole("option", { name: "One", exact: true }).getAttribute("value") },
  });
  fireEvent.click(screen.getByRole("button", { name: "Move tab", exact: true }));
  expect(dialog("Three")).toHaveTextContent("3 tabs");
  expect(within(dialog("Three")).getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  expect(dialog("Three").querySelector(".floating-window__group-label")).not.toBeInTheDocument();
});

it("renames a group once and persists keyboard/menu tab ordering without selecting or playing another tab", () => {
  const save = vi.fn();
  const play = vi.fn();
  render(<Windows autoGroup onPlay={play} onWorkspaceChange={save} />);
  expect(save.mock.calls.at(-1)?.[0].windows.map((entry: WindowWorkspace["windows"][number]) => ({ title: entry.groupTitle, group: entry.group })))
    .toEqual([expect.objectContaining({ title: "One" }), expect.objectContaining({ title: "One" }), expect.objectContaining({ title: "One" })]);
  fireEvent.click(screen.getByRole("button", { name: "Window options for Three" }));
  fireEvent.click(screen.getByRole("button", { name: "Rename group", exact: true }));
  fireEvent.change(screen.getByRole("textbox", { name: "Group name" }), { target: { value: "  " } });
  fireEvent.click(screen.getByRole("button", { name: "Save name", exact: true }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a group name");
  fireEvent.change(screen.getByRole("textbox", { name: "Group name" }), { target: { value: "Studio" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name", exact: true }));
  fireEvent.keyDown(tab("Three"), { key: "ArrowLeft", altKey: true });
  expect(screen.getAllByRole("tab").map((entry) => entry.textContent)).toEqual(["One", "Three", "Two"]);
  expect(tab("Three")).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("button", { name: "Window options for Three" }));
  fireEvent.click(screen.getByRole("button", { name: "Move tab left", exact: true }));
  expect(screen.getAllByRole("tab").map((entry) => entry.textContent)).toEqual(["Three", "One", "Two"]);
  fireEvent.click(tab("One"));
  expect(dialog("One").querySelector(".floating-window__group-label")).toHaveTextContent("Studio");
  fireEvent.click(screen.getByRole("button", { name: "Minimize One", exact: true }));
  expect(screen.getByRole("region", { name: "Minimized group: Studio" })).toHaveTextContent("1 minimized");
  const snapshot = save.mock.calls.at(-1)![0] as WindowWorkspace;
  expect([...snapshot.windows].sort((a, b) => a.tabOrder! - b.tabOrder!).map((entry) => entry.groupTitle)).toEqual(["Studio", "Studio", "Studio"]);
  expect(play).not.toHaveBeenCalled();
});

it("does not resurrect a closed tab when undoing an ungroup action", () => {
  const play = vi.fn();
  render(<Windows titles={["One", "Two"]} autoGroup onPlay={play} />);
  fireEvent.click(screen.getByRole("button", { name: "Window options for Two" }));
  fireEvent.click(screen.getByRole("button", { name: "Ungroup Two", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Close Two", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  expect(screen.queryByRole("dialog", { name: "Two", exact: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(dialog("One")).toBeVisible();
  expect(play).not.toHaveBeenCalled();
});

it("expires arrangement Undo after eight seconds", () => {
  vi.useFakeTimers();
  try {
    render(<Windows titles={["One", "Two"]} autoGroup />);
    fireEvent.click(screen.getByRole("button", { name: "Window options for Two" }));
    fireEvent.click(screen.getByRole("button", { name: "Ungroup Two", exact: true }));
    act(() => vi.advanceTimersByTime(7999));
    expect(screen.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("button", { name: "Undo", exact: true })).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});
