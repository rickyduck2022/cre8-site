import { createContext, useCallback, useContext, useEffect, useId, useInsertionEffect, useLayoutEffect, useRef, useState, type ContextType, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Eye, EyeOff, Play, Pause, MoreActions, WindowMaximize, WindowMinimize, WindowRestore, X } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { CollectionTabs } from "../../molecules/CollectionTabs/CollectionTabs";
import { SnapPreview } from "../../atoms/SnapPreview/SnapPreview";
import { useMobileLayout } from "../../utils/useMobileLayout";
import { TutorialNavigationContext } from "../../foundations/TutorialNavigationContext";
import { useReportTutorialActivity } from "../../foundations/TutorialActivityContext";
import { useWindowPosition, windowViewport, type WindowPoint, type WindowPosition, type WindowSnapTarget } from "../../utils/useWindowPosition";
import { useWindowResize, type WindowSize } from "../../utils/useWindowResize";
import "./Window.css";
import "../../foundations/VaultTheme.css";
import "../../foundations/MediaPalette.css";
import "../../foundations/WorkspacePalette.css";
import type { WindowFrame, WindowWorkspace } from "./workspace";
import { useWorkspaceRouting, type WindowLayerContext } from "./WorkspaceContext";
export type { SavedWindow, WindowFrame, WindowWorkspace } from "./workspace";

type Placement = "floating" | "left" | "right" | "fullscreen";
export function WindowMoveIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" /></svg>;
}
export interface ActiveWindowGroup {
  id: string;
  title: string;
  activeWindowId: string;
  windows: { id: string; title: string }[];
}
export interface WindowTracklistControl {
  selectedId: string;
  tracklists: { id: string; label: string }[];
  onSelect: (id: string) => void;
}
export function WindowTracklistSelector({ selectedId, tracklists, onSelect }: WindowTracklistControl) {
  return <label className="window-tracklists"><span>Group tracklist</span>
    <select aria-label="Group tracklist" value={selectedId} onChange={(event) => onSelect(event.currentTarget.value)}>
      {tracklists.map((list) => <option key={list.id} value={list.id}>{list.label}</option>)}
    </select>
  </label>;
}
interface WindowEntry {
  id: string;
  groupScope: string;
  title: string;
  kind?: string;
  playback?: { isPlaying: boolean; onToggle: () => void; trackTitle?: string };
  placement: Placement;
  minimized: boolean;
  visible: boolean;
  order: number;
  dockOrder?: number;
  activate: () => void;
  restore: () => void;
  minimize: () => void;
  element: HTMLDialogElement | null;
  setFrame: (frame: WindowFrame, preserveMinimized?: boolean) => void;
  getFrame: () => WindowFrame;
  restoreLayout: (frame: WindowFrame, restoreFrame: WindowFrame | null, minimized: boolean, title?: string | null) => void;
  customTitle: string | null;
  frame: WindowFrame;
  restoreFrame: WindowFrame | null;
  persistent: boolean;
  autoGroup: boolean;
  close: () => void;
  closeDisabled: boolean;
  getActions: () => NonNullable<FloatingWindowProps["menuActions"]>;
}
function isOpenWindow(entry: WindowEntry) {
  return entry.kind !== "workspace" || entry.persistent;
}
interface JoinOptions {
  includeSourceGroup?: boolean;
  keepMinimized?: boolean;
  undoable?: boolean;
  preserveHidden?: boolean;
}
export const WindowContext = createContext<{
  windows: WindowEntry[];
  register: (entry: WindowEntry) => void;
  unregister: (id: string) => void;
  dockWidths: Record<string, number | null>;
  setDockWidth: (side: "left" | "right", width: number | null, scope: string) => void;
  groups: Record<string, string>;
  groupTitles: Record<string, string>;
  join: (source: string, target: string, frame: WindowFrame, options?: JoinOptions) => void;
  detach: (id: string) => void;
  syncFrame: (source: string, frame: WindowFrame) => void;
  groupTitle: (id: string) => string;
  renameGroup: (id: string, title: string) => void;
  reorder: (ids: string[]) => void;
  tabOrders: Record<string, number>;
  minimizedTargets: () => { entry: WindowEntry; element: HTMLElement }[];
  move: (source: string, target: string, includeSourceGroup?: boolean) => void;
  beginDrag: () => void;
  endDrag: () => void;
  undoControl?: ReactNode;
  host?: HTMLElement;
  portalWindows: boolean;
  updatingVisibility: { current: boolean };
  featureWindows?: FeatureWindowSystem;
  claimAutoGroup: (id: string) => boolean;
  finishAutoGroup: (id: string) => void;
  initialWorkspace?: WindowWorkspace | null;
  restoreWorkspace: (workspace: WindowWorkspace) => void;
  initialOffset: (id: string) => number;
  tracklistControl?: WindowTracklistControl;
  contained?: boolean;
  focus: () => void;
  previews: Record<string, WindowPreview>;
  recentlyMinimized: string[];
  dismissMinimizeNotice: (ids: string[]) => void;
} | null>(null);
function dockTargets(element: HTMLElement, _position: WindowPoint, x: number, y: number): WindowSnapTarget<"left" | "right">[] {
  const viewport = windowViewport(element);
  return (["left", "right"] as const).map((kind) => ({
    kind, active: y >= viewport.top && y <= viewport.top + viewport.height && (kind === "left" ? x <= viewport.left + 32 : x >= viewport.left + viewport.width - 32),
    style: { [kind]: 8, top: 8, width: Math.min(64, viewport.width / 2 - 16), height: viewport.height - 16 },
  }));
}

export interface FloatingWindowProps {
  windowId?: string;
  groupWith?: { id: string; request: number };
  title: string;
  children: ReactNode;
  active: boolean;
  order: number;
  openRequest?: number;
  onActivate: () => void;
  onClose: () => void;
  onMinimize?: () => void;
  className?: string;
  groupScope?: string;
  autoGroup?: boolean;
  kind?: string;
  menuActions?: { label: string; onSelect: () => void; disabled?: boolean }[];
  playback?: { isPlaying: boolean; onToggle: () => void; trackTitle?: string };
  closeDisabled?: boolean;
  persistent?: boolean;
  suspended?: boolean;
}

export interface FeatureWindowSystem {
  stack: string[];
  onActivate: (id: string) => void;
  onRemove: (id: string) => void;
}
export function useFeatureWindowSystem() {
  return useContext(WindowContext)?.featureWindows;
}

function GroupNameForm({ title, onSave, onCancel }: { title: string; onSave: (title: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(title);
  const [error, setError] = useState("");
  return <form className="window-group-form" aria-label="Rename group" onSubmit={(event) => {
    event.preventDefault();
    if (!name.trim()) { setError("Enter a group name."); return; }
    onSave(name.trim());
  }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); } }}>
    <label>Group name<input autoFocus maxLength={100} value={name} onChange={(event) => { setName(event.currentTarget.value); setError(""); }}
      onFocus={(event) => event.currentTarget.select()} /></label>
    {error && <span role="alert">{error}</span>}
    <div><Button type="submit" variant="primary" size="small">Save name</Button>
      <Button variant="tertiary" size="small" onClick={onCancel}>Cancel</Button></div>
  </form>;
}

function WindowControlsMenu({ title, actions }: { title: string; actions: NonNullable<FloatingWindowProps["menuActions"]> }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (open) panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  return <div ref={root} className="floating-window__menu" onKeyDown={(event) => {
    if (open && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
    if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      if (!buttons.length) return;
      event.preventDefault();
      event.stopPropagation();
      const index = buttons.findIndex((button) => button === document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  }} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget) && !panel.current?.contains(event.relatedTarget)) setOpen(false);
  }}>
    <Button ref={trigger} variant="tertiary" size="small" aria-label={`Window options for ${title}`}
      title="Window options" aria-expanded={open} aria-controls={open ? id : undefined}
      leadingIcon={<MoreActions aria-hidden="true" />} onClick={() => {
        const bounds = trigger.current?.getBoundingClientRect();
        if (bounds && trigger.current) {
          const viewport = windowViewport(trigger.current);
          const bottom = bounds.bottom - viewport.top;
          const top = bounds.top - viewport.top;
          setStyle({
            left: Math.max(8, Math.min(viewport.width - 200, bounds.right - viewport.left - 192)),
            ...(bottom < viewport.height / 2
              ? { top: bottom + 4, maxHeight: viewport.height - bottom - 12 }
              : { bottom: viewport.height - top + 4, maxHeight: top - 12 }),
          });
        }
        setOpen((current) => !current);
      }} />
    {open && createPortal(<div ref={panel} id={id} role="group" aria-label={`Window options for ${title}`}
      className={`floating-window__menu-panel${root.current?.closest(".workspace-palette--charcoal") ? " workspace-palette--charcoal" : ""}`} style={style}>
      {actions.map((action) => <Button key={action.label} variant="tertiary" size="small" disabled={action.disabled} onClick={() => {
        setOpen(false);
        trigger.current?.focus();
        action.onSelect();
      }}>{action.label}</Button>)}
    </div>, root.current?.closest("dialog") ?? document.body)}
  </div>;
}

export interface WindowPreview {
  id: string;
  title: string;
  content: HTMLElement;
  width: number;
  height: number;
  scroll: { top: number; left: number }[];
}

export function captureWindowPreview(entry: WindowEntry): WindowPreview | null {
  const source = entry.element?.querySelector<HTMLElement>(".floating-window__content");
  if (!entry.element?.open || !source) return null;
  const content = source.cloneNode(true);
  if (!(content instanceof HTMLElement)) return null;
  const originalNodes = [source, ...source.querySelectorAll("*")];
  const nodes = [content, ...content.querySelectorAll("*")];
  const positions = new Map(nodes.map((node, index) => [node, { top: originalNodes[index].scrollTop, left: originalNodes[index].scrollLeft }]));
  nodes.forEach((node) => {
    // A thumbnail must never become another form, media player or window-system target.
    for (const attribute of [...node.attributes]) {
      if (/^(?:id|name|autofocus|form|aria-.+|on.+|data-window-.+)$/.test(attribute.name)) node.removeAttribute(attribute.name);
    }
    if (node instanceof HTMLInputElement && ["password", "file", "hidden"].includes(node.type)) {
      node.value = ""; node.removeAttribute("value");
    }
  });
  content.querySelectorAll("audio, video, iframe, object, embed, script, style, link, meta, base, dialog").forEach((node) => node.remove());
  const scroll = [content, ...content.querySelectorAll("*")].map((node) => positions.get(node) ?? { top: 0, left: 0 });
  const bounds = source.getBoundingClientRect();
  return { id: entry.id, title: entry.title, content, width: bounds.width || 640, height: bounds.height || 360, scroll };
}

export function MinimizedWindowPreview({ preview }: { preview: WindowPreview }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const clone = preview.content.cloneNode(true);
    if (!(clone instanceof HTMLElement)) return;
    const nodes = [clone, ...clone.querySelectorAll("*")];
    element.replaceChildren(clone);
    nodes.forEach((node, index) => {
      node.scrollTop = preview.scroll[index]?.top ?? 0;
      node.scrollLeft = preview.scroll[index]?.left ?? 0;
    });
    const measure = () => setScale(Math.min(1, element.getBoundingClientRect().width / preview.width));
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => { observer?.disconnect(); element.replaceChildren(); };
  }, [preview]);
  return <div className="window-layer__preview" aria-hidden="true" inert>
    <div className="window-layer__preview-viewport" ref={host}
      style={{ "--preview-width": `${preview.width}px`, "--preview-height": `${preview.height}px`, "--preview-scale": scale } as CSSProperties} />
    <span className="window-layer__preview-label">{preview.title}</span>
  </div>;
}

export function WindowVisibility({ state, focused = false }: { state: "Visible" | "Hidden with workspace" | "Hidden" | "Minimized" | "Minimized with workspace" | "Maximized" | "Inactive tab"; focused?: boolean }) {
  const visible = state === "Visible" || state === "Maximized";
  const selected = visible && focused;
  const label = visible ? selected ? "Visible (selected)" : "Visible" : "Hidden";
  const Icon = visible ? Eye : EyeOff;
  return <span className="window-layer__visibility" data-selected={selected || undefined} role="img" aria-label={label} title={label}>
    <Icon aria-hidden="true" />
  </span>;
}

export function WindowGroupControl({ title, entries, members, highlighted, preview, onRename, onRestore, showAll = false, contextMinimized = false, contextHidden = false, focusedWindowId, onFocus, addition, selection, icon, compact = false }: {
  title: string; entries: WindowEntry[]; members: WindowEntry[]; highlighted: boolean; onRename: (title: string) => void;
  preview?: WindowPreview;
  onRestore: (ids: string[]) => void;
  showAll?: boolean;
  contextMinimized?: boolean;
  contextHidden?: boolean;
  focusedWindowId?: string;
  onFocus?: (id: string) => void;
  addition?: { label: string; kind?: string };
  selection?: { id: string | null; onSelect: (id: string) => void };
  icon?: ReactNode;
  compact?: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const tabsId = useId();
  const grouped = members.length > 1;
  const mixed = new Set(members.map((entry) => entry.kind)).size > 1;
  const playing = members.find((entry) => entry.playback?.isPlaying);
  const playback = playing?.playback ?? members.find((entry) => entry.playback)?.playback;
  const visible = members.filter((entry) => !entry.minimized);
  const kind = members.every((entry) => entry.kind === "vocal") ? "vocal" : members.every((entry) => entry.kind === "sample") ? "sample" : members.every((entry) => entry.kind === "dub") ? "dub" : "other";
  const controlState = (items: WindowEntry[]) => {
    if (contextHidden || contextMinimized) return "hidden";
    if (items.every((entry) => entry.minimized)) return "minimized";
    return items.some((entry) => entry.visible && !entry.minimized && entry.id === focusedWindowId) ? "focused" : "open";
  };
  const headerState = controlState(members);
  const state = contextMinimized || !visible.length ? "Minimized" : !visible.some((entry) => entry.visible) ? "Hidden"
    : visible.some((entry) => entry.visible && entry.placement === "fullscreen") ? "Maximized" : "Visible";
  const focus = (entry: WindowEntry) => { onRestore([entry.id]); onFocus ? onFocus(entry.id) : entry.restore(); };
  const restore = () => {
    if (showAll && visible.length) {
      focus([...visible].sort((a, b) => b.order - a.order)[0]);
      return;
    }
    onRestore(members.map((entry) => entry.id));
    [...members].sort((a, b) => a.order - b.order).forEach((entry) => entry.restore());
    if (showAll) onFocus?.([...members].sort((a, b) => b.order - a.order)[0].id);
  };
  const activation = (id: string, open: () => void) => selection ? {
    "aria-pressed": selection.id === id,
    title: "Click or press Enter to open",
    onClick: () => { selection.onSelect(id); open(); },
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter") { event.preventDefault(); selection.onSelect(id); open(); }
    },
  } : { onClick: open };
  return <section className={`window-layer__minimized-group${highlighted ? " window-layer__minimized-group--highlight" : ""}${addition ? ` window-addition${mixed ? " window-addition--mixed" : ""} window-addition--${addition.kind ?? "default"}` : ""}`}
    data-window-drop-target={entries[0].id} data-state={showAll ? contextHidden && state !== "Minimized" ? "hidden" : state.toLowerCase() : undefined}
    aria-label={`${showAll && state !== "Minimized" ? grouped ? "Open group" : "Open window" : grouped ? "Minimized group" : "Minimized window"}: ${title}`}>
    <header className="floating-window__header">
      {compact && grouped && <Button className="window-layer__expand" variant="tertiary" size="small"
        aria-label={`${expanded ? "Collapse" : "Expand"} tabs in ${title}`} aria-expanded={expanded} aria-controls={tabsId}
        leadingIcon={<ChevronRight style={{ transform: expanded ? "rotate(90deg)" : undefined }} />} onClick={() => setExpanded(!expanded)} />}
      <Button variant="tertiary" size="small" className="window-layer__restore"
        data-tutorial-subject={entries.map((entry) => entry.id).join(" ")}
        data-window-kind={kind} data-window-state={headerState} aria-current={headerState === "focused" ? true : undefined}
        aria-label={`${showAll && state !== "Minimized" ? grouped ? "Focus group:" : "Focus" : grouped ? "Restore group:" : "Restore"} ${title}`} {...activation(entries[0].id, restore)}
        leadingIcon={showAll ? icon : <WindowRestore aria-hidden="true" />}>
        {showAll && <WindowVisibility focused={headerState === "focused"} state={contextMinimized ? "Minimized with workspace" : contextHidden && state !== "Minimized" ? "Hidden with workspace" : state} />}
        <span title={title}>{title}</span>{compact && grouped && <span className="window-layer__tab-count">{members.length}</span>}</Button>
      {showAll && visible.length > 0 && !contextMinimized && <Button variant="tertiary" size="small"
        aria-label={`${grouped ? "Minimize group:" : "Minimize"} ${title}`} leadingIcon={<WindowMinimize aria-hidden="true" />}
        onClick={() => members.forEach((entry) => entry.minimize())} />}
      {playing && <Badge dot variant="audio" role="status" aria-label="Now playing" />}
      {playback && <Button variant="tertiary" size="small" aria-label={`${playback.isPlaying ? "Pause" : "Play"} audio in ${title}${grouped ? " group" : ""}`}
        leadingIcon={playback.isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} onClick={playback.onToggle} />}
      {grouped && <WindowControlsMenu title={`group ${title}`} actions={[
        { label: "Restore group", onSelect: restore }, { label: "Rename group", onSelect: () => setRenaming(true) },
        ...(showAll ? entries[0].getActions().filter((action) => action.label === "Manage workspace"
          || action.label === "Move to Draft Workspace" || action.label === "Move to Unsaved Workspace" || action.label.startsWith("Move to workspace:")) : []),
      ]} />}
      {!grouped && <WindowControlsMenu title={title} actions={[...entries[0].getActions().map((action) => ({
        ...action, onSelect: () => { restore(); action.onSelect(); },
      })), ...(compact ? [{ label: `Close ${title}`, onSelect: entries[0].close, disabled: entries[0].closeDisabled }] : [])]} />}
      {!grouped && !compact && <Button variant="tertiary" size="small" disabled={entries[0].closeDisabled}
        aria-label={`Close ${title}`} leadingIcon={<X aria-hidden="true" />} onClick={entries[0].close} />}
    </header>
    {addition && <div className="window-addition-label">{addition.label}</div>}
    {grouped && !compact && <div className="window-layer__group-summary">
      {grouped && <span>{members.length} tabs{showAll ? ` · ${members.filter((entry) => entry.minimized).length} minimized` : entries.length < members.length ? ` · ${entries.length} minimized` : ""}</span>}
    </div>}
    {renaming && <GroupNameForm title={title} onSave={(name) => { onRename(name); setRenaming(false); }} onCancel={() => setRenaming(false)} />}
    {preview && <MinimizedWindowPreview preview={preview} />}
    {playing && <div className="window-layer__playing"><span title={playing.playback?.trackTitle ?? playing.title}>
      Playing: {playing.playback?.trackTitle ?? playing.title}</span></div>}
    {grouped && <div id={tabsId} hidden={compact && !expanded} className="window-layer__group-tabs">{entries.map((entry) => <div key={entry.id} className="window-layer__dock-entry">
      <Button variant="tertiary" size="small" className="window-layer__dock-item window-layer__restore" aria-label={`${showAll && !entry.minimized && !contextMinimized ? "Focus" : "Restore"} ${entry.title}`}
        data-tutorial-subject={entry.id}
        data-window-kind={entry.kind === "vocal" || entry.kind === "sample" || entry.kind === "dub" ? entry.kind : "other"}
        data-window-state={controlState([entry])} aria-current={controlState([entry]) === "focused" ? true : undefined}
        {...activation(entry.id, () => focus(entry))}>
        {compact && showAll && <WindowVisibility focused={controlState([entry]) === "focused"} state={contextMinimized ? "Minimized with workspace" : entry.minimized ? "Minimized" : contextHidden ? "Hidden with workspace" : entry.visible ? entry.placement === "fullscreen" ? "Maximized" : "Visible" : "Inactive tab"} />}
        {entry.playback?.isPlaying && <Badge dot variant="audio" aria-label="Now playing" />}<span title={entry.title}>{entry.title}</span>
        {!compact && showAll && <WindowVisibility focused={controlState([entry]) === "focused"} state={contextMinimized ? "Minimized with workspace" : entry.minimized ? "Minimized" : contextHidden ? "Hidden with workspace" : entry.visible ? entry.placement === "fullscreen" ? "Maximized" : "Visible" : "Inactive tab"} />}
      </Button>
      {showAll && !compact && !entry.minimized && !contextMinimized && <Button variant="tertiary" size="small" aria-label={`Minimize ${entry.title}`}
        leadingIcon={<WindowMinimize aria-hidden="true" />} onClick={entry.minimize} />}
      {!compact && entry.playback && <Button variant="tertiary" size="small" aria-label={`${entry.playback.isPlaying ? "Pause" : "Play"} audio in ${entry.title}`}
        leadingIcon={entry.playback.isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} onClick={entry.playback.onToggle} />}
      {compact ? <WindowControlsMenu title={entry.title} actions={[
        { label: `Minimize ${entry.title}`, onSelect: entry.minimize },
        { label: `Close ${entry.title}`, onSelect: entry.close, disabled: entry.closeDisabled },
      ]} /> : <Button variant="tertiary" size="small" disabled={entry.closeDisabled} aria-label={`Close ${entry.title}`}
        leadingIcon={<X aria-hidden="true" />} onClick={entry.close} />
      }
    </div>)}</div>}
  </section>;
}

export function WindowLayer({ children, className = "", initialWorkspace, onWorkspaceChange, playerTrackId = null, onActiveGroupChange, tracklistControl, childrenInPage = false, featureWindows, container, onContext, windowManager }: {
  children: ReactNode; className?: string;
  initialWorkspace?: WindowWorkspace | null;
  onWorkspaceChange?: (workspace: WindowWorkspace) => void;
  playerTrackId?: string | null;
  onActiveGroupChange?: (group: ActiveWindowGroup | null) => void;
  tracklistControl?: WindowTracklistControl;
  childrenInPage?: boolean;
  featureWindows?: FeatureWindowSystem;
  container?: HTMLElement | null;
  onContext?: (context: NonNullable<ContextType<typeof WindowContext>>) => void;
  windowManager?: ReactNode;
}) {
  const routing = useWorkspaceRouting();
  const cascadeSlots = useRef(new Map<string, number>());
  const initialOffset = useCallback((id: string) => {
    if (!cascadeSlots.current.has(id)) cascadeSlots.current.set(id, cascadeSlots.current.size);
    return (cascadeSlots.current.get(id)! % 6) * 32;
  }, []);
  const [windows, setWindows] = useState<WindowEntry[]>([]);
  const liveWindows = useRef(windows);
  liveWindows.current = windows;
  const [previews, setPreviews] = useState<Record<string, WindowPreview>>({});
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const dockId = useId();
  useEffect(() => {
    const minimized = new Set(windows.filter((entry) => entry.minimized).map((entry) => entry.id));
    if (!minimized.size) setDockCollapsed(false);
    setPreviews((current) => Object.keys(current).some((id) => !minimized.has(id))
      ? Object.fromEntries(Object.entries(current).filter(([id]) => minimized.has(id))) : current);
  }, [windows]);
  const updatingVisibility = useRef(false);
  const autoGroupPending = useRef(false);
  const handledAutoGroups = useRef(new Set<string>());
  const [, updateAutoGroups] = useState(0);
  useLayoutEffect(() => { autoGroupPending.current = false; });
  const [groups, setGroups] = useState<Record<string, string>>(() => Object.fromEntries(
    (initialWorkspace?.windows ?? []).filter((entry) => entry.group).map((entry) => [entry.id, entry.group!]),
  ));
  const groupSequence = useRef(Math.max(0, ...(initialWorkspace?.windows.map((entry) =>
    Number(entry.group?.match(/-group-(\d+)$/)?.[1] ?? 0)) ?? [])));
  const dockSequence = useRef(Math.max(0, ...(initialWorkspace?.windows.map((entry) => entry.dockOrder) ?? [])));
  const [dockWidths, setDockWidths] = useState<Record<string, number | null>>(initialWorkspace?.dockWidths ?? {});
  const [groupTitles, setGroupTitles] = useState<Record<string, string>>(() => Object.fromEntries(
    (initialWorkspace?.windows ?? []).filter((entry) => entry.group && entry.groupTitle)
      .map((entry) => [entry.group!, entry.groupTitle!]),
  ));
  const [tabOrders, setTabOrders] = useState<Record<string, number>>(() => Object.fromEntries(
    (initialWorkspace?.windows ?? []).map((entry) => [entry.id, entry.tabOrder ?? entry.order]),
  ));
  const hydratedWorkspace = useRef(initialWorkspace);
  const [restoredWorkspace, setRestoredWorkspace] = useState<WindowWorkspace | null>(null);
  const restoreWorkspace = useCallback((workspace: WindowWorkspace) => {
    setRestoredWorkspace(workspace);
    setGroups(Object.fromEntries(workspace.windows.filter((entry) => entry.group).map((entry) => [entry.id, entry.group!])));
    setGroupTitles(Object.fromEntries(workspace.windows.filter((entry) => entry.group && entry.groupTitle).map((entry) => [entry.group!, entry.groupTitle!])));
    setTabOrders(Object.fromEntries(workspace.windows.map((entry) => [entry.id, entry.tabOrder ?? entry.order])));
    setDockWidths(workspace.dockWidths);
    liveWindows.current.forEach((entry) => {
      const saved = workspace.windows.find((item) => item.id === entry.id);
      if (saved) entry.restoreLayout(saved.frame, saved.restoreFrame, saved.minimized, saved.title);
    });
  }, []);
  useLayoutEffect(() => {
    if (!initialWorkspace || hydratedWorkspace.current) return;
    hydratedWorkspace.current = initialWorkspace;
    setGroups(Object.fromEntries(initialWorkspace.windows.filter((entry) => entry.group).map((entry) => [entry.id, entry.group!])));
    setGroupTitles(Object.fromEntries(initialWorkspace.windows.filter((entry) => entry.group && entry.groupTitle).map((entry) => [entry.group!, entry.groupTitle!])));
    setTabOrders(Object.fromEntries(initialWorkspace.windows.map((entry) => [entry.id, entry.tabOrder ?? entry.order])));
    setDockWidths(initialWorkspace.dockWidths);
    dockSequence.current = Math.max(dockSequence.current, ...initialWorkspace.windows.map((entry) => entry.dockOrder));
    groupSequence.current = Math.max(groupSequence.current, ...initialWorkspace.windows.map((entry) => Number(entry.group?.match(/-group-(\d+)$/)?.[1] ?? 0)));
  }, [initialWorkspace]);
  const layerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setGroupTitles((current) => {
      const missing = windows.filter((entry) => groups[entry.id] && !current[groups[entry.id]]);
      if (!missing.length) return current;
      const next = { ...current };
      missing.sort((a, b) => a.order - b.order).forEach((entry) => { next[groups[entry.id]] ??= entry.title.slice(0, 100); });
      return next;
    });
  }, [windows, groups]);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const mountLayer = useCallback((element: HTMLDivElement | null) => { layerRef.current = element; setHost(element); }, []);
  type Arrangement = {
    groups: Record<string, string>; groupTitles: Record<string, string>; tabOrders: Record<string, number>;
    entries: { id: string; frame: WindowFrame; restoreFrame: WindowFrame | null; minimized: boolean; order: number; dockOrder?: number }[];
  };
  const dragArrangement = useRef<Arrangement | null>(null);
  const restoredDockOrders = useRef(new Map<string, Arrangement["entries"][number]>());
  const [undo, setUndo] = useState<{ message: string; arrangement: Arrangement } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undo]);
  function arrangement(): Arrangement {
    return { groups: { ...groups }, groupTitles: { ...groupTitles }, tabOrders: { ...tabOrders },
      entries: windows.map((entry) => ({ id: entry.id, frame: entry.getFrame(), restoreFrame: entry.restoreFrame,
        minimized: entry.minimized, order: entry.order, dockOrder: entry.dockOrder })) };
  }
  function rememberArrangement(message: string) {
    setUndo({ message, arrangement: dragArrangement.current ?? arrangement() });
    dragArrangement.current = null;
  }
  function restoreArrangement() {
    if (!undo) return;
    const saved = undo.arrangement;
    restoredDockOrders.current = new Map(saved.entries.map((entry) => [entry.id, entry]));
    const ids = new Set(windows.map((entry) => entry.id));
    setGroups(Object.fromEntries(Object.entries(saved.groups).filter(([id]) => ids.has(id))));
    setGroupTitles(saved.groupTitles);
    setTabOrders(saved.tabOrders);
    saved.entries.sort((a, b) => a.order - b.order).forEach((item) => {
      const entry = windows.find((entry) => entry.id === item.id);
      if (!entry) return;
      entry.restoreLayout(item.frame, item.restoreFrame, item.minimized);
      entry.activate();
    });
    setUndo(null);
    setWindows((current) => current.map((entry) => ({ ...entry,
      dockOrder: saved.entries.find((item) => item.id === entry.id)?.dockOrder ?? entry.dockOrder })));
    setFocused(true);
  }
  function groupTitle(id: string) {
    const group = groups[id] ?? id;
    return groupTitles[group] ?? windows.filter((entry) => groups[entry.id] === group || entry.id === id)
      .sort((a, b) => (tabOrders[a.id] ?? a.order) - (tabOrders[b.id] ?? b.order))[0]?.title ?? "Window group";
  }
  function renameGroup(id: string, title: string) {
    setGroupTitles((current) => ({ ...current, [groups[id] ?? id]: title }));
  }
  function reorder(ids: string[]) {
    rememberArrangement("Tab order changed");
    setTabOrders((current) => ({ ...current, ...Object.fromEntries(ids.map((id, index) => [id, index])) }));
  }
  function minimizedTargets() {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-window-drop-target]"))
      .flatMap((element) => {
        if (element.closest("[hidden], dialog:not([open])")) return [];
        const entry = windows.find((entry) => entry.id === element.dataset.windowDropTarget);
        return entry ? [{ entry, element }] : [];
      });
  }
  const [focused, setFocused] = useState(true);
  const [minimizeNotice, setMinimizeNotice] = useState<{ ids: string[]; expiresAt: number }>({ ids: [], expiresAt: 0 });
  const recentlyMinimized = minimizeNotice.ids;
  useEffect(() => {
    if (!minimizeNotice.expiresAt) return;
    const timer = window.setTimeout(() => setMinimizeNotice({ ids: [], expiresAt: 0 }), Math.max(0, minimizeNotice.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [minimizeNotice.expiresAt]);
  const activeGroupCallback = useRef(onActiveGroupChange);
  useLayoutEffect(() => { activeGroupCallback.current = onActiveGroupChange; });
  const lastActiveGroup = useRef("");
  useEffect(() => {
    const active = focused ? windows.filter((entry) => isOpenWindow(entry) && !entry.minimized).reduce<WindowEntry | undefined>(
      (latest, entry) => !latest || latest.order < entry.order ? entry : latest, undefined) : undefined;
    const members = active ? windows.filter((entry) => isOpenWindow(entry) && (entry.id === active.id
      || (groups[active.id] && groups[entry.id] === groups[active.id]))) : [];
    const group: ActiveWindowGroup | null = active ? {
      id: groups[active.id] ?? active.id, title: groups[active.id] ? groupTitle(active.id) : active.title, activeWindowId: active.id,
      windows: members.sort((a, b) => (tabOrders[a.id] ?? a.order) - (tabOrders[b.id] ?? b.order))
        .map((entry) => ({ id: entry.id, title: entry.title })),
    } : null;
    const serialized = JSON.stringify(group);
    if (lastActiveGroup.current === serialized) return;
    lastActiveGroup.current = serialized;
    activeGroupCallback.current?.(group);
  }, [windows, groups, focused, groupTitles, tabOrders]);
  useEffect(() => {
    let tabbing = false;
    const minimizeOutside = (event: Event) => {
      if (container?.classList.contains("workspace-surface")) return; // The ancestor workspace hides its children without changing their arrangement.
      if (event.composedPath().some((target) => target instanceof Element
        && (target.classList.contains("window-layer") || target.hasAttribute("data-window-system")))) return;
      setFocused(false);
      if (routing) { routing.hideWindows(); return; }
      const visible = windows.filter((entry) => isOpenWindow(entry) && !entry.minimized);
      if (visible.length) {
        const snapshots = visible.map(captureWindowPreview).filter((preview) => preview !== null);
        setPreviews((current) => ({ ...current, ...Object.fromEntries(snapshots.map((preview) => [preview.id, preview])) }));
        setMinimizeNotice({ ids: visible.map((entry) => entry.id), expiresAt: Date.now() + 4000 });
      }
      visible.forEach((entry) => entry.minimize());
    };
    const pointerDown = (event: PointerEvent) => { tabbing = false; minimizeOutside(event); };
    const keyDown = (event: KeyboardEvent) => { tabbing = event.key === "Tab"; minimizeOutside(event); };
    const keyUp = () => { tabbing = false; };
    const focusIn = (event: FocusEvent) => { if (tabbing) minimizeOutside(event); };
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("click", minimizeOutside, true);
    document.addEventListener("wheel", minimizeOutside, { capture: true, passive: true });
    document.addEventListener("keydown", keyDown, true);
    document.addEventListener("keyup", keyUp, true);
    document.addEventListener("focusin", focusIn, true);
    return () => {
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("click", minimizeOutside, true);
      document.removeEventListener("wheel", minimizeOutside, true);
      document.removeEventListener("keydown", keyDown, true);
      document.removeEventListener("keyup", keyUp, true);
      document.removeEventListener("focusin", focusIn, true);
    };
  }, [windows, container, routing?.hideWindows]);
  const setDockWidth = useCallback((side: "left" | "right", width: number | null, scope: string) => {
    const key = `${scope}:${side}`;
    setDockWidths((current) => current[key] === width ? current : { ...current, [key]: width });
  }, []);
  const register = useCallback((entry: WindowEntry) => {
    const restored = restoredDockOrders.current.get(entry.id);
    const dockOrder = restored && restored.minimized === entry.minimized
      && JSON.stringify(restored.frame) === JSON.stringify(entry.frame) ? restored.dockOrder : undefined;
    if (dockOrder !== undefined) restoredDockOrders.current.delete(entry.id);
    setWindows((current) => {
      const existing = current.find((item) => item.id === entry.id);
      if (!existing) return [...current, { ...entry, dockOrder: (restoredWorkspace ?? initialWorkspace)?.windows.find((saved) => saved.id === entry.id)?.dockOrder ?? ++dockSequence.current }];
      if (existing.title === entry.title && existing.groupScope === entry.groupScope && existing.kind === entry.kind
        && existing.persistent === entry.persistent && existing.autoGroup === entry.autoGroup
        && existing.closeDisabled === entry.closeDisabled
        && existing.playback?.isPlaying === entry.playback?.isPlaying && existing.playback?.onToggle === entry.playback?.onToggle
        && existing.playback?.trackTitle === entry.playback?.trackTitle
        && (dockOrder === undefined || existing.dockOrder === dockOrder)
        && existing.customTitle === entry.customTitle && JSON.stringify(existing.frame) === JSON.stringify(entry.frame)
        && JSON.stringify(existing.restoreFrame) === JSON.stringify(entry.restoreFrame)
        && existing.placement === entry.placement && existing.minimized === entry.minimized && existing.visible === entry.visible
        && existing.order === entry.order && existing.activate === entry.activate && existing.element === entry.element) return current;
      return current.map((item) => item.id === entry.id
        ? { ...entry, dockOrder: dockOrder ?? (existing.placement === entry.placement ? existing.dockOrder : ++dockSequence.current) } : item);
    });
  }, [initialWorkspace, restoredWorkspace]);
  const unregister = useCallback((id: string) => {
    handledAutoGroups.current.delete(id);
    setWindows((current) => current.filter((entry) => entry.id !== id));
    setGroups((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);
  function detach(id: string) {
    if (!groups[id]) return;
    rememberArrangement("Tab ungrouped");
    setGroups((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  function join(source: string, target: string, frame: WindowFrame, {
    includeSourceGroup = true, keepMinimized = false, undoable = true, preserveHidden = false,
  }: JoinOptions = {}) {
    const targetEntry = windows.find((entry) => entry.id === target);
    if (!targetEntry) return;
    if (undoable) rememberArrangement("Window group changed");
    const members = windows.filter((entry) => isOpenWindow(entry) && entry.groupScope === targetEntry.groupScope && (
      entry.id === source || entry.id === target
      || (includeSourceGroup && groups[source] && groups[entry.id] === groups[source])
      || (groups[target] && groups[entry.id] === groups[target])
    ));
    const groupId = groups[target] ?? `${target}-group-${++groupSequence.current}`;
    setGroupTitles((current) => current[groupId] ? current : { ...current, [groupId]: targetEntry.title.slice(0, 100) });
    const ordered = [...members.filter((entry) => entry.id === target || (groups[target] && groups[entry.id] === groups[target]))
      .sort((a, b) => (tabOrders[a.id] ?? a.order) - (tabOrders[b.id] ?? b.order)),
    ...members.filter((entry) => entry.id !== target && (!groups[target] || groups[entry.id] !== groups[target]))
      .sort((a, b) => (tabOrders[a.id] ?? a.order) - (tabOrders[b.id] ?? b.order))];
    if (undoable) {
      const addedIds = members.filter((entry) => entry.id !== target && (!groups[target] || groups[entry.id] !== groups[target])).map((entry) => entry.id);
      routing?.added(addedIds, routing.owners[target] ?? "");
    }
    setTabOrders((current) => ({ ...current, ...Object.fromEntries(ordered.map((entry, index) => [entry.id, index])) }));
    setGroups((current) => ({ ...current, ...Object.fromEntries(members.map((entry) => [entry.id, groupId])) }));
    members.forEach((entry) => { entry.setFrame(frame, preserveHidden); if (keepMinimized) entry.minimize(); });
  }
  function move(source: string, target: string, includeSourceGroup = false) {
    const entry = windows.find((entry) => entry.id === target);
    if (!entry) return;
    const members = windows.filter((item) => isOpenWindow(item) && (item.id === target || (groups[target] && groups[item.id] === groups[target])));
    const minimized = members.every((entry) => entry.minimized);
    const frame = members.find((entry) => !entry.minimized)?.getFrame() ?? entry.getFrame();
    join(source, target, frame, { includeSourceGroup, keepMinimized: minimized, preserveHidden: true });
    if (!minimized) windows.find((entry) => entry.id === source)?.activate();
  }
  function syncFrame(source: string, frame: WindowFrame) {
    if (!groups[source]) return;
    windows.filter((entry) => isOpenWindow(entry) && entry.id !== source && groups[entry.id] === groups[source])
      .forEach((entry) => entry.setFrame(frame, true));
  }
  const changeRef = useRef(onWorkspaceChange);
  useLayoutEffect(() => { changeRef.current = onWorkspaceChange; });
  useEffect(() => {
    changeRef.current?.({
      version: 1, playerTrackId, dockWidths,
      windows: windows.filter((entry) => entry.persistent).map((entry) => ({
        id: entry.id, title: entry.customTitle, frame: entry.frame, restoreFrame: entry.restoreFrame,
        minimized: entry.minimized, group: groups[entry.id] ?? null, order: entry.order, dockOrder: entry.dockOrder ?? 0,
        tabOrder: tabOrders[entry.id] ?? entry.order,
        ...(groups[entry.id] ? { groupTitle: groupTitle(entry.id) } : {}),
      })),
    });
  }, [windows, groups, dockWidths, playerTrackId, groupTitles, tabOrders]);
  const mobile = useMobileLayout();
  const minimizedEntries = windows.filter((entry) => isOpenWindow(entry) && entry.minimized);
  const minimizedGroups = [...new Set(minimizedEntries.map((entry) => groups[entry.id] ?? entry.id))]
    .map((id) => ({ id, entries: minimizedEntries.filter((entry) => (groups[entry.id] ?? entry.id) === id)
      .sort((a, b) => (tabOrders[a.id] ?? a.order) - (tabOrders[b.id] ?? b.order)),
    members: windows.filter((entry) => isOpenWindow(entry) && (groups[entry.id] ?? entry.id) === id) }));
  const undoControl = undo && <div className="window-layer__undo" role="status"><span>{undo.message}</span>
    <Button variant="secondary" size="small" onClick={restoreArrangement}>Undo</Button>
    <Button variant="tertiary" size="small" aria-label="Dismiss Undo" onClick={() => setUndo(null)} leadingIcon={<X aria-hidden="true" />} />
  </div>;
  const context: NonNullable<ContextType<typeof WindowContext>> = { windows, register, unregister, dockWidths, setDockWidth, groups, groupTitles, join, detach, syncFrame,
    groupTitle, renameGroup, reorder, tabOrders, minimizedTargets, move,
    beginDrag: () => { dragArrangement.current = arrangement(); }, endDrag: () => { dragArrangement.current = null; },
    undoControl: mobile ? undoControl : undefined, host: childrenInPage ? host ?? undefined : undefined, portalWindows: childrenInPage, updatingVisibility,
    claimAutoGroup: (id) => {
      const source = windows.find((entry) => entry.id === id);
      if (!source || autoGroupPending.current || windows.some((entry) => entry.autoGroup && entry.groupScope === source.groupScope && entry.order < source.order
        && !handledAutoGroups.current.has(entry.id))) return false;
      autoGroupPending.current = true; handledAutoGroups.current.add(id); return true;
    },
    finishAutoGroup: (id) => {
      if (handledAutoGroups.current.has(id)) return;
      handledAutoGroups.current.add(id); updateAutoGroups((value) => value + 1);
    },
    featureWindows, initialWorkspace: restoredWorkspace ?? initialWorkspace, restoreWorkspace, initialOffset, tracklistControl, contained: Boolean(container) && (!container?.classList.contains("workspace-stage") || !mobile), focus: () => setFocused(true),
    previews, recentlyMinimized, dismissMinimizeNotice: (ids) => setMinimizeNotice((current) => ({ ...current, ids: current.ids.filter((id) => !ids.includes(id)) })) };
  useLayoutEffect(() => { onContext?.(context); }, [windows, groups, groupTitles, host, initialWorkspace, restoredWorkspace, container, dockWidths, tabOrders, mobile, previews, recentlyMinimized]);
  return <WindowContext.Provider value={context}>
    {childrenInPage && children}
    {createPortal(<div ref={mountLayer} data-workspace-context={!container || container.classList.contains("workspace-stage") ? "" : undefined} className={`window-layer ${container ? "window-layer--contained" : ""} ${className}`}
    onPointerDownCapture={() => setFocused(true)} onClickCapture={() => setFocused(true)} onFocusCapture={() => setFocused(true)}>{!childrenInPage && children}
    {windowManager !== undefined ? windowManager : minimizedGroups.length > 0 && <nav
      className={`window-layer__dock${mobile ? "" : " window-layer__dock--desktop"}${dockCollapsed ? " window-layer__dock--collapsed" : ""}${dockCollapsed && recentlyMinimized.length ? " window-layer__dock--highlight" : ""}`} aria-label="Minimized windows">
      <header className="window-layer__dock-header">
        {!dockCollapsed && <span>Windows ({minimizedEntries.length})</span>}
        <Button variant="tertiary" size="small"
          aria-label={dockCollapsed ? `Show minimized windows (${minimizedEntries.length})` : "Collapse minimized windows"}
          aria-expanded={!dockCollapsed} aria-controls={dockId} onClick={() => setDockCollapsed((current) => !current)}
          leadingIcon={dockCollapsed ? <WindowRestore aria-hidden="true" /> : <WindowMinimize aria-hidden="true" />}>
          {dockCollapsed && <>Windows ({minimizedEntries.length})
            {windows.some((entry) => entry.minimized && entry.playback?.isPlaying) && <Badge dot variant="audio" aria-label="Now playing" />}
          </>}
        </Button>
      </header>
      <div className="window-layer__dock-groups" id={dockId} hidden={dockCollapsed}>
      {minimizedGroups.map(({ id, entries, members }) => <WindowGroupControl key={id}
        title={members.length > 1 ? groupTitle(entries[0].id) : entries[0].title} entries={entries} members={members}
        highlighted={entries.some((entry) => recentlyMinimized.includes(entry.id))}
        preview={entries.map((entry) => previews[entry.id]).find(Boolean)}
        onRestore={(ids) => setMinimizeNotice((current) => ({ ...current, ids: current.ids.filter((id) => !ids.includes(id)) }))}
        onRename={(title) => renameGroup(entries[0].id, title)} />)}
      </div>
    </nav>}
    {recentlyMinimized.length > 0 && <span className="sr-only" role="status">
      {recentlyMinimized.length} {recentlyMinimized.length === 1 ? "window minimized" : "windows minimized"}. Restore from {windowManager !== undefined ? "Workspace Manager" : "Minimized windows"}.
    </span>}
    {(!mobile || !windows.some((entry) => !entry.minimized && entry.element?.open)) && undoControl}
  </div>, container ?? document.body)}
  </WindowContext.Provider>;
}

export function FloatingWindow(props: FloatingWindowProps) {
  const routing = useWorkspaceRouting();
  const mobile = useMobileLayout();
  const fallback = useContext(WindowContext);
  const generated = useId();
  const id = props.windowId ?? generated;
  const initialOwner = useRef(routing?.owners[id] ?? routing?.openOwner(id) ?? "");
  const previousRequest = useRef(0);
  const requestChanged = previousRequest.current !== (props.openRequest ?? 0);
  const owner = requestChanged ? routing?.openOwner(id) ?? "" : routing?.owners[id] ?? initialOwner.current;
  const previousContext = useRef<WindowLayerContext | null>(null);
  const destination = routing?.layers[owner];
  const context = routing ? destination?.host ? destination : previousContext.current : fallback;
  previousContext.current = context;
  const workspaceSheet = mobile && props.kind === "workspace";
  const portalHost = workspaceSheet ? routing?.layers[""]?.host : context?.host;
  const [host] = useState(() => document.createElement("div"));
  host.style.display = "contents";
  host.dataset.workspaceContext = owner;
  useLayoutEffect(() => { previousRequest.current = props.openRequest ?? 0; routing?.bind(id, owner, requestChanged); }, [id, owner, props.openRequest, routing?.bind]);
  useInsertionEffect(() => {
    if (!routing || !portalHost) return;
    portalHost.append(host);
    return () => host.remove();
  }, [routing !== null, portalHost, host]);
  if (!routing) return <FloatingWindowView {...props} />;
  if (!context?.host) return null;
  return <WindowContext.Provider value={{ ...context, host, portalWindows: true, contained: workspaceSheet ? false : context.contained,
    featureWindows: routing.featureWindows, tracklistControl: routing.tracklistControl }}>
    <FloatingWindowView {...props} windowId={id}
      active={props.active || routing.active(id)}
      suspended={props.suspended || routing.hidden(id)}
      menuActions={[...props.menuActions ?? [], ...routing.actions(id)]} />
  </WindowContext.Provider>;
}

export function FloatingWindowView({ windowId, groupWith, title: originalTitle, children, active, order, openRequest = 0, onActivate, onClose, onMinimize, className = "", groupScope = "", autoGroup = false, kind, menuActions = [], playback, closeDisabled = false, persistent = true, suspended = false }: FloatingWindowProps) {
  const reportActivity = useReportTutorialActivity();
  const tutorialNavigation = useContext(TutorialNavigationContext);
  const [guidedRequest, setGuidedRequest] = useState<number | null>(null);
  const tutorialPresentation = Boolean(tutorialNavigation?.ready) || guidedRequest === openRequest;
  useEffect(() => {
    if (tutorialNavigation?.ready) setGuidedRequest(openRequest);
  }, [tutorialNavigation?.ready, openRequest]);
  const routing = useWorkspaceRouting();
  const generatedId = useId();
  const titleId = windowId ?? generatedId;
  const layout = useContext(WindowContext);
  const [saved] = useState(() => openRequest === 0 || routing ? layout?.initialWorkspace?.windows.find((entry) => entry.id === titleId) : undefined);
  const initialSizePending = useRef(!saved);
  const [customTitle, setCustomTitle] = useState<string | null>(saved?.title ?? null);
  const title = customTitle ?? originalTitle;
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const [groupEditor, setGroupEditor] = useState<"move" | "rename" | null>(null);
  const [targetGroup, setTargetGroup] = useState("");
  const [groupError, setGroupError] = useState("");
  const playbackRef = useRef(playback);
  useLayoutEffect(() => { playbackRef.current = playback; });
  const togglePlayback = useCallback(() => playbackRef.current?.onToggle(), []);
  const playing = playback?.isPlaying;
  const mobile = useMobileLayout();
  const ref = useRef<HTMLDialogElement>(null);
  const register = layout?.register;
  const unregister = layout?.unregister;
  const activateRef = useRef(onActivate);
  useLayoutEffect(() => { activateRef.current = onActivate; }, [onActivate]);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });
  const close = useCallback(() => closeRef.current(), []);
  const actionsRef = useRef<NonNullable<FloatingWindowProps["menuActions"]>>([]);
  const getActions = useCallback(() => actionsRef.current, []);
  const revealWindows = routing?.revealWindows;
  const restore = useCallback(() => { revealWindows?.(titleId); setMinimized(false); activateRef.current(); }, [revealWindows, titleId]);
  const activate = restore;
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [placement, setPlacement] = useState<Placement>(saved?.frame.placement ?? "floating");
  const [minimized, setMinimized] = useState(openRequest > 0 ? false : saved?.minimized ?? false);
  const previousMinimized = useRef(minimized);
  useEffect(() => {
    if (previousMinimized.current !== minimized) {
      reportActivity({ type: minimized ? "window-minimized" : "window-restored", subjectId: titleId });
      previousMinimized.current = minimized;
    }
  }, [minimized, titleId, reportActivity]);
  const minimizeWindow = useCallback(() => setMinimized(true), []);
  const maximizedFrame = useRef<WindowFrame | null>(saved?.restoreFrame ?? null);
  const [offset] = useState(() => layout?.initialOffset(saved?.group ?? titleId) ?? (order % 6) * 32);
  const dock = placement === "left" || placement === "right" ? placement : null;
  const allGroup = layout?.windows.filter((entry) => isOpenWindow(entry) && entry.groupScope === groupScope && (
    layout.groups[titleId] && layout.groups[entry.id] === layout.groups[titleId]
  )).sort((a, b) => (layout.tabOrders[a.id] ?? a.order) - (layout.tabOrders[b.id] ?? b.order)) ?? [];
  const addedEntry = [...allGroup.map((entry) => ({ id: entry.id, kind: entry.kind })), { id: titleId, kind }]
    .filter((entry) => routing?.additions[entry.id]).sort((a, b) => routing!.additions[b.id].expiresAt - routing!.additions[a.id].expiresAt)[0];
  const addition = addedEntry && routing?.additions[addedEntry.id];
  const group = allGroup.filter((entry) => !entry.minimized && entry.placement === placement);
  const selected = group.reduce<WindowEntry | undefined>((latest, entry) => !latest || entry.order > latest.order ? entry : latest, undefined);
  const tabbed = !mobile && !minimized && group.length > 1;
  const dockHidden = tabbed && selected?.id !== titleId;
  const minimizedGroupHidden = Boolean(layout) && minimized;
  const isVisible = !suspended && (mobile ? Boolean(active) && !minimized : !dockHidden && !minimizedGroupHidden);
  useLayoutEffect(() => {
    if (active && !minimized && !suspended) layout?.focus();
  }, [active, minimized, suspended, layout?.host]);
  const destinations = layout?.windows.filter((entry) => isOpenWindow(entry) && entry.groupScope === groupScope && entry.id !== titleId
    && (!layout.groups[titleId] || layout.groups[titleId] !== layout.groups[entry.id]))
    .filter((entry, index, entries) => entries.findIndex((other) => (layout.groups[other.id] ?? other.id)
      === (layout.groups[entry.id] ?? entry.id)) === index) ?? [];
  function minimizedDrop(x: number, y: number) {
    return layout?.minimizedTargets().find(({ entry, element }) => {
      if (entry.id === titleId || entry.groupScope !== groupScope
        || (layout.groups[titleId] && layout.groups[titleId] === layout.groups[entry.id])) return false;
      const bounds = element.getBoundingClientRect();
      return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    });
  }
  function groupingTargets(x: number, y: number): WindowSnapTarget<string>[] {
    const viewport = ref.current ? windowViewport(ref.current) : { left: 0, top: 0 };
    const minimized = minimizedDrop(x, y);
    if (minimized) {
      const bounds = minimized.element.getBoundingClientRect();
      return [{ kind: `minimized:${minimized.entry.id}`, active: true,
        style: { left: bounds.left - viewport.left, top: bounds.top - viewport.top, width: bounds.width, height: bounds.height } }];
    }
    return (layout?.windows ?? []).filter((entry) => entry.groupScope === groupScope && entry.id !== titleId && !entry.minimized && entry.element?.open
      && !group.some((member) => member.id === entry.id))
      .sort((a, b) => b.order - a.order).map((entry) => {
        const element = entry.element!;
        const bounds = element.getBoundingClientRect();
        const regions = element.querySelectorAll<HTMLElement>(".floating-window__header, .floating-window__tabs");
        const hit = Array.from(regions).some((region) => {
          const rect = region.getBoundingClientRect();
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        });
        return { kind: `group:${entry.id}`, active: hit,
          style: { left: bounds.left - viewport.left, top: bounds.top - viewport.top, width: bounds.width, height: bounds.height } };
      });
  }
  const movement = useWindowPosition(ref, !mobile && !dockHidden && placement !== "fullscreen" && !minimized, {
    initialPosition: saved?.frame.position ?? "initial",
    targets: (element, point, x, y) => {
      const workspace = routing?.workspaceDropTarget(titleId, x, y);
      if (workspace) {
        const viewport = windowViewport(element);
        return [{ kind: `workspace:${workspace.id}`, active: true, style: {
          left: workspace.bounds.left - viewport.left, top: workspace.bounds.top - viewport.top,
          width: workspace.bounds.width, height: workspace.bounds.height,
        } }];
      }
      const grouping = groupingTargets(x, y).find((target) => target.active);
      return grouping ? [grouping] : dockTargets(element, point, x, y);
    },
    onSnap: (target): WindowPosition => {
      if (target.startsWith("workspace:")) {
        routing?.moveIntoWorkspace(titleId, target.slice(10));
        return "initial";
      }
      if (target === "left" || target === "right") { setPlacement(target); return null; }
      if (target.startsWith("minimized:")) {
        const id = target.slice(10);
        layout?.move(titleId, id, true);
        return layout?.windows.find((entry) => entry.id === id)?.getFrame().position ?? movement.position;
      }
      const entry = layout?.windows.find((item) => `group:${item.id}` === target);
      if (!entry?.element || !layout) return movement.position;
      const bounds = entry.element.getBoundingClientRect();
      const viewport = windowViewport(entry.element);
      const position = { x: bounds.left - viewport.left, y: bounds.top - viewport.top };
      layout.join(titleId, entry.id, { placement: entry.placement, position, size: entry.placement === "floating"
        ? { width: bounds.width, height: bounds.height } : null });
      return position;
    },
  });
  const resize = useWindowResize(ref, !mobile && !dockHidden && !minimized, placement, movement.setPosition,
    (width) => { if (dock) layout?.setDockWidth(dock, width, groupScope); }, saved?.frame.size);
  useEffect(() => {
    const update = () => {
      const bounds = ref.current ? windowViewport(ref.current) : { width: window.innerWidth, height: window.innerHeight };
      setViewport((previous) => previous.width === bounds.width && previous.height === bounds.height ? previous : { width: bounds.width, height: bounds.height });
    };
    update();
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    const container = ref.current?.closest(".workspace-surface, .workspace-stage");
    if (container) observer?.observe(container);
    return () => { window.removeEventListener("resize", update); observer?.disconnect(); };
  }, [layout?.host, layout?.contained]);
  const setFrame = useCallback((frame: WindowFrame, preserveMinimized = false) => {
    if (!preserveMinimized) setMinimized(false);
    setPlacement(frame.placement); movement.setPosition(frame.position); resize.setSize(frame.size);
  }, [movement.setPosition, resize.setSize]);
  const frameRef = useRef<WindowFrame>({ placement, position: movement.position, size: resize.size });
  const dragStartFrame = useRef<WindowFrame | null>(null);
  const headerDragged = useRef(false);
  useLayoutEffect(() => { frameRef.current = { placement, position: movement.position, size: resize.size }; });
  const getFrame = useCallback(() => frameRef.current, []);
  const restoreLayout = useCallback((frame: WindowFrame, restoreFrame: WindowFrame | null, minimized: boolean, title?: string | null) => {
    initialSizePending.current = false;
    maximizedFrame.current = restoreFrame;
    setFrame(frame);
    setMinimized(minimized);
    if (title !== undefined) setCustomTitle(title);
  }, [setFrame]);
  useLayoutEffect(() => { if (!ref.current) return; register?.({ id: titleId, groupScope, title, kind, customTitle,
    frame: getFrame(), restoreFrame: maximizedFrame.current, persistent, autoGroup, close, closeDisabled, getActions,
    playback: playing === undefined ? undefined : { isPlaying: playing, onToggle: togglePlayback, trackTitle: playback?.trackTitle }, placement, minimized, visible: isVisible, order, activate, restore, minimize: minimizeWindow, element: ref.current, setFrame, getFrame, restoreLayout });
  }, [register, titleId, groupScope, title, kind, customTitle, persistent, autoGroup, close, closeDisabled, playing, togglePlayback, playback?.trackTitle, placement, minimized, isVisible, order, activate, restore, minimizeWindow, setFrame, getFrame, restoreLayout, movement.position, resize.size, layout?.host]);
  const initialGroupHandled = useRef(false);
  useLayoutEffect(() => {
    if (initialGroupHandled.current || !layout?.windows.some((entry) => entry.id === titleId)) return;
    if (!autoGroup || saved || groupWith || layout.groups[titleId]) {
      initialGroupHandled.current = true; layout.finishAutoGroup(titleId); return;
    }
    // Media auto-grouping never captures a mixed group; feature dialogs share a default group.
    const candidates = layout.windows.filter((entry) => isOpenWindow(entry) && entry.id !== titleId && entry.groupScope === groupScope && entry.order < order);
    const membersOf = (candidate: WindowEntry) => {
      const group = layout.groups[candidate.id];
      return group ? candidates.filter((entry) => layout.groups[entry.id] === group) : [candidate];
    };
    const target = [...candidates].sort((a, b) => b.order - a.order)
      .find((entry) => kind === "dialog" ? entry.kind === "dialog" : membersOf(entry).every((member) => member.kind === kind));
    if (!target) { initialGroupHandled.current = true; layout.finishAutoGroup(titleId); return; }
    if (!layout.claimAutoGroup(titleId)) return;
    initialGroupHandled.current = true;
    const frame = target.getFrame();
    const bounds = !mobile && !target.minimized ? target.element?.getBoundingClientRect() : undefined;
    const viewport = target.element ? windowViewport(target.element) : { left: 0, top: 0 };
    layout.join(titleId, target.id, bounds && frame.placement === "floating"
      ? { ...frame, position: { x: bounds.left - viewport.left, y: bounds.top - viewport.top }, size: { width: bounds.width, height: bounds.height } }
      : frame, { undoable: false });
  }, [layout, titleId, autoGroup, groupScope, kind, mobile, saved, groupWith, order]);
  const groupedRequest = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!groupWith || groupedRequest.current === groupWith.request || !layout) return;
    const target = layout.windows.find((entry) => entry.id === groupWith.id);
    if (!target || !layout.windows.some((entry) => entry.id === titleId)) return;
    groupedRequest.current = groupWith.request;
    layout.join(titleId, target.id, target.getFrame(), { includeSourceGroup: false, undoable: false });
    activate();
  }, [groupWith, layout, titleId, activate]);
  const syncFrameRef = useRef(layout?.syncFrame);
  useLayoutEffect(() => { syncFrameRef.current = layout?.syncFrame; });
  const groupId = layout?.groups[titleId];
  useLayoutEffect(() => {
    if (active && !mobile && !minimized && groupId) syncFrameRef.current?.(titleId, {
      placement, position: movement.position, size: resize.size,
    });
  }, [active, mobile, minimized, titleId, groupId, placement, movement.position, resize.size]);
  useLayoutEffect(() => () => { unregister?.(titleId); }, [unregister, titleId]);
  const previousOpenRequest = useRef(openRequest);
  useLayoutEffect(() => {
    if (previousOpenRequest.current !== openRequest) restore();
    previousOpenRequest.current = openRequest;
  }, [openRequest, restore]);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const modal = useRef(false);
  const changingVisibility = useRef(false);
  useLayoutEffect(() => {
    const dialog = ref.current;
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const returnFocus = document.activeElement === document.body || dialog?.contains(document.activeElement);
      if (dialog?.open) dialog.close();
      if (returnFocus && restoreFocus.current?.isConnected) restoreFocus.current.focus();
    };
  }, [layout?.host]);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const wasOpen = dialog.open;
    const previousFocus = document.activeElement;
    const previousVisibilityUpdate = layout?.updatingVisibility.current ?? false;
    if (layout) layout.updatingVisibility.current = true;
    changingVisibility.current = true;
    // Native modal dialogs occupy the top layer; only the active mobile window opens there.
    const visible = isVisible;
    const shouldModal = mobile && !layout?.contained && !tutorialPresentation;
    if (dialog.open && (modal.current !== shouldModal || !visible)) dialog.close();
    if (mobile) {
      if (visible && !dialog.open) { if (shouldModal) dialog.showModal(); else dialog.show(); }
    } else {
      if (visible && !dialog.open) dialog.show();
    }
    modal.current = shouldModal;
    if (visible && !active && !wasOpen && previousFocus instanceof HTMLElement && previousFocus.isConnected
      && !dialog.contains(previousFocus) && (previousFocus.closest("dialog")?.open ?? true)) previousFocus.focus({ preventScroll: true });
    if (visible && active && (!dialog.contains(document.activeElement) || (!wasOpen && tabbed))) {
      const target = dialog.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
        ?? dialog.querySelector<HTMLButtonElement>(".floating-window__close");
      target?.focus({ preventScroll: true });
      if (tabbed) target?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
    changingVisibility.current = false;
    if (layout) layout.updatingVisibility.current = previousVisibilityUpdate;
  }, [mobile, active, openRequest, minimized, dockHidden, tabbed, minimizedGroupHidden, layout?.host, suspended, layout?.contained, tutorialPresentation]);

  useLayoutEffect(() => {
    if (!initialSizePending.current || mobile || !isVisible || minimized || placement !== "floating") return;
    const request = requestAnimationFrame(() => {
      const dialog = ref.current;
      const content = dialog?.querySelector<HTMLElement>(".floating-window__content");
      if (!initialSizePending.current || !dialog?.open || !content || content.querySelector('[aria-busy="true"]')) return;
      const bounds = dialog.getBoundingClientRect();
      const viewport = windowViewport(dialog);
      if (!bounds.width || !bounds.height || viewport.width <= 16 || viewport.height <= 16) return;
      const previousWidth = dialog.style.width;
      let size: WindowSize;
      dialog.classList.add("floating-window--measuring");
      try {
        const maxWidth = viewport.width - 16;
        dialog.style.width = `${Math.min(bounds.width, maxWidth)}px`;
        const chromeWidth = dialog.offsetWidth - content.clientWidth;
        const width = Math.min(maxWidth, Math.max(bounds.width, content.scrollWidth + chromeWidth));
        dialog.style.width = `${Math.ceil(width)}px`;
        const height = Math.max(allGroup.length > 1 ? bounds.height : 0, dialog.getBoundingClientRect().height);
        size = { width: Math.ceil(width), height: Math.min(viewport.height - 16, Math.ceil(height)) };
      } finally {
        dialog.style.width = previousWidth;
        dialog.classList.remove("floating-window--measuring");
      }
      initialSizePending.current = false;
      resize.setSize(size);
    });
    return () => cancelAnimationFrame(request);
  }, [mobile, isVisible, minimized, placement, resize.size, resize.setSize, movement.position, children, layout?.host, allGroup.length]);

  function place(next: Placement) {
    initialSizePending.current = false;
    if (next === "fullscreen" && placement !== "fullscreen") maximizedFrame.current = getFrame();
    if (next !== "left" && next !== "right") layout?.detach(titleId);
    setPlacement(next);
    setMinimized(false);
    movement.setPosition("initial");
  }
  function minimize() {
    if (onMinimize) onMinimize();
    else setMinimized(true);
  }
  const windowActions = [
    ...(allGroup.length > 1 ? [
      { label: `Ungroup ${title}`, onSelect: () => place("floating") },
      { label: "Rename group", onSelect: () => setGroupEditor("rename") },
      ...(["left", "right"] as const).flatMap((direction) => {
        const index = allGroup.findIndex((entry) => entry.id === titleId);
        const next = index + (direction === "left" ? -1 : 1);
        if (next < 0 || next >= allGroup.length) return [];
        return [{ label: `Move tab ${direction}`, onSelect: () => {
          const ids = allGroup.map((entry) => entry.id);
          [ids[index], ids[next]] = [ids[next], ids[index]];
          layout?.reorder(ids);
        } }];
      }),
    ] : []),
    ...(destinations.length ? [{ label: "Move to group", onSelect: () => {
      setMinimized(false);
      setTargetGroup(destinations[0].id); setGroupError(""); setGroupEditor("move");
    } }] : []),
    ...menuActions,
    ...(allGroup.length > 1 ? [{ label: "Minimize group", onSelect: () => allGroup.forEach((entry) => entry.minimize()) }] : []),
    { label: "Rename window", onSelect: () => { setNameDraft(title); setNameError(""); setRenaming(true); } },
  ];
  actionsRef.current = windowActions;
  const groupPlayback = allGroup.find((entry) => entry.playback?.isPlaying)?.playback
    ?? playback ?? allGroup.find((entry) => entry.playback)?.playback;
  const point = movement.position && typeof movement.position === "object" ? movement.position : null;
  const minimizedIds = layout?.windows.filter((entry) => isOpenWindow(entry) && entry.minimized).map((entry) => entry.id) ?? [];
  const stackIndex = Math.max(0, minimizedIds.indexOf(titleId));
  const stackRows = Math.max(1, Math.floor((viewport.height - 32) / 60));
  const stackColumns = Math.max(1, Math.ceil(Math.max(1, minimizedIds.length) / stackRows));
  const stackWidth = Math.min(360, (viewport.width - 32) / stackColumns - 8);
  const floatingWidth = resize.size ? Math.min(resize.size.width, viewport.width - 16) : undefined;
  const floatingHeight = resize.size ? Math.min(resize.size.height, viewport.height - 16) : undefined;
  const dockWidth = dock && layout ? layout.dockWidths[`${groupScope}:${dock}`] : resize.dockWidth;
  const dockGroups = dock && layout ? [...new Set(layout.windows
    .filter((entry) => isOpenWindow(entry) && entry.groupScope === groupScope && entry.placement === dock && !entry.minimized)
    .sort((a, b) => (a.dockOrder ?? 0) - (b.dockOrder ?? 0))
    .map((entry) => layout.groups[entry.id] ?? entry.id))] : [];
  const dockIndex = Math.max(0, dockGroups.indexOf(groupId ?? titleId));
  const dockHeight = (viewport.height - 16 - Math.max(0, dockGroups.length - 1) * 8) / Math.max(1, dockGroups.length);
  const cascadeOffset = offset;
  const style: CSSProperties = {
    zIndex: minimized && !mobile ? (layout?.windows.length ?? order + 1) * 2 + stackIndex + 1 : order * 2 + 1,
    ...(placement === "floating" && !mobile ? {
      left: point ? Math.max(0, Math.min(point.x, viewport.width - (floatingWidth ?? 0))) : `min(calc(100vw - ${floatingWidth ? `${floatingWidth}px` : "min(42rem, 100vw - 2rem)"} - 1rem), calc(12vw + ${cascadeOffset}px))`,
      top: point ? Math.max(0, Math.min(point.y, viewport.height - (floatingHeight ?? 0))) : `min(calc(100dvh - ${floatingHeight ? `${floatingHeight}px` : "min(38rem, 100dvh - 2rem)"} - 1rem), calc(12vh + ${cascadeOffset}px))`,
      ...(resize.size ? { width: floatingWidth, height: floatingHeight } : {}),
    } : {}),
    ...(dock && dockWidth && !mobile ? { width: Math.min(dockWidth, viewport.width - 16) } : {}),
    ...(dock && !mobile && !minimized ? { top: 8 + dockIndex * (dockHeight + 8), height: dockHeight } : {}),
    ...(minimized && !mobile ? {
      left: "auto", top: "auto", right: 16 + Math.floor(stackIndex / stackRows) * (stackWidth + 8),
      bottom: 16 + (stackIndex % stackRows) * 60, width: stackWidth, height: 52,
    } : {}),
    ...(layout?.contained && !mobile && placement === "floating" && !minimized ? {
      width: floatingWidth ?? Math.max(0, Math.min(640, viewport.width - 16)),
      height: floatingHeight ?? Math.max(0, Math.min(480, viewport.height - 16)),
      left: Math.max(0, Math.min(point?.x ?? 8 + cascadeOffset, viewport.width - (floatingWidth ?? Math.min(640, viewport.width - 16)))),
      top: Math.max(0, Math.min(point?.y ?? 8 + cascadeOffset, viewport.height - (floatingHeight ?? Math.min(480, viewport.height - 16)))),
    } : {}),
  };
  const content = <>
    <dialog ref={ref} data-window-kind={allGroup.length > 1 ? allGroup.every((entry) => entry.kind === "vocal") ? "vocal" : allGroup.every((entry) => entry.kind === "sample") ? "sample" : allGroup.every((entry) => entry.kind === "dub") ? "dub" : "other" : kind === "vocal" || kind === "sample" || kind === "dub" ? kind : "other"}
      data-workspace-context={kind === "workspace" && titleId.startsWith("workspace:") ? titleId.slice(10) : undefined}
      data-tutorial-subject={windowId}
      data-window-drop-target={!mobile && minimized && !minimizedGroupHidden ? titleId : undefined}
      aria-labelledby={titleId} aria-modal={mobile && active && !minimized && !layout?.contained ? true : undefined}
      className={`floating-window floating-window--${placement}${active ? " floating-window--active" : ""}${minimized && !mobile ? " floating-window--minimized" : ""}${resize.resizing ? " floating-window--resizing" : ""}${addition ? ` window-addition${new Set(allGroup.map((entry) => entry.kind)).size > 1 ? " window-addition--mixed" : ""} window-addition--${addedEntry.kind ?? "default"}` : ""} ${className}`}
      style={style} onPointerDownCapture={(event) => {
        if ((event.target as Element).closest("dialog") !== ref.current) return;
        layout?.focus(); if (!active) onActivate();
      }}
      onFocusCapture={(event) => {
        if ((event.target as Element).closest("dialog") !== ref.current) return;
        if (!changingVisibility.current && !layout?.updatingVisibility.current) { layout?.focus(); if (!active) onActivate(); }
      }}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!closeDisabled) onClose(); }}
      onKeyDown={(event) => {
        if (!mobile && active && event.key === "Escape" && !event.defaultPrevented && (event.target as HTMLElement).closest("dialog") === ref.current) {
          event.preventDefault(); event.stopPropagation(); if (!closeDisabled) onClose();
        }
      }}>
      <header className="floating-window__header vault-rack"
        onPointerDown={(event) => {
          headerDragged.current = false;
          if (mobile || minimized || placement === "fullscreen") return;
          const control = (event.target as HTMLElement).closest("button, select, input, textarea, a, label, [role='tab'], [contenteditable='true']");
          if (control && !control.classList.contains("floating-window__drag")) return;
          event.preventDefault();
          dragStartFrame.current = getFrame();
          initialSizePending.current = false;
          layout?.beginDrag();
          movement.onPointerDown(event);
        }}
        onPointerMove={(event) => {
          if (movement.onPointerMove(event)) { headerDragged.current = true; if (placement !== "floating") setPlacement("floating"); }
        }}
        onPointerUp={(event) => { movement.onPointerUp(event); dragStartFrame.current = null; layout?.endDrag(); }}
        onPointerCancel={(event) => {
          movement.onPointerCancel(event);
          if (dragStartFrame.current) { setFrame(dragStartFrame.current); layout?.syncFrame(titleId, dragStartFrame.current); }
          dragStartFrame.current = null; layout?.endDrag();
        }}
        onLostPointerCapture={(event) => {
          movement.onLostPointerCapture(event);
          if (dragStartFrame.current) { setFrame(dragStartFrame.current); layout?.syncFrame(titleId, dragStartFrame.current); }
          dragStartFrame.current = null; layout?.endDrag();
        }}
        onClick={(event) => {
          if (headerDragged.current) { headerDragged.current = false; return; }
          if (minimized && !mobile && !(event.target as HTMLElement).closest("button")) setMinimized(false);
        }}
        onDoubleClick={!mobile && !minimized ? (event) => {
          if ((event.target as HTMLElement).closest("button, select, label, [role='tab']")) return;
          minimize();
        } : undefined}>
        <h2 id={titleId} title={title}>{renaming ? <form onSubmit={(event) => {
          event.preventDefault();
          const next = nameDraft.trim();
          if (!next) { setNameError("Enter a window name."); return; }
          setCustomTitle(next); setRenaming(false);
        }}>
          <input className="floating-window__rename" aria-label="Window name" maxLength={100} autoFocus
            value={nameDraft} onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => { setNameDraft(event.target.value); setNameError(""); }}
            onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") setRenaming(false); }} />
          {nameError && <span role="alert">{nameError}</span>}
        </form> : minimized && !mobile ? <button type="button" className="floating-window__restore" title={`Restore ${title}`}
          onClick={() => setMinimized(false)}>{title}</button> : title}</h2>
        {(!minimized || mobile) && <span className="floating-window__state" aria-hidden="true">{active ? "Active" : "Inactive"}</span>}
        {groupPlayback?.isPlaying && <span className="floating-window__audible" role="status" aria-label={`Playing audio in ${title} or its tabs`}><Badge dot variant="audio" aria-label="Now playing" /></span>}
        {groupPlayback && <Button variant="tertiary" size="small"
          aria-label={`${groupPlayback.isPlaying ? "Pause" : "Play"} audio in ${title}`}
          leadingIcon={groupPlayback.isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          onClick={groupPlayback.onToggle} />}
        {!mobile && !minimized && <Button variant="tertiary" size="small" className="floating-window__drag"
          aria-label={`Move ${title}; drag or use arrow keys, Home resets position`}
          title="Drag to move; arrow keys move; Home resets"
          disabled={placement === "fullscreen"}
          onKeyDown={(event) => { movement.onKeyDown(event); if (["Home", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { initialSizePending.current = false; setPlacement("floating"); } }}>
          <WindowMoveIcon />
        </Button>}
        {!mobile && !minimized && <label className="floating-window__position">
          <span className="sr-only">Position {title}</span>
          <select aria-label={`Position ${title}`} value={placement} onChange={(event) => place(event.currentTarget.value as Placement)}>
            <option value="floating">Floating</option><option value="left">Dock left</option><option value="right">Dock right</option><option value="fullscreen">Full screen</option>
          </select>
        </label>}
        {windowActions.length > 0 && <WindowControlsMenu title={title} actions={windowActions} />}
        {!minimized && <Button variant="tertiary" size="small" aria-label={`Minimize ${title}`}
          title={onMinimize ? "Minimize to footer" : mobile ? "Minimize; restore from the bar below" : "Minimize to the window stack"}
          leadingIcon={<WindowMinimize aria-hidden="true" />}
          onClick={minimize} />}
        {!mobile && !minimized && <Button variant="tertiary" size="small"
          aria-label={`${placement === "fullscreen" ? "Restore size of" : "Maximize"} ${title}`}
          title={placement === "fullscreen" ? "Restore previous window size" : "Maximize window"}
          leadingIcon={placement === "fullscreen" ? <WindowRestore aria-hidden="true" /> : <WindowMaximize aria-hidden="true" />}
          onClick={() => {
            if (placement === "fullscreen") {
              layout?.detach(titleId);
              setFrame(maximizedFrame.current ?? { placement: "floating", position: "initial", size: resize.size });
            } else {
              place("fullscreen");
            }
          }} />}
        {minimized && !mobile && <Button variant="tertiary" size="small" aria-label={`Restore ${title}`}
          title="Restore window"
          leadingIcon={<WindowRestore aria-hidden="true" />}
          onClick={() => setMinimized(false)} />}
        <Button className="floating-window__close" disabled={closeDisabled} variant="tertiary" size="small" aria-label={`Close ${title}`}
          title="Close window"
          leadingIcon={<X aria-hidden="true" />} onClick={onClose} />
      </header>
      {addition && <div key={addition.expiresAt} className="window-addition-label" role={mobile ? "status" : undefined}>{addition.label}</div>}
      {!minimized && allGroup.length > 1 && <div className="floating-window__group-label">
        <strong title={layout?.groupTitle(titleId)}>{layout?.groupTitle(titleId)}</strong>
        <span>{allGroup.length} tabs{allGroup.some((entry) => entry.minimized) ? ` · ${allGroup.filter((entry) => entry.minimized).length} minimized` : ""}</span>
      </div>}
      {!minimized && groupEditor === "rename" && layout && <GroupNameForm title={layout.groupTitle(titleId)}
        onSave={(name) => { layout.renameGroup(titleId, name); setGroupEditor(null); }} onCancel={() => setGroupEditor(null)} />}
      {!minimized && groupEditor === "move" && <form className="window-group-form" aria-label="Move to group" onSubmit={(event) => {
        event.preventDefault();
        if (!destinations.some((entry) => entry.id === targetGroup)) { setGroupError("Choose an available group."); return; }
        layout?.move(titleId, targetGroup);
        setGroupEditor(null);
      }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setGroupEditor(null); } }}>
        <label>Destination group<select autoFocus value={targetGroup} onChange={(event) => { setTargetGroup(event.currentTarget.value); setGroupError(""); }}>
          {destinations.map((entry) => <option key={entry.id} value={entry.id}>
            {layout?.groupTitle(entry.id)}{entry.minimized ? " (minimized)" : ""}
          </option>)}
        </select></label>
        {groupError && <span role="alert">{groupError}</span>}
        <div><Button type="submit" variant="primary" size="small">Move tab</Button>
          <Button variant="tertiary" size="small" onClick={() => setGroupEditor(null)}>Cancel</Button></div>
      </form>}
      {tabbed && !dockHidden && <CollectionTabs className="floating-window__tabs"
        label={dock ? `${dock === "left" ? "Left" : "Right"} docked packs` : "Grouped packs"}
        tabs={group.map((entry) => ({ id: `${titleId}-tab-${entry.id}`, label: entry.title, panelId: `${entry.id}-panel`, kind: entry.kind, isPlaying: entry.playback?.isPlaying }))}
        selectedId={`${titleId}-tab-${titleId}`}
        onSelect={(id) => group.find((entry) => `${titleId}-tab-${entry.id}` === id)?.activate()}
        onReorder={(ids) => {
          const visibleIds = ids.map((id) => group.find((entry) => `${titleId}-tab-${entry.id}` === id)?.id).filter((id): id is string => Boolean(id));
          let index = 0;
          layout?.reorder(allGroup.map((entry) => group.some((member) => member.id === entry.id) ? visibleIds[index++] : entry.id));
        }}
        getDropTarget={(point) => {
          const target = minimizedDrop(point.x, point.y);
          if (!target) return null;
          const bounds = target.element.getBoundingClientRect();
          return { label: `Release to add to group: ${layout?.groupTitle(target.entry.id)}`, bounds };
        }}
        onTearOut={(id, dropPoint) => {
          const entry = group.find((member) => `${titleId}-tab-${member.id}` === id);
          if (!entry || !layout) return;
          const target = minimizedDrop(dropPoint.x, dropPoint.y);
          if (target) { layout.move(entry.id, target.entry.id); return; }
          const frame = entry.getFrame();
          const bounds = ref.current ? windowViewport(ref.current) : { left: 0, top: 0 };
          layout.detach(entry.id);
          entry.setFrame({ placement: "floating", size: frame.size, position: {
            x: Math.max(8, Math.min(dropPoint.x - bounds.left - 64, viewport.width - 240)),
            y: Math.max(8, Math.min(dropPoint.y - bounds.top - 16, viewport.height - 160)),
          } });
          entry.activate();
        }} />}
      {mobile && !minimized && (layout?.windows.filter((entry) => isOpenWindow(entry) && entry.groupScope === groupScope).length ?? 0) > 1
        && <CollectionTabs className="floating-window__tabs floating-window__tabs--switcher" label="Open windows"
          tabs={(layout?.windows ?? []).filter((entry) => isOpenWindow(entry) && entry.groupScope === groupScope)
            .map((entry) => ({ id: `${titleId}-switch-${entry.id}`, label: entry.title, panelId: `${entry.id}-panel`, kind: entry.kind, isPlaying: entry.playback?.isPlaying }))}
          selectedId={`${titleId}-switch-${titleId}`}
          onSelect={(id) => layout?.windows.find((entry) => `${titleId}-switch-${entry.id}` === id)?.restore()} />}
      {mobile && active && !minimized && layout?.undoControl}
      <div id={`${titleId}-panel`} className="floating-window__content" hidden={minimized && !mobile}
        role={tabbed ? "tabpanel" : undefined} aria-labelledby={tabbed ? `${selected?.id}-tab-${titleId}` : undefined}>
        {active && kind !== "player" && layout?.tracklistControl && layout.tracklistControl.tracklists.length > 1
          && <WindowTracklistSelector {...layout.tracklistControl} />}
        {children}</div>
      {!mobile && !minimized && placement !== "fullscreen" && <button type="button" className={`floating-window__resize${placement === "right" ? " floating-window__resize--left" : ""}`}
        aria-label={`Resize ${title}; drag or use arrow keys, Home resets size`}
        title={placement === "floating" ? "Drag to resize; arrow keys resize; Shift for larger steps; Home resets size" : "Drag or use Left/Right to resize dock width; Home resets"}
        onPointerDown={(event) => { if (event.button === 0 && event.isPrimary) initialSizePending.current = false; resize.onPointerDown(event); }}
        onPointerMove={resize.onPointerMove} onPointerUp={resize.onPointerUp}
        onPointerCancel={resize.onPointerCancel} onLostPointerCapture={resize.onLostPointerCapture}
        onKeyDown={(event) => { if (["Home", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) initialSizePending.current = false; resize.onKeyDown(event); }}>
        <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 13 13 3M8 13l5-5M13 13h.01" /></svg>
      </button>}
    </dialog>
    {movement.previews.map((target) => <SnapPreview key={target.kind} active={target.active}
      label={target.kind.startsWith("minimized:") ? `Release to add to group: ${layout?.groupTitle(target.kind.slice(10))}`
        : target.kind.startsWith("workspace:") ? `Release to move into workspace: ${Object.values(routing?.layers ?? {}).flatMap((layer) => layer.windows).find((entry) => entry.id === target.kind)?.title ?? target.kind.slice(10)}`
        : target.kind.startsWith("group:") ? `Release to group with ${layout?.windows.find((entry) => `group:${entry.id}` === target.kind)?.title}`
        : `${target.active ? "Release" : "Drag"} to dock ${target.kind}`} style={{ ...target.style, zIndex: order * 2 + 2 }} />)}
  </>;
  if (layout?.portalWindows && !layout.host) return null;
  return layout?.host ? createPortal(content, layout.host) : content;
}
