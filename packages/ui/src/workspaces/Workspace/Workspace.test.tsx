import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useContext, useState, type ComponentProps } from "react";
import { BrowseChromeContext } from "../../foundations/BrowseChromeContext";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Workspace } from "./Workspace";
import { FloatingWindow } from "../../organisms/Window/Window";
import { workspaceWindows, type SavedWindow, type WindowWorkspace } from "../../organisms/Window/workspace";

beforeEach(() => {
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () {
    if (!this.isConnected) throw new DOMException("Disconnected dialog", "InvalidStateError");
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const frame = { placement: "floating" as const, position: "initial" as const, size: null };
const savedWindow = (id: string, order: number, extra: Partial<SavedWindow> = {}): SavedWindow =>
  ({ id, order, dockOrder: order, title: null, frame, restoreFrame: null, group: null, minimized: false, ...extra });
const layout = (windows: SavedWindow[] = []): WindowWorkspace => ({ version: 1, windows, dockWidths: {}, playerTrackId: null });
const studio = (): WindowWorkspace => ({
  ...layout([savedWindow("pack:root", 1)]), mode: "explorer", explorerIntroduced: true,
  workspaces: [
    { id: "studio", title: "Studio", saved: true, dependencies: [], layout: { ...layout([
      savedWindow("pack:one", 2, { group: "mix", groupTitle: "Production", tabOrder: 1 }),
      savedWindow("track:two", 3, { group: "mix", groupTitle: "Production", tabOrder: 0 }),
      savedWindow("pack:other", 4, { minimized: true }),
    ]), openedDependencies: ["pack:one", "track:two"] } },
    { id: "reference", title: "Reference", saved: true, dependencies: [], layout: layout([savedWindow("pack:reference", 5)]) },
  ],
});
function Harness({ initial, save = vi.fn(), onGroup = vi.fn(), pause = vi.fn(), playing = false, busyWindow, refuseClose, restoreOnEntry = false, restorationReady = true }: {
  initial?: WindowWorkspace; save?: (value: WindowWorkspace) => void; onGroup?: ComponentPropsOnGroup; pause?: () => void; playing?: boolean;
  busyWindow?: string; refuseClose?: string;
  restoreOnEntry?: boolean; restorationReady?: boolean;
}) {
  const [opened, setOpened] = useState(initial ? [...new Set(workspaceWindows(initial).filter((entry) => !entry.id.startsWith("workspace:")).map((entry) => entry.id))] : ["pack:root"]);
  const [stack, setStack] = useState(opened);
  const [requests, setRequests] = useState<Record<string, number>>({});
  const activate = (id: string) => setStack((previous) => [...previous.filter((entry) => entry !== id), id]);
  const open = (id: string) => {
    setOpened((previous) => [...new Set([...previous, id])]); activate(id);
    setRequests((previous) => ({ ...previous, [id]: (previous[id] ?? 0) + 1 }));
  };
  return <Workspace initialWorkspace={initial} onWorkspaceChange={save} activeWindowId={stack.at(-1)} onActiveGroupChange={onGroup}
    restoreOnEntry={restoreOnEntry} restorationReady={restorationReady}
    featureWindows={{ stack, onActivate: activate }}
    dependencies={["pack:root", "pack:one", "track:two", "track:new", "pack:other", "pack:reference", "pack:new"].map((id) => ({ id, title: id, onOpen: () => open(id) }))}>
    <button onClick={() => open("pack:new")}>New app window</button>
    <button onClick={() => open("pack:other")}>Open other app window</button>
    {opened.map((id) => <FloatingWindow key={id} windowId={id} title={id} kind={id.startsWith("track:") ? "sample" : "dub"}
      order={Math.max(0, stack.indexOf(id))} active={stack.at(-1) === id} onActivate={() => activate(id)} openRequest={requests[id] ?? 0}
      playback={id === "pack:one" ? { isPlaying: playing, onToggle: pause, trackTitle: "Track" } : undefined}
      closeDisabled={id === busyWindow} onClose={() => { if (id !== refuseClose) setOpened((previous) => previous.filter((entry) => entry !== id)); }}>
      <label>{id} draft<input defaultValue="Keep my draft" /></label>
    </FloatingWindow>)}
  </Workspace>;
}
type ComponentPropsOnGroup = NonNullable<ComponentProps<typeof Workspace>["onActiveGroupChange"]>;
const explorer = () => screen.getByRole("navigation", { name: "Workspace Explorer", exact: true });
function browse(title: string) {
  if (!screen.queryByRole("navigation", { name: "Workspace Explorer", exact: true })) workspaces();
  const back = within(explorer()).queryByRole("button", { name: "Back to workspaces" });
  if (back) fireEvent.click(back);
  fireEvent.click(within(explorer()).getByRole("button", { name: `Manage workspace: ${title}`, exact: true }));
}
function openSelected() { fireEvent.click(within(explorer()).getByRole("button", { name: "Open Workspace", exact: true })); }
function workspaces() { fireEvent.click(screen.getByRole("button", { name: "Workspaces", exact: true })); }

it("starts mobile workspace controls minimized and keeps manual state independent of browsing and focus", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  function BrowseControls() {
    const browse = useContext(BrowseChromeContext)!;
    return <><button onClick={() => browse.setCompact(true)}>Browse down</button><button onClick={() => browse.setCompact(false)}>Browse up</button></>;
  }
  render(<Workspace initialWorkspace={{ ...layout(), mode: "simple" }}><BrowseControls /></Workspace>);
  const toggle = () => screen.getByRole("button", { name: /^(Show|Minimize) window manager$/ });
  expect(screen.queryByRole("navigation", { name: "Workspace Explorer", exact: true })).not.toBeInTheDocument();
  expect(toggle()).toHaveAttribute("aria-expanded", "false");
  screen.getByRole("button", { name: "Browse down" }).focus();
  expect(toggle()).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle());
  expect(toggle()).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Browse down" }));
  expect(toggle()).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Browse up" }));
  expect(toggle()).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(toggle());
  fireEvent.click(screen.getByRole("button", { name: "Browse down" }));
  fireEvent.click(screen.getByRole("button", { name: "Browse up" }));
  expect(toggle()).toHaveAttribute("aria-expanded", "false");
});

it("does not collapse mobile workspace naming while browsing", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  function BrowseDown() {
    const browse = useContext(BrowseChromeContext)!;
    return <button onClick={() => browse.setCompact(true)}>Browse down</button>;
  }
  render(<Workspace initialWorkspace={{ ...layout(), mode: "simple" }}><BrowseDown /></Workspace>);
  fireEvent.click(screen.getByRole("button", { name: "Show window manager" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Workspace", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Browse down" }));
  expect(screen.getByRole("textbox", { name: "Workspace name" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Show workspace controls" })).not.toBeInTheDocument();
});

it.each([390, 1440])("groups manager entries by media with clear headers without splitting mixed tabs at %ipx", (width) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", () => ({ matches: width <= 760, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const entries = [
    { id: "vocal", kind: "vocal" },
    { id: "dub-one", kind: "dub" },
    { id: "sample", kind: "sample" },
    { id: "mixed-dub", kind: "dub" },
    { id: "mixed-vocal", kind: "vocal" },
    { id: "chat", kind: "conversation" },
    { id: "dub-two", kind: "dub" },
  ];
  const initial: WindowWorkspace = { ...layout(entries.map((entry, order) => savedWindow(entry.id, order, {
    ...(entry.id.startsWith("mixed-") ? { group: "mixed", groupTitle: "Production" } : {}),
    minimized: entry.id === "dub-two",
  }))), mode: "simple" };
  function MediaManager() {
    const [opened, setOpened] = useState(entries);
    return <Workspace initialWorkspace={initial}>
      {opened.map((entry, order) => <FloatingWindow key={entry.id} windowId={entry.id} title={entry.id} kind={entry.kind}
        active={false} order={order} onActivate={vi.fn()} onClose={() => setOpened((current) => current.filter((item) => item.id !== entry.id))}>
        Content
      </FloatingWindow>)}
    </Workspace>;
  }
  render(<MediaManager />);
  if (width > 760) fireEvent.click(within(explorer()).getByRole("button", { name: "Minimize Workspace Explorer" }));
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  const show = within(manager).queryByRole("button", { name: "Show window manager" });
  if (show) fireEvent.click(show);
  expect(within(manager).getAllByRole("heading", { level: 3 }).map((entry) => entry.textContent)).toEqual(["Dubs", "Samples", "Vocals", "Mixed & other windows"]);
  const dubs = within(manager).getByRole("list", { name: "Dubs windows" });
  expect(within(dubs).getByRole("button", { name: "Focus dub-one", exact: true })).toBeVisible();
  expect(within(dubs).getByRole("button", { name: "Restore dub-two", exact: true })).toBeVisible();
  expect(within(dubs).queryByRole("button", { name: "Focus mixed-dub", exact: true })).not.toBeInTheDocument();
  expect(within(within(manager).getByRole("list", { name: "Samples windows" })).getByRole("button", { name: "Focus sample", exact: true })).toBeVisible();
  const vocals = within(manager).getByRole("list", { name: "Vocals windows" });
  expect(within(vocals).getByRole("button", { name: "Focus vocal", exact: true })).toBeVisible();
  const other = within(manager).getByRole("list", { name: "Mixed & other windows" });
  expect(within(other).getByRole("button", { name: "Focus group: Production", exact: true })).toBeVisible();
  expect(within(other).getByRole("button", { name: "Focus mixed-dub", exact: true })).toBeVisible();
  expect(within(other).getByRole("button", { name: "Focus mixed-vocal", exact: true })).toBeVisible();
  expect(within(other).getByRole("button", { name: "Focus chat", exact: true })).toBeVisible();
  fireEvent.click(within(vocals).getByRole("button", { name: "Window options for vocal", exact: true }));
  fireEvent.click(within(screen.getByRole("group", { name: "Window options for vocal", exact: true })).getByRole("button", { name: "Close vocal", exact: true }));
  expect(within(manager).queryByRole("heading", { name: "Vocals", exact: true })).not.toBeInTheDocument();
});

it.each([390, 1440])("starts a Draft on the first app window request with no loaded workspace at %ipx", (width) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: width <= 760, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const initial = { ...studio(), windows: [], activeWorkspaceId: null, viewedWorkspaceId: "studio" };
  const save = vi.fn();
  render(<Harness initial={initial} save={save} restoreOnEntry />);
  expect(screen.queryByRole("dialog", { name: "pack:new", exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "New app window", exact: true }));
  expect(screen.getByRole("dialog", { name: "pack:new", exact: true })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Load previous workspace/ })).not.toBeInTheDocument();
  const value = save.mock.lastCall![0] as WindowWorkspace;
  expect(value.activeWorkspaceId).toBe("");
  expect(value.viewedWorkspaceId).toBe("");
  expect(value.windows.map((entry) => entry.id)).toEqual(["pack:new"]);
  expect(value.workspaces!.find((record) => record.id === "studio")!.layout.windows.map((entry) => entry.id)).toEqual(initial.workspaces![0].layout.windows.map((entry) => entry.id));
});

it("starts Draft rather than adding an app window to a saved workspace being inspected", () => {
  const save = vi.fn();
  render(<Harness initial={studio()} save={save} />);
  browse("Reference");
  fireEvent.click(screen.getByRole("button", { name: "New app window", exact: true }));
  expect(screen.getByRole("dialog", { name: "pack:new", exact: true })).toBeVisible();
  const value = save.mock.lastCall![0] as WindowWorkspace;
  expect(value.activeWorkspaceId).toBe("");
  expect(value.windows.some((entry) => entry.id === "pack:new")).toBe(true);
  expect(value.workspaces!.some((record) => record.layout.windows.some((entry) => entry.id === "pack:new"))).toBe(false);
});

it("starts at Draft dependencies and browses flat top-level workspaces without floating containers", () => {
  render(<Harness initial={studio()} />);
  expect(within(explorer()).getByRole("heading", { name: "Draft Workspace" })).toBeVisible();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Back to workspaces" }));
  expect(within(explorer()).getByRole("heading", { name: "Workspaces" })).toBeVisible();
  for (const title of ["Draft Workspace", "Studio", "Reference"]) expect(within(explorer()).getByRole("button", { name: `Open workspace: ${title}` })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Window manager" })).not.toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "Workspace and player" })).toContainElement(explorer());
  expect(explorer()).not.toHaveClass("workspace-explorer--maximized");
});

it("keeps explorer navigation inside its header and restores launcher focus when minimized", () => {
  render(<Harness initial={studio()} />);
  expect(screen.queryByRole("button", { name: "Workspaces", exact: true })).not.toBeInTheDocument();
  browse("Studio");
  expect(within(explorer()).getByRole("button", { name: "Back to workspaces" })).toBeVisible();
  expect(within(explorer()).queryByRole("navigation", { name: "Workspace location" })).not.toBeInTheDocument();
  expect(within(explorer()).getByRole("button", { name: "Open Workspace", exact: true })).toBeVisible();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Back to workspaces" }));
  expect(within(explorer()).getByRole("heading", { name: "Workspaces" })).toBeVisible();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Minimize Workspace Explorer" }));
  expect(screen.getByRole("button", { name: "Workspaces", exact: true })).toHaveFocus();
  workspaces();
  expect(explorer()).toBeVisible();
});

it("keeps content management separate and opens all workspace groups together", () => {
  render(<Harness initial={studio()} />);
  browse("Studio");
  expect(within(explorer()).getByRole("heading", { name: "Studio" })).toBeVisible();
  expect(within(explorer()).queryByRole("checkbox")).not.toBeInTheDocument();
  expect(within(explorer()).getByText("Production", { exact: true })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(within(explorer()).getAllByRole("img", { name: "Hidden", exact: true })).toHaveLength(2);
  openSelected();
  expect(screen.queryByRole("navigation", { name: "Workspace Explorer", exact: true })).not.toBeInTheDocument();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  expect(within(manager).getByRole("button", { name: "Focus group: Production" })).toBeVisible();
  expect(within(manager).getByRole("button", { name: "Focus group: Production" }).querySelector(".button__icon")).toBeNull();
  const visibleIcon = within(manager).getAllByRole("img", { name: "Visible (selected)", exact: true })[0];
  const visiblePath = visibleIcon.querySelector("path")?.getAttribute("d");
  expect(within(manager).getByRole("button", { name: "Focus pack:other", exact: true })).toBeVisible();
  expect(screen.getAllByRole("dialog").every((entry) => !entry.getAttribute("aria-label")?.startsWith("Workspace:"))).toBe(true);
  fireEvent.pointerDown(screen.getByRole("button", { name: "New app window" }));
  const hiddenIcon = within(manager).getAllByRole("img", { name: "Hidden", exact: true })[0];
  expect(hiddenIcon.querySelector("path")?.getAttribute("d")).not.toBe(visiblePath);
});

it("opens a workspace directly from Explorer without a dependency selection step", () => {
  render(<Harness initial={studio()} />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Back to workspaces" }));
  fireEvent.click(within(explorer()).getByRole("button", { name: "Open workspace: Studio", exact: true }));
  expect(screen.queryByRole("navigation", { name: "Workspace Explorer", exact: true })).not.toBeInTheDocument();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  expect(within(manager).getByRole("heading", { name: "Studio" })).toBeVisible();
  expect(within(manager).getByRole("button", { name: "Focus group: Production" })).toBeVisible();
  expect(within(manager).getByRole("button", { name: "Focus pack:other", exact: true })).toBeVisible();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

it("clears the running manager on workspace switch, pauses audio and preserves live drafts and arrangement", async () => {
  const pause = vi.fn(); const save = vi.fn();
  render(<Harness initial={studio()} pause={pause} save={save} playing />);
  browse("Studio"); openSelected();
  const draft = screen.getByLabelText("track:two draft");
  fireEvent.change(draft, { target: { value: "Live edit" } });
  workspaces(); browse("Reference");
  expect(pause).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("navigation", { name: "Window manager" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  openSelected();
  expect(screen.getByRole("dialog", { name: "pack:reference", exact: true })).toBeVisible();
  expect(screen.queryByRole("dialog", { name: "track:two", exact: true })).not.toBeInTheDocument();
  workspaces(); browse("Studio"); openSelected();
  expect(screen.getByLabelText("track:two draft")).toBe(draft);
  expect(draft).toHaveValue("Live edit");
  await waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ workspaces: expect.arrayContaining([
    expect.objectContaining({ id: "studio", layout: expect.objectContaining({ windows: expect.arrayContaining([
      expect.objectContaining({ id: "track:two", groupTitle: "Production", tabOrder: 0 }),
      expect.objectContaining({ id: "pack:one", groupTitle: "Production", tabOrder: 1 }),
    ]) }) }),
  ]) })));
});

it("opens all dependencies instead of retaining a legacy subset", async () => {
  const save = vi.fn(); render(<Harness initial={studio()} save={save} />);
  browse("Studio");
  openSelected();
  workspaces(); browse("Studio");
  expect(within(explorer()).queryByRole("checkbox")).not.toBeInTheDocument();
  await waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ workspaces: expect.arrayContaining([
    expect.objectContaining({ id: "studio", layout: expect.objectContaining({ openedDependencies: expect.arrayContaining(["pack:one", "track:two", "pack:other"]) }) }),
  ]) })));
});

it("keeps unavailable closed dependencies in the directory and reports inability to open them", () => {
  const initial = { ...layout(), mode: "explorer" as const, workspaces: [
    { id: "missing", title: "Missing", saved: true, dependencies: [], layout: layout([savedWindow("pack:unavailable", 1, { title: "Unavailable" })]) },
  ] };
  render(<Workspace initialWorkspace={initial}><main>App</main></Workspace>);
  browse("Missing"); openSelected();
  expect(within(explorer()).getByRole("alert")).toHaveTextContent("Some workspace windows are unavailable");
  expect(within(explorer()).getByText("Unavailable", { exact: true })).toBeVisible();
});

it("keeps dependencies after closing a window and reopens them without duplication", async () => {
  const save = vi.fn(); render(<Harness initial={studio()} save={save} />);
  browse("Reference"); openSelected();
  fireEvent.click(within(screen.getByRole("dialog", { name: "pack:reference" })).getByRole("button", { name: "Close pack:reference" }));
  workspaces(); browse("Reference");
  expect(within(explorer()).getByText("pack:reference", { exact: true, selector: "strong" })).toBeVisible();
  openSelected();
  expect(screen.getAllByRole("dialog", { name: "pack:reference" })).toHaveLength(1);
  await waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ workspaces: expect.arrayContaining([
    expect.objectContaining({ id: "reference", layout: expect.objectContaining({ windows: [expect.objectContaining({ id: "pack:reference" })] }) }),
  ]) })));
});

it("starts Simple mode directly in Draft and introduces Explorer before enabling it", () => {
  render(<Harness />);
  expect(screen.getByRole("dialog", { name: "pack:root" })).toBeVisible();
  expect(within(explorer()).getByRole("heading", { name: "Draft Workspace" })).toBeVisible();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Minimize Workspace Explorer" }));
  fireEvent.click(screen.getByRole("button", { name: "Explorer", exact: true }));
  expect(within(explorer()).getByRole("heading", { name: "Choose how you work" })).toBeVisible();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Enable Explorer" }));
  expect(within(explorer()).getByRole("button", { name: "Open workspace: Draft Workspace" })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("switches modes without discarding independent drafts or saved dependency membership", () => {
  render(<Harness initial={studio()} />);
  browse("Studio"); openSelected();
  const draft = screen.getByLabelText("track:two draft");
  fireEvent.change(draft, { target: { value: "Preserved" } });
  workspaces();
  fireEvent.click(within(explorer()).getByText("Explorer settings"));
  fireEvent.click(within(explorer()).getByRole("button", { name: "Simple mode (off)" }));
  expect(screen.getByRole("dialog", { name: "pack:root" })).toBeVisible();
  expect(screen.queryByRole("dialog", { name: "track:two" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Explorer", exact: true }));
  fireEvent.click(within(explorer()).getByText("Explorer settings"));
  fireEvent.click(within(explorer()).getByRole("button", { name: "Simple mode (on)" }));
  browse("Studio"); openSelected();
  expect(screen.getByLabelText("track:two draft")).toBe(draft);
  expect(draft).toHaveValue("Preserved");
});

it("creates top-level workspaces without a floating shell and permits adding dependencies before opening", async () => {
  const save = vi.fn(); render(<Harness initial={studio()} save={save} />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Back to workspaces" }));
  fireEvent.change(within(explorer()).getByLabelText("New workspace name"), { target: { value: "New studio" } });
  fireEvent.click(within(explorer()).getByRole("button", { name: "Create workspace" }));
  expect(within(screen.getByRole("navigation", { name: "Window manager" })).getByRole("heading", { name: "New studio" })).toBeVisible();
  workspaces(); browse("New studio");
  expect(within(explorer()).getByRole("heading", { name: "New studio" })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.change(within(explorer()).getByLabelText("Add dependency"), { target: { value: "pack:new" } });
  fireEvent.click(within(explorer()).getByRole("button", { name: "Add dependency" }));
  await waitFor(() => expect(within(explorer()).getByText("pack:new", { exact: true, selector: "strong" })).toBeVisible());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  openSelected();
  expect(screen.getByRole("dialog", { name: "pack:new" })).toBeVisible();
});

it("separates content and naming controls and cancels renaming without changing the saved title", () => {
  render(<Harness initial={studio()} />);
  browse("Studio");
  expect(within(explorer()).getByText("Add content").closest("details")).not.toHaveAttribute("open");
  fireEvent.click(within(explorer()).getByText("Add content"));
  expect(within(explorer()).getByRole("form", { name: "Add workspace content" })).toBeVisible();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Rename workspace" }));
  const input = within(explorer()).getByLabelText("Workspace name");
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "Not saved" } });
  fireEvent.click(within(explorer()).getByRole("button", { name: "Cancel", exact: true }));
  expect(within(explorer()).getByRole("heading", { name: "Studio" })).toBeVisible();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Rename workspace" }));
  fireEvent.change(within(explorer()).getByLabelText("Workspace name"), { target: { value: "Renamed studio" } });
  fireEvent.click(within(explorer()).getByRole("button", { name: "Save", exact: true }));
  expect(within(explorer()).getByRole("heading", { name: "Renamed studio" })).toBeVisible();
});

it("replaces window editing with save and delete actions and preserves collapse and restore", () => {
  render(<Harness initial={studio()} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  expect(within(manager).getByRole("list", { name: "Open workspace windows" })).toBeVisible();
  expect(within(manager).queryByRole("button", { name: "Choose dependencies" })).not.toBeInTheDocument();
  expect(within(manager).getByRole("button", { name: "Save Workspace", exact: true })).toBeVisible();
  expect(within(manager).getByRole("button", { name: "Delete Workspace", exact: true })).toBeEnabled();
  fireEvent.click(within(manager).getByRole("button", { name: "Minimize window manager" }));
  expect(within(manager).queryByRole("list")).not.toBeInTheDocument();
  expect(within(manager).queryByRole("button", { name: "Save Workspace", exact: true })).not.toBeInTheDocument();
  fireEvent.click(within(manager).getByRole("button", { name: "Show window manager" }));
  expect(within(manager).getByRole("button", { name: "Delete Workspace", exact: true })).toBeVisible();
});

it("saves a named workspace without closing its windows or changing its drafts", () => {
  const save = vi.fn();
  render(<Harness initial={studio()} save={save} />);
  browse("Studio"); openSelected();
  const draft = screen.getByLabelText("track:two draft");
  fireEvent.change(draft, { target: { value: "Working draft" } });
  save.mockClear();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Window manager" })).getByRole("button", { name: "Save Workspace", exact: true }));
  expect(save).toHaveBeenCalled();
  expect(save.mock.lastCall![0].workspaces.find((entry: { id: string }) => entry.id === "studio")).toMatchObject({ title: "Studio", saved: true });
  expect(screen.getByLabelText("track:two draft")).toBe(draft);
  expect(draft).toHaveValue("Working draft");
  expect(screen.queryByRole("navigation", { name: "Workspace Explorer", exact: true })).not.toBeInTheDocument();
});

it("names and saves a running Simple Draft without hiding or recreating its windows", () => {
  const save = vi.fn();
  render(<Harness initial={{ ...layout([savedWindow("pack:root", 1)]), mode: "simple" }} save={save} />);
  openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  const draft = screen.getByLabelText("pack:root draft");
  expect(within(manager).getByRole("button", { name: "Delete Workspace", exact: true })).toBeDisabled();
  fireEvent.click(within(manager).getByRole("button", { name: "Save Workspace", exact: true }));
  expect(within(manager).getByLabelText("Workspace name")).toHaveFocus();
  fireEvent.click(within(manager).getByRole("button", { name: "Save", exact: true }));
  expect(within(manager).getByRole("alert")).toHaveTextContent("Enter a workspace name.");
  fireEvent.change(within(manager).getByLabelText("Workspace name"), { target: { value: "My session" } });
  fireEvent.click(within(manager).getByRole("button", { name: "Save", exact: true }));
  const savedManager = screen.getByRole("navigation", { name: "Window manager" });
  expect(within(savedManager).getByRole("heading", { name: "My session" })).toBeVisible();
  expect(within(savedManager).getByRole("button", { name: "Delete Workspace", exact: true })).toBeEnabled();
  expect(screen.getByLabelText("pack:root draft")).toBe(draft);
  expect(save.mock.lastCall![0]).toMatchObject({ mode: "explorer", windows: [], workspaces: [{ title: "My session", saved: true }] });
});

it("confirms deletion, closes hidden and visible windows, and preserves other workspaces", async () => {
  const save = vi.fn(); const pause = vi.fn();
  render(<Harness initial={studio()} save={save} playing pause={pause} />);
  browse("Studio"); openSelected(); pause.mockClear();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Delete Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Cancel", exact: true }));
  expect(screen.getByLabelText("pack:one draft")).toBeInTheDocument();
  fireEvent.click(within(manager).getByRole("button", { name: "Delete Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Confirm deletion", exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Draft Workspace" })).toBeVisible());
  for (const id of ["pack:one", "track:two", "pack:other"]) expect(screen.queryByLabelText(`${id} draft`)).not.toBeInTheDocument();
  expect(screen.getByLabelText("pack:root draft")).toBeInTheDocument();
  expect(screen.getByLabelText("pack:reference draft")).toBeInTheDocument();
  expect(pause).toHaveBeenCalled();
  const value = save.mock.lastCall![0] as WindowWorkspace;
  expect(value.workspaces!.map((entry) => entry.id)).toEqual(["reference"]);
  expect(value.viewedWorkspaceId).toBe("");
  expect(workspaceWindows(value).map((entry) => entry.id).sort()).toEqual(["pack:reference", "pack:root"]);
});

it("blocks deletion while any dependency is busy", () => {
  render(<Harness initial={studio()} busyWindow="pack:other" />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Delete Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Confirm deletion", exact: true }));
  expect(within(manager).getByRole("alert")).toHaveTextContent("Wait for busy windows");
  for (const id of ["pack:one", "track:two", "pack:other"]) expect(screen.getByLabelText(`${id} draft`)).toBeInTheDocument();
});

it("deletes an unopened workspace from Explorer while preserving the running workspace", async () => {
  const save = vi.fn(); const pause = vi.fn();
  render(<Harness initial={studio()} save={save} pause={pause} playing />);
  browse("Studio"); openSelected(); pause.mockClear(); workspaces();
  expect(within(explorer()).queryByRole("button", { name: "Delete workspace: Draft Workspace" })).not.toBeInTheDocument();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Delete workspace: Reference" }));
  expect(within(explorer()).getByRole("region", { name: "Delete workspace" })).toHaveTextContent("Delete Reference");
  fireEvent.click(within(explorer()).getByRole("button", { name: "Cancel", exact: true }));
  expect(within(explorer()).getByRole("button", { name: "Open workspace: Reference" })).toBeVisible();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Delete workspace: Reference" }));
  fireEvent.click(within(explorer()).getByRole("button", { name: "Confirm deletion", exact: true }));
  await waitFor(() => expect(within(explorer()).queryByRole("button", { name: "Open workspace: Reference" })).not.toBeInTheDocument());
  expect(screen.queryByLabelText("pack:reference draft")).not.toBeInTheDocument();
  expect(screen.getByLabelText("track:two draft")).toBeInTheDocument();
  expect(pause).not.toHaveBeenCalled();
  expect((save.mock.lastCall![0] as WindowWorkspace).workspaces!.map((entry) => entry.id)).toEqual(["studio"]);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Minimize Workspace Explorer" }));
  expect(within(screen.getByRole("navigation", { name: "Window manager" })).getByRole("heading", { name: "Studio" })).toBeVisible();
});

it("deletes an empty workspace from its management viewer without opening it", async () => {
  const initial = studio(); initial.workspaces![1].layout = layout();
  render(<Harness initial={initial} />);
  browse("Reference");
  fireEvent.click(within(explorer()).getByRole("button", { name: "Delete Workspace", exact: true }));
  fireEvent.click(within(explorer()).getByRole("button", { name: "Confirm deletion", exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Draft Workspace" })).toBeVisible());
  fireEvent.click(within(explorer()).getByRole("button", { name: "Back to workspaces" }));
  expect(within(explorer()).queryByRole("button", { name: "Open workspace: Reference" })).not.toBeInTheDocument();
});

it("surfaces busy deletion and editor close guards in Explorer", () => {
  const initial = studio();
  const app = render(<Harness initial={initial} busyWindow="pack:other" refuseClose="track:two" />);
  browse("Studio");
  fireEvent.click(within(explorer()).getByRole("button", { name: "Delete Workspace", exact: true }));
  fireEvent.click(within(explorer()).getByRole("button", { name: "Confirm deletion", exact: true }));
  expect(within(explorer()).getByRole("alert")).toHaveTextContent("Wait for busy windows");
  app.rerender(<Harness initial={initial} refuseClose="track:two" />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Confirm deletion", exact: true }));
  expect(within(explorer()).getByRole("status")).toHaveTextContent("Close the remaining windows");
  fireEvent.click(within(explorer()).getByRole("button", { name: "Show windows", exact: true }));
  expect(screen.getByRole("dialog", { name: "track:two", exact: true })).toBeVisible();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Cancel deletion" }));
  expect(within(manager).getByRole("button", { name: "Delete Workspace", exact: true })).toBeEnabled();
});

it("retains the saved workspace if an editor refuses to close and allows cancelling deletion", () => {
  const save = vi.fn();
  render(<Harness initial={studio()} save={save} refuseClose="track:two" />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Delete Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Confirm deletion", exact: true }));
  expect(within(manager).getByRole("status")).toHaveTextContent("Close the remaining windows");
  expect(save.mock.lastCall![0].workspaces.some((entry: { id: string }) => entry.id === "studio")).toBe(true);
  expect(screen.getByLabelText("track:two draft")).toBeInTheDocument();
  fireEvent.click(within(manager).getByRole("button", { name: "Cancel deletion" }));
  expect(within(manager).getByRole("button", { name: "Delete Workspace", exact: true })).toBeEnabled();
});

it("collapses grouped windows as folder rows without changing their open state", () => {
  render(<Harness initial={studio()} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  const draft = screen.getByLabelText("track:two draft");
  const toggle = within(manager).getByRole("button", { name: "Collapse tabs in Production" });
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(toggle);
  expect(within(manager).queryByRole("button", { name: "Focus track:two", exact: true })).not.toBeInTheDocument();
  expect(screen.getByLabelText("track:two draft")).toBe(draft);
  fireEvent.click(within(manager).getByRole("button", { name: "Expand tabs in Production" }));
  expect(within(manager).getByRole("button", { name: "Focus track:two", exact: true })).toBeVisible();
});

it("offers Save, Discard and Cancel when closing, and cancellation keeps windows open", () => {
  render(<Harness initial={studio()} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  expect(within(manager).getByRole("button", { name: "Save", exact: true })).toBeVisible();
  expect(within(manager).getByRole("button", { name: "Discard", exact: true })).toBeVisible();
  fireEvent.click(within(manager).getByRole("button", { name: "Cancel", exact: true }));
  expect(screen.getByLabelText("track:two draft")).toBeInTheDocument();
  expect(within(manager).getByRole("button", { name: "Close Workspace", exact: true })).toBeVisible();
});

it("closes immediately after Save and keeps the saved checkpoint separate from recovery changes", async () => {
  const save = vi.fn();
  render(<Harness initial={studio()} save={save} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Save Workspace", exact: true }));
  expect(within(manager).getByRole("status")).toHaveTextContent("All workspace changes saved");
  const checkpoint = (save.mock.lastCall![0] as WindowWorkspace).workspaces![0].savedLayout;
  expect(checkpoint).toEqual((save.mock.lastCall![0] as WindowWorkspace).workspaces![0].layout);
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Studio" })).toBeVisible());
  expect(screen.queryByRole("button", { name: "Discard", exact: true })).not.toBeInTheDocument();
  expect((save.mock.lastCall![0] as WindowWorkspace).workspaces![0].savedLayout).toEqual(checkpoint);
});

it("discards to the most recent Save, not the opening arrangement or an earlier Save", async () => {
  const save = vi.fn();
  render(<Harness initial={studio()} save={save} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  const saveNow = () => fireEvent.click(within(manager).getByRole("button", { name: "Save Workspace", exact: true }));
  saveNow();
  fireEvent.click(screen.getByRole("button", { name: "New app window" }));
  expect(within(manager).getByRole("status")).toHaveTextContent("Unsaved workspace changes");
  saveNow();
  const checkpoint = (save.mock.lastCall![0] as WindowWorkspace).workspaces![0].savedLayout!;
  expect(checkpoint.windows.some((entry) => entry.id === "pack:new")).toBe(true);
  fireEvent.click(within(manager).getByRole("button", { name: "Minimize group: Production" }));
  expect(within(manager).getByRole("status")).toHaveTextContent("Unsaved workspace changes");
  expect((save.mock.lastCall![0] as WindowWorkspace).workspaces![0].savedLayout).toEqual(checkpoint);
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Discard", exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Studio" })).toBeVisible());
  expect((save.mock.lastCall![0] as WindowWorkspace).workspaces![0].layout).toEqual(checkpoint);
});

it("clears the dirty state when a layout change is undone without saving again", () => {
  render(<Harness initial={studio()} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Save Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Minimize group: Production" }));
  expect(within(manager).getByRole("status")).toHaveTextContent("Unsaved workspace changes");
  fireEvent.click(within(manager).getByRole("button", { name: "Restore group: Production" }));
  expect(within(manager).getByRole("status")).toHaveTextContent("All workspace changes saved");
});

it("tracks frame changes against the last Save while ignoring focus and audio playback", () => {
  const initial = studio(); const pause = vi.fn();
  render(<Harness initial={initial} pause={pause} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Save Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Focus track:two", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Play audio in Production group", exact: true }));
  expect(pause).toHaveBeenCalledOnce();
  expect(within(manager).getByRole("status")).toHaveTextContent("All workspace changes saved");
  const dialog = screen.getByRole("dialog", { name: "track:two", exact: true });
  fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "left" } });
  expect(within(manager).getByRole("status")).toHaveTextContent("Unsaved workspace changes");
  fireEvent.click(within(manager).getByRole("button", { name: "Save Workspace", exact: true }));
  expect(within(manager).getByRole("status")).toHaveTextContent("All workspace changes saved");
});

it("does not prompt after reloading an unchanged saved workspace", () => {
  const save = vi.fn();
  const app = render(<Harness initial={studio()} save={save} />);
  browse("Studio"); openSelected();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Window manager" })).getByRole("button", { name: "Save Workspace", exact: true }));
  const saved = save.mock.lastCall![0] as WindowWorkspace;
  app.unmount();
  render(<Harness initial={saved} save={save} restoreOnEntry />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Load previous workspace: Studio" }));
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  expect((save.mock.lastCall![0] as WindowWorkspace).workspaces![0].layout).toEqual(saved.workspaces![0].savedLayout);
  expect(within(manager).getByRole("status")).toHaveTextContent("All workspace changes saved");
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  expect(screen.queryByRole("button", { name: "Discard", exact: true })).not.toBeInTheDocument();
});

it("retains a saved Draft checkpoint after ownership migration and closes it without prompting", async () => {
  const save = vi.fn();
  render(<Harness initial={{ ...layout([savedWindow("pack:root", 1)]), mode: "simple" }} save={save} />);
  openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Save Workspace", exact: true }));
  fireEvent.change(within(manager).getByLabelText("Workspace name"), { target: { value: "Checkpoint" } });
  fireEvent.click(within(manager).getByRole("button", { name: "Save", exact: true }));
  expect(within(manager).getByRole("status")).toHaveTextContent("All workspace changes saved");
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Checkpoint" })).toBeVisible());
  expect((save.mock.lastCall![0] as WindowWorkspace).workspaces![0].savedLayout!.windows).toHaveLength(1);
});

it("closes a pristine empty named workspace without a discard prompt", async () => {
  const initial = studio();
  initial.workspaces![0].layout = layout();
  render(<Harness initial={initial} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  expect(within(manager).getByRole("status")).toHaveTextContent("All workspace changes saved");
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Studio" })).toBeVisible());
  expect(screen.queryByRole("button", { name: "Discard", exact: true })).not.toBeInTheDocument();
});

it("still respects busy and editor close guards when there are no unsaved workspace changes", () => {
  const initial = studio();
  const { rerender } = render(<Harness initial={initial} busyWindow="pack:other" refuseClose="track:two" />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Save Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  expect(within(manager).getByRole("alert")).toHaveTextContent("Wait for busy windows");
  expect(within(manager).queryByRole("button", { name: "Discard", exact: true })).not.toBeInTheDocument();
  rerender(<Harness initial={initial} refuseClose="track:two" />);
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  expect(within(manager).getByRole("status")).toHaveTextContent("Close the remaining windows");
  expect(screen.getByLabelText("track:two draft")).toBeInTheDocument();
});

it("recovers unsaved layout changes after remount and discards to the persisted last Save", async () => {
  const save = vi.fn();
  const app = render(<Harness initial={studio()} save={save} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Save Workspace", exact: true }));
  const checkpoint = (save.mock.lastCall![0] as WindowWorkspace).workspaces![0].savedLayout!;
  fireEvent.click(screen.getByRole("button", { name: "New app window" }));
  const recovery = save.mock.lastCall![0] as WindowWorkspace;
  expect(recovery.workspaces![0].layout.windows.some((entry) => entry.id === "pack:new")).toBe(true);
  expect(recovery.workspaces![0].savedLayout).toEqual(checkpoint);
  app.unmount();
  render(<Harness initial={recovery} save={save} restoreOnEntry />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Load previous workspace: Studio" }));
  const restored = screen.getByRole("navigation", { name: "Window manager" });
  expect(screen.getByLabelText("pack:new draft")).toBeInTheDocument();
  expect(within(restored).getByRole("status")).toHaveTextContent("Unsaved workspace changes");
  fireEvent.click(within(restored).getByRole("button", { name: "Close Workspace", exact: true }));
  fireEvent.click(within(restored).getByRole("button", { name: "Discard", exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Studio" })).toBeVisible());
  expect((save.mock.lastCall![0] as WindowWorkspace).workspaces![0].layout).toEqual(checkpoint);
});

it.each(["Save", "Discard"])("closes a named workspace with %s and persists the correct layout", async (action) => {
  const save = vi.fn();
  render(<Harness initial={studio()} save={save} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Minimize group: Production" }));
  expect((save.mock.lastCall![0] as WindowWorkspace).workspaces![0].layout.windows.find((entry) => entry.id === "pack:one")!.minimized).toBe(true);
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: action, exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Studio" })).toBeVisible());
  expect(screen.queryByLabelText("track:two draft")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("pack:other draft")).not.toBeInTheDocument();
  const value = save.mock.lastCall![0] as WindowWorkspace;
  expect(value.workspaces!.map((entry) => entry.id)).toEqual(["studio", "reference"]);
  expect(value.workspaces![0].layout.windows.find((entry) => entry.id === "pack:one")!.minimized).toBe(action === "Save");
  openSelected();
  expect(screen.getByRole("dialog", { name: "pack:one", exact: true })).toBeVisible();
  expect(screen.getByLabelText("track:two draft")).toBeInTheDocument();
});

it("saves and closes Draft after prompting for a workspace name", async () => {
  const save = vi.fn();
  render(<Harness initial={{ ...layout([savedWindow("pack:root", 1)]), mode: "simple" }} save={save} />);
  openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Save", exact: true }));
  fireEvent.change(within(manager).getByLabelText("Workspace name"), { target: { value: "Closed session" } });
  fireEvent.click(within(manager).getByRole("button", { name: "Save", exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Closed session" })).toBeVisible());
  expect(screen.queryByLabelText("pack:root draft")).not.toBeInTheDocument();
  expect(save.mock.lastCall![0]).toMatchObject({ windows: [], workspaces: [{ title: "Closed session", layout: { windows: [{ id: "pack:root" }] } }] });
});

it("discards newly added Draft membership while retaining its opening layout", async () => {
  const save = vi.fn();
  render(<Harness initial={{ ...layout([savedWindow("pack:root", 1)]), mode: "simple" }} save={save} />);
  openSelected();
  fireEvent.click(screen.getByRole("button", { name: "New app window" }));
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Discard", exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Draft Workspace" })).toBeVisible());
  const value = save.mock.lastCall![0] as WindowWorkspace;
  expect(value.windows.map((entry) => entry.id)).toEqual(["pack:root"]);
  expect(value.workspaces).toEqual([]);
  expect(screen.queryByLabelText("pack:new draft")).not.toBeInTheDocument();
});

it("keeps the workspace open when busy and waits for editor close confirmation", () => {
  const initial = studio();
  const { rerender } = render(<Harness initial={initial} busyWindow="pack:other" refuseClose="track:two" />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Discard", exact: true }));
  expect(within(manager).getByRole("alert")).toHaveTextContent("Wait for busy windows");
  expect(screen.getByLabelText("pack:one draft")).toBeInTheDocument();
  rerender(<Harness initial={initial} refuseClose="track:two" />);
  fireEvent.click(within(manager).getByRole("button", { name: "Discard", exact: true }));
  expect(within(manager).getByRole("status")).toHaveTextContent("Close the remaining windows");
  expect(screen.getByLabelText("track:two draft")).toBeInTheDocument();
  fireEvent.click(within(manager).getByRole("button", { name: "Cancel closing" }));
  expect(within(manager).getByRole("button", { name: "Close Workspace", exact: true })).toBeVisible();
});

it("returns a transferred dependency to its opening owner when discarding", async () => {
  const initial = studio(); const save = vi.fn();
  initial.windows.push(savedWindow("pack:other", 8));
  initial.workspaces![0].layout.windows = initial.workspaces![0].layout.windows.filter((entry) => entry.id !== "pack:other");
  render(<Harness initial={initial} save={save} />);
  browse("Studio"); openSelected();
  fireEvent.click(screen.getByRole("button", { name: "Open other app window" }));
  await waitFor(() => {
    const value = save.mock.lastCall![0] as WindowWorkspace;
    expect(value.workspaces![0].layout.windows.some((entry) => entry.id === "pack:other")).toBe(true);
  });
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Close Workspace", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Discard", exact: true }));
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Studio" })).toBeVisible());
  const value = save.mock.lastCall![0] as WindowWorkspace;
  expect(value.windows.map((entry) => entry.id).sort()).toEqual(["pack:other", "pack:root"]);
  expect(value.workspaces![0].layout.windows.map((entry) => entry.id).sort()).toEqual(["pack:one", "track:two"]);
  expect(workspaceWindows(value)).toHaveLength(new Set(workspaceWindows(value).map((entry) => entry.id)).size);
});

it("migrates nested legacy workspace shells to flat peer entries without losing dependency windows", async () => {
  const save = vi.fn();
  const initial = studio();
  initial.windows.push(savedWindow("workspace:studio", 7));
  initial.workspaces![0].layout.windows.push(savedWindow("workspace:reference", 8));
  initial.workspaces![0].dependencies = ["reference"];
  render(<Harness initial={initial} save={save} />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Back to workspaces" }));
  expect(within(explorer()).getByRole("button", { name: "Open workspace: Reference" })).toBeVisible();
  browse("Studio");
  expect(within(explorer()).getAllByRole("listitem").filter((entry) => entry.classList.contains("workspace-dependency-tile"))).toHaveLength(2);
  await waitFor(() => {
    const value = save.mock.lastCall![0] as WindowWorkspace;
    expect(workspaceWindows(value).some((entry) => entry.id.startsWith("workspace:"))).toBe(false);
    expect(workspaceWindows(value).some((entry) => entry.id === "pack:reference")).toBe(true);
  });
});

it("saves Draft as a peer while preserving live group drafts and excluding root-only metadata", async () => {
  const initial = studio(); const save = vi.fn();
  initial.windows = ["pack:root", "pack:new"].map((id, order) => savedWindow(id, order, { group: "draft-group", groupTitle: "Draft session", tabOrder: order }));
  render(<Harness initial={initial} save={save} />);
  const draft = screen.getByLabelText("pack:root draft");
  fireEvent.change(draft, { target: { value: "Live draft" } });
  browse("Draft Workspace");
  fireEvent.click(within(explorer()).getByRole("button", { name: "Save Draft as workspace" }));
  fireEvent.change(within(explorer()).getByLabelText("Workspace name"), { target: { value: "Saved draft" } });
  fireEvent.click(within(explorer()).getByRole("button", { name: "Save", exact: true }));
  expect(within(explorer()).getByText("Draft session", { exact: true })).toBeVisible();
  openSelected();
  expect(screen.getByLabelText("pack:root draft")).toBe(draft);
  expect(draft).toHaveValue("Live draft");
  await waitFor(() => {
    const value = save.mock.lastCall![0] as WindowWorkspace;
    expect(value.windows).toEqual([]);
    const saved = value.workspaces!.find((entry) => entry.title === "Saved draft")!;
    expect(saved.layout.windows).toHaveLength(2);
    expect(saved.layout).not.toHaveProperty("mode");
    expect(saved.layout).not.toHaveProperty("explorerIntroduced");
    expect(saved.layout).not.toHaveProperty("viewedWorkspaceId");
    expect(saved.layout).not.toHaveProperty("workspaces");
    expect(saved.layout.windows.every((entry) => entry.groupTitle === "Draft session")).toBe(true);
  });
});

it("moves and selects a complete dependency group without recreating drafts", async () => {
  render(<Harness initial={studio()} />);
  const draft = screen.getByLabelText("track:two draft");
  browse("Reference");
  fireEvent.change(within(explorer()).getByLabelText("Add dependency"), { target: { value: "pack:one" } });
  fireEvent.click(within(explorer()).getByRole("button", { name: "Add dependency" }));
  await waitFor(() => expect(within(explorer()).getByText("Production", { exact: true })).toBeVisible());
  openSelected();
  expect(screen.getByLabelText("track:two draft")).toBe(draft);
  expect(within(screen.getByRole("navigation", { name: "Window manager" })).getByRole("button", { name: "Focus group: Production" })).toBeVisible();
});

it("publishes unique window ownership after moving a group and interacting with both workspaces", async () => {
  const save = vi.fn();
  render(<Harness initial={studio()} save={save} />);
  browse("Reference");
  fireEvent.click(within(explorer()).getByText("Add content"));
  fireEvent.change(within(explorer()).getByLabelText("Add dependency"), { target: { value: "pack:one" } });
  fireEvent.click(within(explorer()).getByRole("button", { name: "Add dependency" }));
  await waitFor(() => {
    const snapshot = save.mock.lastCall![0] as WindowWorkspace;
    expect(snapshot.workspaces!.find(entry => entry.id === "reference")!.layout.windows.map(entry => entry.id)).toContain("pack:one");
  });

  openSelected();
  fireEvent.click(screen.getByRole("button", { name: "Open other app window" }));
  workspaces(); browse("Studio"); openSelected();
  await waitFor(() => {
    for (const [snapshot] of save.mock.calls as [WindowWorkspace][]) {
      const ids = workspaceWindows(snapshot).map(entry => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

it("reconciles stale saved membership with the current owner before publishing on Explorer interaction", async () => {
  const initial = studio();
  initial.windows.push(savedWindow("pack:one", 9));
  initial.workspaces![0].dependencies = ["removed-workspace"];
  const save = vi.fn();
  render(<Harness initial={initial} save={save} />);
  browse("Studio");
  await waitFor(() => {
    expect(save).toHaveBeenCalled();
    for (const [snapshot] of save.mock.calls as [WindowWorkspace][]) {
      const ids = workspaceWindows(snapshot).map(entry => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(snapshot.windows.some(entry => entry.id === "pack:one")).toBe(false);
      expect(snapshot.workspaces!.find(entry => entry.id === "studio")!.layout.windows.some(entry => entry.id === "pack:one")).toBe(true);
      expect(snapshot.workspaces!.every(entry => entry.dependencies.length === 0)).toBe(true);
    }
  });
});

it("reveals app-requested windows after minimizing the chooser, including an unselected saved dependency", () => {
  render(<Harness initial={studio()} />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Minimize Workspace Explorer" }));
  fireEvent.click(screen.getByRole("button", { name: "New app window" }));
  expect(screen.getByRole("dialog", { name: "pack:new" })).toBeVisible();
  workspaces(); browse("Studio"); openSelected();
  fireEvent.click(screen.getByRole("button", { name: "Open other app window" }));
  expect(screen.getByRole("dialog", { name: "pack:other" })).toBeVisible();
});

it.each([false, true])("reopens a closed saved minimized window on the first request at mobile=%s", (mobile) => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  render(<Harness initial={studio()} />);
  browse("Studio"); openSelected();
  const dialog = screen.getByRole("dialog", { name: "pack:other", exact: true });
  fireEvent.click(within(dialog).getByRole("button", { name: "Minimize pack:other", exact: true }));
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  if (mobile) fireEvent.click(within(manager).getByRole("button", { name: "Show window manager", exact: true }));
  fireEvent.click(within(manager).getByRole("button", { name: "Window options for pack:other", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Close pack:other", exact: true }));
  expect(screen.queryByLabelText("pack:other draft")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open other app window", exact: true }));
  expect(screen.getByRole("dialog", { name: "pack:other", exact: true })).toBeVisible();
});

it("opens Draft for a new account and keeps a launcher available after minimizing", () => {
  render(<Workspace><main>App</main></Workspace>);
  expect(within(explorer()).getByRole("heading", { name: "Draft Workspace" })).toBeVisible();
  expect(within(explorer()).getByText("Add content").closest("details")).toHaveAttribute("open");
  fireEvent.click(within(explorer()).getByRole("button", { name: "Minimize Workspace Explorer" }));
  expect(screen.getByRole("button", { name: "Workspaces" })).toBeVisible();
});

it("distinguishes focused, open, minimized and hidden restore controls with type-specific group and tab roles", () => {
  render(<Harness initial={studio()} />);
  browse("Studio");
  openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  const other = within(manager).getByRole("button", { name: "Focus pack:other", exact: true });
  const group = within(manager).getByRole("button", { name: "Focus group: Production", exact: true });
  expect(other).toHaveAttribute("data-window-state", "focused");
  expect(other).toHaveAttribute("data-window-kind", "dub");
  expect(other).toHaveAttribute("aria-current", "true");
  const visiblePath = within(other).getByRole("img", { name: "Visible (selected)", exact: true }).querySelector("path")?.getAttribute("d");
  expect(within(other).getByRole("img", { name: "Visible (selected)", exact: true })).toHaveAttribute("data-selected", "true");
  expect(group).toHaveAttribute("data-window-state", "open");
  expect(group).toHaveAttribute("data-window-kind", "other");
  fireEvent.click(within(manager).getByRole("button", { name: "Focus track:two", exact: true }));
  expect(group).toHaveAttribute("data-window-state", "focused");
  expect(within(group).getByRole("img", { name: "Visible (selected)", exact: true }).querySelector("path")).toHaveAttribute("d", visiblePath);
  expect(within(manager).getByRole("button", { name: "Focus track:two", exact: true }).querySelector("path")).toHaveAttribute("d", visiblePath);
  expect(within(manager).getByRole("button", { name: "Focus track:two", exact: true })).toHaveAttribute("data-window-kind", "sample");
  expect(other).toHaveAttribute("data-window-state", "open");
  expect(within(other).getByRole("img", { name: "Visible", exact: true }).querySelector("path")).toHaveAttribute("d", visiblePath);
  expect(within(other).getByRole("img", { name: "Visible", exact: true })).not.toHaveAttribute("data-selected");
  fireEvent.click(within(manager).getByRole("button", { name: "Minimize pack:other", exact: true }));
  expect(within(manager).getByRole("button", { name: "Restore pack:other", exact: true })).toHaveAttribute("data-window-state", "minimized");
  expect(within(within(manager).getByRole("button", { name: "Restore pack:other", exact: true })).getByRole("img", { name: "Hidden", exact: true })).toBeVisible();
  fireEvent.pointerDown(screen.getByRole("button", { name: "New app window" }));
  expect(group).toHaveAttribute("data-window-state", "hidden");
  expect(group).not.toHaveAttribute("aria-current");
  expect(within(group).getByRole("img", { name: "Hidden", exact: true }).querySelector("path")).not.toHaveAttribute("d", visiblePath);
});

it("shows hidden rather than open icons for inactive mobile window sheets", () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  render(<Harness initial={studio()} />);
  browse("Studio");
  openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByRole("button", { name: "Show window manager", exact: true }));
  const group = within(manager).getByRole("button", { name: "Focus group: Production", exact: true });
  expect(within(group).getByRole("img", { name: "Hidden", exact: true })).toBeVisible();
  fireEvent.click(within(manager).getByRole("button", { name: "Focus track:two", exact: true }));
  expect(screen.getByRole("dialog", { name: "track:two", exact: true })).toBeVisible();
  expect(within(within(manager).getByRole("button", { name: "Focus track:two", exact: true })).getByRole("img", { name: "Visible (selected)", exact: true })).toBeVisible();
  fireEvent.click(within(manager).getByRole("button", { name: "Focus pack:other", exact: true }));
  const other = within(manager).getByRole("button", { name: "Focus pack:other", exact: true });
  expect(within(other).getByRole("img", { name: "Visible (selected)", exact: true })).toBeVisible();
  fireEvent.click(within(screen.getByRole("dialog", { name: "pack:other", exact: true })).getByRole("button", { name: "Minimize pack:other", exact: true }));
  expect(manager.querySelector('[aria-current="true"]')).toBeNull();
});

it("temporarily hides windows outside and restores the workspace on a new request without changing manual minimization", async () => {
  const initial = studio(); const save = vi.fn();
  initial.workspaces![0].layout.openedDependencies = ["pack:one", "track:two", "pack:other"];
  render(<Harness initial={initial} save={save} />);
  browse("Studio"); openSelected();
  const draft = screen.getByLabelText("track:two draft");
  fireEvent.change(draft, { target: { value: "Hidden draft" } });
  fireEvent.click(within(screen.getByRole("dialog", { name: "pack:other" })).getByRole("button", { name: "Minimize pack:other" }));
  const newWindow = screen.getByRole("button", { name: "New app window" });
  fireEvent.pointerDown(newWindow);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show windows", exact: true })).toBeVisible();
  expect(screen.getAllByRole("img", { name: "Hidden", exact: true }).length).toBeGreaterThan(0);
  await waitFor(() => {
    const value = save.mock.lastCall![0] as WindowWorkspace;
    const studio = value.workspaces!.find((entry) => entry.id === "studio")!;
    expect(studio.layout.windows.find((entry) => entry.id === "track:two")!.minimized).toBe(false);
    expect(studio.layout.windows.find((entry) => entry.id === "pack:other")!.minimized).toBe(true);
  });
  fireEvent.click(newWindow);
  expect(screen.getByRole("dialog", { name: "pack:new" })).toBeVisible();
  expect(screen.getByLabelText("track:two draft")).toBe(draft);
  expect(draft).toHaveValue("Hidden draft");
  expect(screen.getByRole("dialog", { name: "track:two" })).toBeVisible();
  expect(screen.queryByRole("dialog", { name: "pack:other" })).not.toBeInTheDocument();
});

it("reveals temporarily hidden windows from the manager without opening another dependency", () => {
  render(<Harness />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Minimize Workspace Explorer" }));
  const draft = screen.getByLabelText("pack:root draft");
  fireEvent.pointerDown(screen.getByRole("button", { name: "New app window" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show windows", exact: true }));
  expect(screen.getByRole("dialog", { name: "pack:root" })).toBeVisible();
  expect(screen.getByLabelText("pack:root draft")).toBe(draft);
});

it.each(["Focus group: Production", "Focus track:two", "Focus pack:other"])("reveals a Hidden window on the first %s activation", (label) => {
  const save = vi.fn();
  render(<Harness initial={studio()} save={save} />);
  browse("Studio"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.pointerDown(screen.getByRole("button", { name: "New app window" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const focus = within(manager).getByRole("button", { name: label, exact: true });
  expect(within(focus).getByRole("img", { name: "Hidden", exact: true })).toBeVisible();
  fireEvent.click(focus);
  const target = label === "Focus pack:other" ? "pack:other" : "track:two";
  expect(screen.getByRole("dialog", { name: target, exact: true })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Show windows", exact: true })).not.toBeInTheDocument();
  expect((save.mock.lastCall![0] as WindowWorkspace).activeWorkspaceId).toBe("studio");
});

it("preserves media backgrounds and busy close safeguards in the running manager", () => {
  const close = vi.fn();
  render(<Workspace><FloatingWindow title="Busy sample" windowId="track:busy" kind="sample" active order={1} onActivate={vi.fn()} onClose={close} closeDisabled>Content</FloatingWindow></Workspace>);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Minimize Workspace Explorer" }));
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  const card = within(manager).getByRole("region", { name: "Open window: Busy sample" }).closest(".workspace-card");
  expect(card).toHaveClass("workspace-card--sample", "workspace-card--open");
  fireEvent.click(within(manager).getByRole("button", { name: "Window options for Busy sample" }));
  expect(within(screen.getByRole("group", { name: "Window options for Busy sample" })).getByRole("button", { name: "Close Busy sample" })).toBeDisabled();
  expect(close).not.toHaveBeenCalled();
});

it.each([false, true])("supports fullscreen browsing, grouped previews and selection on mobile=%s", (mobile) => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  render(<Harness initial={studio()} />);
  browse("Studio");
  fireEvent.click(within(explorer()).getByText("Preview tabs"));
  expect(within(explorer()).getByText("pack:one", { selector: "li" })).toBeVisible();
  if (mobile) {
    expect(explorer()).toHaveClass("workspace-explorer--maximized");
    expect(screen.getByRole("dialog", { name: "Workspace Explorer", exact: true })).toContainElement(explorer());
  } else {
    expect(screen.getByRole("complementary", { name: "Workspace and player" })).toContainElement(explorer());
  }
  openSelected();
  expect(screen.queryByRole("navigation", { name: "Workspace Explorer", exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Window manager" })).toBeInTheDocument();
});

it("keeps notifications and uploads independent of the workspace browser", () => {
  render(<Workspace activityWindows={<section aria-label="Activity">Uploading</section>}><main>App</main></Workspace>);
  expect(screen.getByRole("region", { name: "Activity" })).toBeVisible();
});

it("keeps the collapsed player rail accessible and expands workspace browsing in the same bar", () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  render(<Workspace sidebarContent={<section aria-label="Global player">Playback</section>} sidebarCollapsed><main>App</main></Workspace>);
  const sidebar = screen.getByRole("complementary", { name: "Workspace and player" });
  expect(sidebar).toContainElement(screen.getByRole("region", { name: "Global player" }));
  expect(sidebar).toContainElement(explorer());
  fireEvent.click(within(explorer()).getByRole("button", { name: "Minimize Workspace Explorer" }));
  expect(document.querySelector(".workspace-root")).toHaveClass("workspace-root--sidebar-collapsed");
  fireEvent.click(within(sidebar).getByRole("button", { name: "Workspaces" }));
  expect(sidebar).toContainElement(explorer());
  expect(document.querySelector(".workspace-root")).not.toHaveClass("workspace-root--sidebar-collapsed");
});

it("hydrates asynchronous account workspaces before browsing without opening previous dependencies", async () => {
  const app = render(<Workspace><main>App</main></Workspace>);
  app.rerender(<Workspace initialWorkspace={studio()}><main>App</main></Workspace>);
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Draft Workspace" })).toBeVisible());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it.each([false, true])("restores the persisted workspace management viewer without selection with asynchronous hydration=%s", async (asynchronous) => {
  const initial = { ...studio(), viewedWorkspaceId: "studio" };
  const save = vi.fn();
  const app = render(<Harness initial={asynchronous ? undefined : initial} save={save} />);
  if (asynchronous) app.rerender(<Harness initial={initial} save={save} />);
  await waitFor(() => expect(within(explorer()).getByRole("heading", { name: "Studio" })).toBeVisible());
  expect(within(explorer()).getByText("Production", { exact: true })).toBeVisible();
  expect(within(explorer()).getByText("pack:other", { exact: true, selector: "strong" })).toBeVisible();
  expect(within(explorer()).queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ viewedWorkspaceId: "studio" })));
  browse("Reference");
  await waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ viewedWorkspaceId: "reference" })));
});

it.each(["missing", "studio"])("uses Draft when the remembered workspace is unavailable or Simple mode is enabled: %s", (id) => {
  render(<Harness initial={{ ...studio(), viewedWorkspaceId: id, ...(id === "studio" ? { mode: "simple" } : {}) }} />);
  expect(within(explorer()).getByRole("heading", { name: "Draft Workspace" })).toBeVisible();
});

it("minimizes every active workspace window without closing drafts or pausing playback", () => {
  const pause = vi.fn(); const save = vi.fn();
  render(<Harness initial={studio()} pause={pause} playing save={save} />);
  browse("Studio"); openSelected(); pause.mockClear();
  const draft = screen.getByLabelText("track:two draft");
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  const minimizeAllPath = within(manager).getByRole("button", { name: "Minimize all windows", exact: true }).querySelector("path")?.getAttribute("d");
  expect(minimizeAllPath).toBeTruthy();
  expect(minimizeAllPath).not.toBe(within(manager).getByRole("button", { name: "Minimize window manager", exact: true }).querySelector("path")?.getAttribute("d"));
  fireEvent.click(within(manager).getByRole("button", { name: "Minimize all windows", exact: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("track:two draft")).toBe(draft);
  expect(pause).not.toHaveBeenCalled();
  expect(within(manager).getByRole("button", { name: "Minimize all windows", exact: true })).toBeDisabled();
  const value = save.mock.lastCall![0] as WindowWorkspace;
  expect(value.workspaces![0].layout.windows.every((entry) => entry.minimized)).toBe(true);
  expect(value.workspaces![1].layout.windows[0].minimized).toBe(false);
  fireEvent.click(within(manager).getByRole("button", { name: "Restore group: Production", exact: true }));
  expect(screen.getByRole("dialog", { name: "track:two", exact: true })).toBeVisible();
  expect(within(manager).getByRole("button", { name: "Minimize all windows", exact: true })).toBeEnabled();
});

it("offers minimize all inside Explorer and preserves the active workspace", () => {
  render(<Harness initial={studio()} />);
  expect(within(explorer()).getByRole("button", { name: "Minimize all windows" })).toBeDisabled();
  browse("Studio"); openSelected(); workspaces();
  const minimize = within(explorer()).getByRole("button", { name: "Minimize all windows" });
  expect(minimize).toBeEnabled();
  fireEvent.click(minimize);
  expect(minimize).toBeDisabled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Minimize Workspace Explorer" }));
  expect(within(screen.getByRole("navigation", { name: "Window manager" })).getByRole("heading", { name: "Studio" })).toBeVisible();
});

it("opens an empty workspace directly and allows adding windows from the app", () => {
  const initial = studio(); initial.workspaces![1].layout = layout();
  render(<Harness initial={initial} />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Back to workspaces" }));
  fireEvent.click(within(explorer()).getByRole("button", { name: "Open workspace: Reference" }));
  expect(within(screen.getByRole("navigation", { name: "Window manager" })).getByRole("heading", { name: "Reference" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "New app window" }));
  expect(screen.getByRole("dialog", { name: "pack:new" })).toBeVisible();
});

it("opens a single sample from the running manager and reuses its window without starting playback", () => {
  const pause = vi.fn(); const save = vi.fn();
  render(<Harness initial={studio()} pause={pause} save={save} />);
  browse("Reference"); openSelected();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  fireEvent.click(within(manager).getByText("Open dub, sample or vocal", { selector: "summary" }));
  const form = within(manager).getByRole("form", { name: "Open dub, sample or vocal" });
  expect(within(form).queryByRole("option", { name: "pack:new" })).not.toBeInTheDocument();
  fireEvent.click(within(form).getByRole("button", { name: "Open in workspace" }));
  expect(within(manager).getByRole("alert")).toHaveTextContent("Choose a dub, sample or vocal");
  fireEvent.change(within(form).getByLabelText("Dub, sample or vocal"), { target: { value: "track:new" } });
  fireEvent.click(within(form).getByRole("button", { name: "Open in workspace" }));
  expect(screen.getByRole("dialog", { name: "track:new" })).toBeVisible();
  const draft = screen.getByLabelText("track:new draft");
  fireEvent.change(within(form).getByLabelText("Dub, sample or vocal"), { target: { value: "track:new" } });
  fireEvent.click(within(form).getByRole("button", { name: "Open in workspace" }));
  expect(screen.getAllByRole("dialog", { name: "track:new" })).toHaveLength(1);
  expect(screen.getByLabelText("track:new draft")).toBe(draft);
  expect(pause).not.toHaveBeenCalled();
  expect((save.mock.lastCall![0] as WindowWorkspace).workspaces!.find((entry) => entry.id === "reference")!.layout.windows.some((entry) => entry.id === "track:new")).toBe(true);
});

it("opens a track from management and transfers its whole group without recreating drafts", () => {
  const save = vi.fn();
  render(<Harness initial={studio()} save={save} />);
  const draft = screen.getByLabelText("track:two draft");
  browse("Reference");
  fireEvent.click(within(explorer()).getByText("Open dub, sample or vocal", { selector: "summary" }));
  const form = within(explorer()).getByRole("form", { name: "Open dub, sample or vocal" });
  fireEvent.change(within(form).getByLabelText("Dub, sample or vocal"), { target: { value: "track:two" } });
  fireEvent.click(within(form).getByRole("button", { name: "Open in workspace" }));
  expect(screen.queryByRole("navigation", { name: "Workspace Explorer", exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "track:two" })).toBeVisible();
  expect(screen.getByLabelText("track:two draft")).toBe(draft);
  const value = save.mock.lastCall![0] as WindowWorkspace;
  expect(value.workspaces!.find((entry) => entry.id === "reference")!.layout.windows.map((entry) => entry.id)).toEqual(expect.arrayContaining(["pack:one", "track:two"]));
  const ids = workspaceWindows(value).map((entry) => entry.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it("offers the previous active workspace on entry without showing windows or overwriting persistence", () => {
  const save = vi.fn(); const pause = vi.fn();
  render(<Harness initial={{ ...studio(), activeWorkspaceId: "studio", viewedWorkspaceId: "reference" }} restoreOnEntry save={save} pause={pause} />);
  expect(within(explorer()).getByRole("heading", { name: "Continue your workspace" })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Load previous workspace: Studio" }));
  expect(within(screen.getByRole("navigation", { name: "Window manager" })).getByRole("heading", { name: "Studio" })).toBeVisible();
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ activeWorkspaceId: "studio" }));
  expect(pause).not.toHaveBeenCalled();
});

it("waits for async account hydration before offering restoration or publishing a blank layout", () => {
  const save = vi.fn(); const initial = { ...studio(), activeWorkspaceId: "studio" };
  const app = render(<Harness restoreOnEntry restorationReady={false} save={save} />);
  expect(within(explorer()).getByRole("status")).toHaveTextContent("Loading your saved workspace");
  expect(save).not.toHaveBeenCalled();
  app.rerender(<Harness initial={initial} restoreOnEntry save={save} />);
  expect(within(explorer()).getByRole("button", { name: "Load previous workspace: Studio" })).toBeVisible();
  expect(save).not.toHaveBeenCalled();
});

it("starts new accounts directly in an empty Draft without a chooser", () => {
  const save = vi.fn();
  render(<Workspace restoreOnEntry onWorkspaceChange={save}><main>App</main></Workspace>);
  expect(screen.queryByRole("navigation", { name: "Workspace Explorer", exact: true })).not.toBeInTheDocument();
  const manager = screen.getByRole("navigation", { name: "Window manager" });
  expect(within(manager).getByRole("heading", { name: "Draft Workspace" })).toBeVisible();
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ windows: [], activeWorkspaceId: "" }));
});

it("starts blank without prompting when only saved named workspaces have windows", async () => {
  const initial = { ...studio(), windows: [], activeWorkspaceId: "studio" }; const save = vi.fn();
  render(<Harness initial={initial} restoreOnEntry save={save} />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Start empty Draft" }));
  await waitFor(() => expect(screen.queryByRole("navigation", { name: "Workspace Explorer", exact: true })).not.toBeInTheDocument());
  expect(screen.queryByLabelText("track:two draft")).not.toBeInTheDocument();
  const value = save.mock.lastCall![0] as WindowWorkspace;
  expect(value.windows).toEqual([]);
  expect(value.workspaces!.map((entry) => entry.id)).toEqual(["studio", "reference"]);
  expect(value.workspaces![0].layout.windows).toHaveLength(3);
  expect(value.activeWorkspaceId).toBe("");
});

it.each(["Save and start blank", "Discard Draft and start blank"])("prompts for Draft changes and handles %s without duplicate ownership", async (action) => {
  const initial = { ...studio(), activeWorkspaceId: "studio" }; const save = vi.fn();
  render(<Harness initial={initial} restoreOnEntry save={save} />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Start empty Draft" }));
  const form = within(explorer()).getByRole("form", { name: "Save changes before starting Draft" });
  fireEvent.click(within(form).getByRole("button", { name: "Cancel", exact: true }));
  expect(within(explorer()).getByRole("button", { name: "Load previous workspace: Studio" })).toBeVisible();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Start empty Draft" }));
  fireEvent.change(within(explorer()).getByLabelText("Workspace name"), { target: { value: "Previous Draft" } });
  fireEvent.click(within(explorer()).getByRole("button", { name: action, exact: true }));
  await waitFor(() => expect(screen.queryByRole("navigation", { name: "Workspace Explorer", exact: true })).not.toBeInTheDocument());
  const value = save.mock.lastCall![0] as WindowWorkspace;
  expect(value.windows).toEqual([]);
  const saved = value.workspaces!.find((entry) => entry.title === "Previous Draft");
  if (action.startsWith("Save")) expect(saved!.layout.windows.map((entry) => entry.id)).toEqual(["pack:root"]);
  else expect(saved).toBeUndefined();
  const ids = workspaceWindows(value).map((entry) => entry.id);
  expect(ids.length).toBe(new Set(ids).size);
});

it("does not discard busy or unsaved editors across Draft and the previous workspace", () => {
  const initial = { ...studio(), activeWorkspaceId: "studio" }; const save = vi.fn();
  const app = render(<Harness initial={initial} restoreOnEntry save={save} busyWindow="pack:other" refuseClose="track:two" />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Start empty Draft" }));
  fireEvent.click(within(explorer()).getByRole("button", { name: "Discard Draft and start blank" }));
  expect(within(explorer()).getByRole("alert")).toHaveTextContent("Wait for busy windows");
  expect(screen.getByLabelText("pack:root draft")).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  app.rerender(<Harness initial={initial} restoreOnEntry save={save} refuseClose="track:two" />);
  fireEvent.click(within(explorer()).getByRole("button", { name: "Discard Draft and start blank" }));
  expect(within(explorer()).getByRole("status")).toHaveTextContent("Confirm any unsaved editor changes");
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(within(explorer()).getByRole("button", { name: "Review unsaved windows" }));
  expect(screen.getByRole("dialog", { name: "track:two" })).toBeVisible();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Window manager" })).getByRole("button", { name: "Cancel starting Draft" }));
  expect(screen.getByLabelText("track:two draft")).toBeInTheDocument();
});
