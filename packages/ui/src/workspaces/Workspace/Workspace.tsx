import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Folder, WindowMinimize, WindowMinimizeAll, WindowRestore } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { Badge } from "../../atoms/Badge/Badge";
import { WindowGroupControl, WindowLayer, WindowVisibility, type ActiveWindowGroup } from "../../organisms/Window/Window";
import { WorkspaceRoutingContext, type WindowLayerContext, type WorkspaceAddition } from "../../organisms/Window/WorkspaceContext";
import { type SavedWorkspace, type WindowWorkspace } from "../../organisms/Window/workspace";
import { useMobileLayout } from "../../utils/useMobileLayout";
import { BrowseChromeContext } from "../../foundations/BrowseChromeContext";
import { useTutorialNavigation } from "../../foundations/TutorialNavigationContext";
import { useReportTutorialActivity } from "../../foundations/TutorialActivityContext";
import "../../foundations/WorkspacePalette.css";
import "./Workspace.css";

const emptyLayout = (): WindowWorkspace => ({ version: 1, windows: [], dockWidths: {}, playerTrackId: null });
const flatLayout = (layout: WindowWorkspace): WindowWorkspace => ({
  version: layout.version, windows: layout.windows.filter((entry) => entry.id !== "player" && !entry.id.startsWith("workspace:")),
  dockWidths: layout.dockWidths, playerTrackId: layout.playerTrackId,
  ...(layout.openedDependencies ? { openedDependencies: layout.openedDependencies.filter((id) => id !== "player" && !id.startsWith("workspace:")) } : {}),
});
const previousSelection = (layout: WindowWorkspace) => layout.openedDependencies
  ?? layout.windows.filter((entry) => !entry.minimized && !entry.id.startsWith("workspace:")).map((entry) => entry.id);
const draftSelection = (layout: WindowWorkspace) => layout.openedDependencies
  ?? layout.windows.filter((entry) => !entry.id.startsWith("workspace:")).map((entry) => entry.id);
const restoredWorkspaceId = (layout?: WindowWorkspace | null) => layout?.mode === "simple" ? ""
  : layout?.workspaces?.find((record) => record.id === layout.viewedWorkspaceId)?.id ?? "";
const restoredRecords = (layout?: WindowWorkspace | null) => (layout?.workspaces ?? []).map((record) => ({
  ...record, layout: flatLayout(record.layout), savedLayout: flatLayout(record.savedLayout ?? record.layout),
}));
const restoredOwners = (layout?: WindowWorkspace | null): Record<string, string> => Object.fromEntries([
  ...flatLayout(layout ?? emptyLayout()).windows.map((entry) => [entry.id, ""]),
  ...(layout?.workspaces ?? []).flatMap((record) => flatLayout(record.layout).windows.map((entry) => [entry.id, record.id])),
]);
const layoutSignature = (layout: WindowWorkspace) => {
  const frame = (value: WindowWorkspace["windows"][number]["restoreFrame"]) => value && ({
    placement: value.placement, position: typeof value.position === "object" && value.position
      ? { x: value.position.x, y: value.position.y } : value.position,
    size: value.size && { width: value.size.width, height: value.size.height },
  });
  return JSON.stringify({
    windows: [...layout.windows].sort((a, b) => a.id.localeCompare(b.id)).map((entry) => ({
      id: entry.id, title: entry.title, frame: frame(entry.frame), restoreFrame: frame(entry.restoreFrame),
      minimized: entry.minimized, group: entry.group,
      tabs: entry.group ? layout.windows.filter((window) => window.group === entry.group)
        .sort((a, b) => (a.tabOrder ?? a.order) - (b.tabOrder ?? b.order)).map((window) => window.id) : null,
      groupTitle: entry.group ? entry.groupTitle ?? null : null,
    })),
    dockOrder: [...layout.windows].sort((a, b) => a.dockOrder - b.dockOrder || a.id.localeCompare(b.id)).map((entry) => entry.id),
    dockWidths: Object.entries(layout.dockWidths).sort(([a], [b]) => a.localeCompare(b)),
  });
};

export interface WorkspaceDependency { id: string; title: string; onOpen: () => void }
type Props = ComponentProps<typeof WindowLayer> & {
  activityWindows?: ReactNode;
  dependencies?: WorkspaceDependency[];
  activeWindowId?: string;
  onSuspendPlayback?: () => void;
  sidebarContent?: ReactNode;
  sidebarCollapsed?: boolean;
  restoreOnEntry?: boolean;
  restorationReady?: boolean;
};
type WorkspaceSnapshot = {
  root: WindowWorkspace; records: SavedWorkspace[]; owners: Record<string, string>; opened: Record<string, string[]>;
};
function savedSnapshot(owner: string, snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  if (!owner) return snapshot;
  const saved = snapshot.records.find((record) => record.id === owner)?.savedLayout;
  if (!saved) return snapshot;
  const ids = new Set(saved.windows.map((entry) => entry.id));
  const withoutSaved = (layout: WindowWorkspace) => ({ ...layout, windows: layout.windows.filter((entry) => !ids.has(entry.id)) });
  return {
    root: withoutSaved(snapshot.root),
    records: snapshot.records.map((record) => ({ ...record, layout: record.id === owner ? saved : withoutSaved(record.layout) })),
    owners: { ...Object.fromEntries(Object.entries(snapshot.owners).filter(([, id]) => id !== owner)),
      ...Object.fromEntries([...ids].map((id) => [id, owner])) },
    opened: { ...snapshot.opened, [owner]: previousSelection(saved) },
  };
}

export function Workspace({ children, initialWorkspace, onWorkspaceChange, dependencies = [], activeWindowId, activityWindows, onSuspendPlayback, sidebarContent, sidebarCollapsed = false, restoreOnEntry = false, restorationReady = true, ...props }: Props) {
  const reportActivity = useReportTutorialActivity();
  const mobile = useMobileLayout();
  const [mode, setMode] = useState<"simple" | "explorer">(initialWorkspace?.mode ?? (initialWorkspace?.workspaces?.length ? "explorer" : "simple"));
  const [introduced, setIntroduced] = useState(initialWorkspace?.explorerIntroduced ?? Boolean(initialWorkspace?.workspaces?.length));
  const [records, setRecords] = useState<SavedWorkspace[]>(() => restoredRecords(initialWorkspace));
  const [root, setRoot] = useState(() => flatLayout(initialWorkspace ?? emptyLayout()));
  const [owners, setOwners] = useState<Record<string, string>>(() => restoredOwners(initialWorkspace));
  const current = useRef(restoredWorkspaceId(initialWorkspace));
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [layers, setLayers] = useState<Record<string, WindowLayerContext>>({});
  const [workspaceId, setWorkspaceId] = useState(() => restoredWorkspaceId(initialWorkspace));
  const [running, setRunning] = useState<string | null>(mode === "simple" ? "" : null);
  const [view, setView] = useState<"workspaces" | "dependencies">("dependencies");
  const [browserOpen, setBrowserOpen] = useState(!mobile || restoreOnEntry);
  const [opened, setOpened] = useState<Record<string, string[]>>(() => Object.fromEntries([
    ["", mode === "simple" ? draftSelection(initialWorkspace ?? emptyLayout()) : previousSelection(initialWorkspace ?? emptyLayout())],
    ...(initialWorkspace?.workspaces ?? []).map((record) => [record.id, previousSelection(record.layout)]),
  ]));
  const [managerOpen, setManagerOpen] = useState(!mobile);
  const [browseCompact, setBrowseCompact] = useState(false);
  const [windowsHidden, setWindowsHidden] = useState(false);
  const hideWindows = useCallback(() => setWindowsHidden(true), []);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [closePrompt, setClosePrompt] = useState(false);
  const [closing, setClosing] = useState<{ owner: string; discard: boolean; ids: string[] } | null>(null);
  const sessions = useRef(new Map<string, WorkspaceSnapshot>());
  const [choice, setChoice] = useState("");
  const [message, setMessage] = useState("");
  const [entryHandled, setEntryHandled] = useState(!restoreOnEntry);
  const [blankPrompt, setBlankPrompt] = useState(false);
  const [blankName, setBlankName] = useState("");
  const [startingBlank, setStartingBlank] = useState<{ ids: string[]; draft: WindowWorkspace; title: string | null } | null>(null);
  const entryPending = restoreOnEntry && !entryHandled;
  const [tutorialBrowser, setTutorialBrowser] = useState(false);
  const tutorialOpenedBrowser = useRef(false);
  useTutorialNavigation((surface) => {
    if (entryPending) return;
    if (surface === "workspace") {
      if (!browserOpen) tutorialOpenedBrowser.current = true;
      setTutorialBrowser(true);
      if (!saving && !name && !blankPrompt && !closePrompt && !confirmDelete && !deleting && !closing) setView("workspaces");
      setBrowserOpen(true); setManagerOpen(true);
    } else if (tutorialOpenedBrowser.current && !saving && !name && !blankPrompt && !closePrompt && !confirmDelete && !deleting && !closing) {
      setBrowserOpen(false); setTutorialBrowser(false); tutorialOpenedBrowser.current = false;
    }
  });
  const [additions, setAdditions] = useState<Record<string, WorkspaceAddition>>({});
  const live = useRef({ owners, layers, root, records, opened, running, mode, browserOpen });
  live.current = { owners, layers, root, records, opened, running, mode, browserOpen };
  const revealWindows = useCallback((id?: string) => {
    setWindowsHidden(false);
    if (!id) return;
    const owner = live.current.owners[id] ?? "";
    if (owner !== live.current.running) return;
    setOpened((previous) => (previous[owner] ?? []).includes(id) ? previous
      : { ...previous, [owner]: [...previous[owner] ?? [], id] });
  }, []);
  const publish = useRef(onWorkspaceChange);
  publish.current = onWorkspaceChange;
  const hydrated = useRef(Boolean(initialWorkspace));
  const [hydratedSource, setHydratedSource] = useState(initialWorkspace);
  const callbacks = useRef(new Map<string, (layer: WindowLayerContext) => void>());
  const pendingGroups = useRef<{ ids: string[]; owner: string; title: string }[]>([]);
  const pendingOpen = useRef<{ owner: string; ids: string[] } | null>(null);
  const boundWindows = useRef(new Set<string>());
  const managedOpens = useRef(new Map<string, string>());
  const browserRef = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const wasBrowserOpen = useRef(browserOpen);
  useEffect(() => {
    if (wasBrowserOpen.current && !browserOpen) launcher.current?.focus();
    wasBrowserOpen.current = browserOpen;
  }, [browserOpen]);
  const title = (id: string) => records.find((record) => record.id === id)?.title ?? "Draft Workspace";
  const layoutFor = (id: string) => id ? records.find((record) => record.id === id)?.layout ?? emptyLayout() : root;
  const previousWorkspaceId = initialWorkspace?.activeWorkspaceId === undefined
    ? initialWorkspace?.viewedWorkspaceId !== undefined || flatLayout(initialWorkspace ?? emptyLayout()).windows.length
      ? restoredWorkspaceId(initialWorkspace) : initialWorkspace?.workspaces?.find((record) => record.layout.windows.length)?.id ?? ""
    : initialWorkspace.activeWorkspaceId;

  useEffect(() => {
    if (!initialWorkspace || hydrated.current) return;
    hydrated.current = true;
    setHydratedSource(initialWorkspace);
    sessions.current.clear();
    const nextMode = initialWorkspace.mode ?? (initialWorkspace.workspaces?.length ? "explorer" : "simple");
    setMode(nextMode); setIntroduced(initialWorkspace.explorerIntroduced ?? Boolean(initialWorkspace.workspaces?.length));
    setRoot(flatLayout(initialWorkspace));
    setRecords(restoredRecords(initialWorkspace));
    setOwners(restoredOwners(initialWorkspace));
    setOpened(Object.fromEntries([["", nextMode === "simple" ? draftSelection(initialWorkspace) : previousSelection(initialWorkspace)], ...(initialWorkspace.workspaces ?? []).map((record) => [record.id, previousSelection(record.layout)])]));
    const restoredId = restoredWorkspaceId(initialWorkspace);
    setWorkspaceId(restoredId); current.current = restoredId;
    setRunning(nextMode === "simple" ? "" : null);
    setView("dependencies"); setBrowserOpen(true);
  }, [initialWorkspace]);

  useEffect(() => {
    if (entryPending || startingBlank) return;
    const ownedLayout = (layout: WindowWorkspace, owner: string): WindowWorkspace => {
      const windows = layout.windows.filter((entry) => (owners[entry.id] ?? "") === owner);
      return { ...layout, windows, openedDependencies: (opened[owner] ?? previousSelection(layout)).filter((id) => windows.some((entry) => entry.id === id)) };
    };
    publish.current?.({ ...ownedLayout(root, ""), mode, explorerIntroduced: introduced, viewedWorkspaceId: workspaceId, activeWorkspaceId: running,
      workspaces: records.map((record) => ({ ...record, dependencies: [], layout: ownedLayout(record.layout, record.id) })) });
  }, [root, records, owners, mode, introduced, opened, workspaceId, running, entryPending, startingBlank]);

  function bindContext(id: string) {
    if (!callbacks.current.has(id)) callbacks.current.set(id, (layer) => setLayers((previous) => {
      const old = previous[id];
      if (old?.windows === layer.windows && old.host === layer.host && old.groups === layer.groups
        && old.groupTitles === layer.groupTitles && old.tabOrders === layer.tabOrders && old.dockWidths === layer.dockWidths
        && old.previews === layer.previews && old.recentlyMinimized === layer.recentlyMinimized) return previous;
      return { ...previous, [id]: layer };
    }));
    return callbacks.current.get(id)!;
  }
  const updateLayout = useCallback((owner: string, layout: WindowWorkspace) => {
    const merge = (previous: WindowWorkspace): WindowWorkspace => {
      const next = flatLayout(layout);
      next.windows = next.windows.filter((entry) => (live.current.owners[entry.id] ?? "") === owner);
      const missing = previous.windows.filter((entry) => !entry.id.startsWith("workspace:")
        && (live.current.owners[entry.id] ?? "") === owner && !next.windows.some((item) => item.id === entry.id));
      return { ...next, windows: [...next.windows, ...missing] };
    };
    if (!owner) setRoot((previous) => {
      const next = merge(previous); return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
    else setRecords((previous) => previous.map((record) => {
      if (record.id !== owner) return record;
      const next = merge(record.layout);
      return JSON.stringify(next) === JSON.stringify(record.layout) ? record : { ...record, layout: next };
    }));
  }, []);
  const added = useCallback((ids: string[], owner: string) => {
    const label = `Added to ${live.current.records.find((record) => record.id === owner)?.title ?? "Draft Workspace"}`;
    setAdditions((previous) => ({ ...previous, ...Object.fromEntries(ids.map((id) => [id, { label, expiresAt: Date.now() + 4000 }])) }));
  }, []);
  useEffect(() => {
    const expiry = Math.min(...Object.values(additions).map((entry) => entry.expiresAt));
    if (!Number.isFinite(expiry)) return;
    const timer = window.setTimeout(() => setAdditions((previous) => Object.fromEntries(Object.entries(previous).filter(([, entry]) => entry.expiresAt > Date.now()))), Math.max(0, expiry - Date.now()));
    return () => window.clearTimeout(timer);
  }, [additions]);
  const bind = useCallback((id: string, owner: string, requested = false) => {
    if (id.startsWith("workspace:")) return;
    revealWindows();
    const reopening = boundWindows.current.has(id) && !live.current.layers[owner]?.windows.some((entry) => entry.id === id);
    boundWindows.current.add(id);
    const previous = live.current.owners[id];
    setOwners((state) => state[id] === owner ? state : { ...state, [id]: owner });
    const known = [live.current.root, ...live.current.records.map((record) => record.layout)].some((layout) => layout.windows.some((entry) => entry.id === id));
    if (!known || requested || reopening || (previous !== undefined && previous !== owner)) {
      setOpened((state) => ({ ...state, [owner]: [...new Set([...(state[owner] ?? []), id])] }));
      added([id], owner);
      if (live.current.running === null && requested && !managedOpens.current.has(id)) {
        current.current = "";
        setWorkspaceId(""); setRunning(""); setEntryHandled(true); setBrowserOpen(false);
        setView("dependencies"); setManagerOpen(!mobile);
      } else if (live.current.running === null && !live.current.browserOpen) {
        setRunning(owner);
      }
      if (requested) managedOpens.current.delete(id);
    }
  }, [added, revealWindows, mobile]);

  function pauseWorkspace(owner: string | null) {
    if (owner === null) return;
    if (onSuspendPlayback) { onSuspendPlayback(); return; }
    const toggles = new Set(layers[owner]?.windows.filter((entry) => entry.playback?.isPlaying).map((entry) => entry.playback!.onToggle));
    toggles.forEach((toggle) => toggle());
  }
  function browseWorkspace(id: string) {
    setConfirmDelete(null); setDeleting(null); setClosePrompt(false); setClosing(null);
    pauseWorkspace(running);
    revealWindows();
    setRunning(null); current.current = id; setWorkspaceId(id);
    setView("dependencies"); setBrowserOpen(true); setSaving(false); setMessage("");
  }
  function showWorkspaces() { setView("workspaces"); setBrowserOpen(true); setSaving(false); setConfirmDelete(null); setDeleting(null); setClosePrompt(false); setClosing(null); setName(""); setMessage(""); reportActivity({ type: "workspace-opened" }); }
  function changeMode(next: "simple" | "explorer") {
    revealWindows();
    pauseWorkspace(running); setMode(next); setIntroduced(true); setWorkspaceId(""); current.current = "";
    setSaving(false); setMessage("");
    if (next === "simple") { setRunning(""); setView("dependencies"); setBrowserOpen(false); }
    else { setRunning(null); showWorkspaces(); }
  }
  function hidden(id: string) {
    if (entryPending) return true;
    if (id.startsWith("workspace:")) return true;
    const owner = owners[id] ?? "";
    return windowsHidden || running !== owner || (mode === "simple" && owner !== "") || !(opened[owner] ?? []).includes(id);
  }
  const visibleEntries = running === null ? [] : layers[running]?.windows.filter((entry) => (opened[running] ?? []).includes(entry.id)) ?? [];
  function minimizeAll() {
    visibleEntries.filter((entry) => !entry.minimized).forEach((entry) => entry.minimize());
  }
  const minimizeAllControl = <Button size="small" variant="tertiary" aria-label="Minimize all windows" title="Minimize all windows"
    disabled={!visibleEntries.some((entry) => !entry.minimized)} leadingIcon={<WindowMinimizeAll />} onClick={minimizeAll} />;
  const lastGroup = useRef("");
  useEffect(() => {
    const entries = running === null || windowsHidden ? [] : layers[running]?.windows.filter((entry) => (opened[running] ?? []).includes(entry.id) && !entry.minimized) ?? [];
    const active = entries.find((entry) => entry.id === activeWindowId) ?? [...entries].sort((a, b) => b.order - a.order)[0];
    const layer = running === null ? undefined : layers[running];
    const group: ActiveWindowGroup | null = active && layer ? {
      id: layer.groups[active.id] ?? active.id, title: layer.groups[active.id] ? layer.groupTitle(active.id) : active.title, activeWindowId: active.id,
      windows: entries.filter((entry) => entry.id === active.id || (layer.groups[active.id] && layer.groups[active.id] === layer.groups[entry.id]))
        .sort((a, b) => (layer.tabOrders[a.id] ?? a.order) - (layer.tabOrders[b.id] ?? b.order)).map((entry) => ({ id: entry.id, title: entry.title })),
    } : null;
    const serialized = JSON.stringify(group);
    if (lastGroup.current !== serialized) { lastGroup.current = serialized; props.onActiveGroupChange?.(group); }
  }, [layers, running, opened, windowsHidden, activeWindowId, props.onActiveGroupChange]);

  function transfer(id: string, owner: string) {
    const sourceOwner = owners[id] ?? "";
    if (sourceOwner === owner) return true;
    const layer = layers[sourceOwner];
    const group = groupsFor(sourceOwner).find((entry) => entry.members.includes(id));
    const ids = group?.members ?? [id];
    if (groupsFor(owner).reduce((count, entry) => count + entry.members.length, 0) + ids.length > 50) {
      setMessage("A workspace can contain up to 50 windows."); setBrowserOpen(true); return false;
    }
    const saved = layoutFor(sourceOwner).windows.filter((entry) => ids.includes(entry.id));
    setOwners((previous) => ({ ...previous, ...Object.fromEntries(ids.map((entry) => [entry, owner])) }));
    const moveLayout = (layout: WindowWorkspace, target: string): WindowWorkspace => target === sourceOwner
      ? { ...layout, windows: layout.windows.filter((entry) => !ids.includes(entry.id)) }
      : target === owner ? { ...layout, windows: [...layout.windows.filter((entry) => !ids.includes(entry.id)), ...saved] } : layout;
    setRoot((previous) => moveLayout(previous, ""));
    setRecords((previous) => previous.map((record) => ({ ...record, layout: moveLayout(record.layout, record.id) })));
    setOpened((previous) => ({ ...previous, [sourceOwner]: (previous[sourceOwner] ?? []).filter((entry) => !ids.includes(entry)), [owner]: [...new Set([...(previous[owner] ?? []), ...ids])] }));
    if (ids.length > 1) pendingGroups.current.push({ ids, owner, title: group?.title ?? layer!.groupTitle(id) });
    added(ids, owner);
    return true;
  }
  useEffect(() => {
    pendingGroups.current = pendingGroups.current.filter((transfer) => {
      const layer = layers[transfer.owner];
      if (!layer || !transfer.ids.every((id) => layer.windows.some((entry) => entry.id === id))) return true;
      const target = layer.windows.find((entry) => entry.id === transfer.ids[0])!;
      if (layer.groups[target.id] && transfer.ids.every((id) => layer.groups[id] === layer.groups[target.id])) {
        if (layer.groupTitle(target.id) !== transfer.title) { layer.renameGroup(target.id, transfer.title); return true; }
        return false;
      }
      transfer.ids.slice(1).forEach((id) => layer.join(id, target.id, target.getFrame(), { undoable: false, includeSourceGroup: false, preserveHidden: true }));
      layer.reorder(transfer.ids); return true;
    });
  }, [layers]);

  function actions(id: string) {
    return [{ label: "Manage workspace", onSelect: () => browseWorkspace(owners[id] ?? "") },
      ...(mode === "explorer" ? [{ label: "Move to Draft Workspace", onSelect: () => transfer(id, "") },
        ...records.filter((record) => record.id !== owners[id]).map((record) => ({ label: `Move to workspace: ${record.title}`, onSelect: () => transfer(id, record.id) }))] : [])];
  }
  function groupsFor(owner: string) {
    const layer = layers[owner];
    const saved = layoutFor(owner).windows;
    const ids = [...new Set([...saved.map((entry) => entry.id), ...(layer?.windows.map((entry) => entry.id) ?? [])])].filter((id) => !id.startsWith("workspace:") && (owners[id] ?? "") === owner);
    const groupId = (id: string) => layer?.groups[id] ?? saved.find((entry) => entry.id === id)?.group ?? id;
    return [...new Set(ids.map(groupId))].map((id) => {
      const members = ids.filter((entry) => groupId(entry) === id).sort((a, b) => (layer?.tabOrders[a] ?? saved.find((entry) => entry.id === a)?.tabOrder ?? 0) - (layer?.tabOrders[b] ?? saved.find((entry) => entry.id === b)?.tabOrder ?? 0));
      const first = members[0];
      const window = layer?.windows.find((entry) => entry.id === first);
      const name = members.length > 1 ? layer?.groupTitle(first) ?? saved.find((entry) => entry.id === first)?.groupTitle ?? "Window group"
        : window?.title ?? saved.find((entry) => entry.id === first)?.title ?? dependencies.find((entry) => entry.id === first)?.title ?? first;
      const kinds = members.map((entry) => layer?.windows.find((item) => item.id === entry)?.kind);
      const kind = kinds.every((entry) => entry === "vocal") ? "vocal" : kinds.every((entry) => entry === "sample") ? "sample" : kinds.every((entry) => entry === "dub") ? "dub" : "other";
      return { id, members, title: name, kind };
    });
  }
  const groups = groupsFor(workspaceId);
  function openWorkspace(id: string) {
    const ids = groupsFor(id).flatMap((group) => group.members);
    const missing = ids.filter((entry) => !layers[id]?.windows.some((window) => window.id === entry));
    const unavailable = missing.filter((id) => !dependencies.some((entry) => entry.id === id));
    if (unavailable.length) { setMessage("Some workspace windows are unavailable. Reopen their content from the app before opening this workspace."); return; }
    setEntryHandled(true); setBlankPrompt(false);
    if (!sessions.current.has(id)) sessions.current.set(id, savedSnapshot(id, { root, records, owners, opened: { ...opened, [id]: ids } }));
    pendingOpen.current = { owner: id, ids: missing };
    pauseWorkspace(running); revealWindows(); current.current = id; setWorkspaceId(id); setRunning(id);
    setConfirmDelete(null); setDeleting(null); setClosePrompt(false); setClosing(null); setSaving(false); setMessage("");
    setOpened((previous) => ({ ...previous, [id]: ids }));
    missing.forEach((entry) => { managedOpens.current.set(entry, id); bind(entry, id); dependencies.find((dependency) => dependency.id === entry)!.onOpen(); });
    const entries = layers[id]?.windows.filter((entry) => ids.includes(entry.id)) ?? [];
    // Restore in order so the final active tab remains the group's most recent one.
    [...entries].sort((a, b) => a.order - b.order).forEach((entry) => entry.restore());
    setBrowserOpen(false); setManagerOpen(!mobile);
  }
  useEffect(() => {
    const pending = pendingOpen.current;
    if (!pending) return;
    const entries = layers[pending.owner]?.windows.filter((entry) => pending.ids.includes(entry.id)) ?? [];
    if (!entries.length) return;
    pending.ids = pending.ids.filter((id) => !entries.some((entry) => entry.id === id));
    if (!pending.ids.length) pendingOpen.current = null;
    [...entries].sort((a, b) => a.order - b.order).forEach((entry) => entry.restore());
  }, [layers]);
  function startBlank(saveDraft: boolean) {
    const entries = Object.values(layers).flatMap((layer) => layer.windows);
    if (entries.some((entry) => entry.closeDisabled)) {
      setMessage("Wait for busy windows to finish before starting a new Draft."); return;
    }
    if (saveDraft && !blankName.trim()) { setMessage("Enter a workspace name."); return; }
    if (saveDraft && records.length >= 20) { setMessage("A maximum of 20 workspaces can be saved."); return; }
    pauseWorkspace(running);
    setStartingBlank({ ids: entries.map((entry) => entry.id), draft: flatLayout(root), title: saveDraft ? blankName.trim() : null });
    setMessage("");
    entries.forEach((entry) => entry.close());
  }
  useEffect(() => {
    if (!startingBlank || Object.values(layers).some((layer) => layer.windows.some((entry) => startingBlank.ids.includes(entry.id)))) return;
    const savedTitle = startingBlank.title;
    const id = savedTitle ? crypto.randomUUID() : null;
    if (id && savedTitle) setRecords((previous) => [...previous, {
      id, title: savedTitle, saved: true, dependencies: [], layout: startingBlank.draft, savedLayout: startingBlank.draft,
    }]);
    const ids = new Set(startingBlank.draft.windows.map((entry) => entry.id));
    setOwners((previous) => ({
      ...Object.fromEntries(Object.entries(previous).filter(([entry]) => !ids.has(entry))),
      ...(id ? Object.fromEntries([...ids].map((entry) => [entry, id])) : {}),
    }));
    setRoot(emptyLayout()); layers[""]?.restoreWorkspace(emptyLayout());
    setOpened((previous) => ({ ...previous, "": [], ...(id ? { [id]: startingBlank.draft.openedDependencies ?? [] } : {}) }));
    sessions.current.clear(); pendingOpen.current = null; pendingGroups.current = [];
    ids.forEach((entry) => boundWindows.current.delete(entry));
    current.current = ""; setWorkspaceId(""); setRunning(""); setView("dependencies");
    setEntryHandled(true); setBlankPrompt(false); setStartingBlank(null); setBlankName("");
    setBrowserOpen(false); setManagerOpen(!mobile); setMessage("");
  }, [startingBlank, layers, mobile]);
  useEffect(() => {
    if (!entryPending || !restorationReady || !stage || initialWorkspace !== hydratedSource) return;
    if (!root.windows.length && (previousWorkspaceId === null || !layoutFor(previousWorkspaceId).windows.length)) {
      current.current = ""; setWorkspaceId(""); setRunning(""); setEntryHandled(true); setBrowserOpen(false);
    }
  }, [entryPending, restorationReady, stage, initialWorkspace, hydratedSource, root, records, previousWorkspaceId]);
  function saveWorkspace(workspaceName = name, closeAfterSave = false) {
    if (!workspaceName.trim()) { setMessage("Enter a workspace name."); return; }
    const entries = layers[workspaceId]?.windows ?? [];
    if (closeAfterSave && entries.some((entry) => entry.closeDisabled)) {
      setMessage("Wait for busy windows to finish before closing this workspace."); return;
    }
    let savedId = workspaceId;
    const windows = layoutFor(workspaceId).windows.filter((entry) => (owners[entry.id] ?? "") === workspaceId);
    const checkpoint = { ...flatLayout(layoutFor(workspaceId)), windows,
      openedDependencies: (opened[workspaceId] ?? []).filter((id) => windows.some((entry) => entry.id === id)) };
    if (workspaceId) {
      const nextRecords = records.map((record) => record.id === workspaceId
        ? { ...record, title: workspaceName.trim(), saved: true, savedLayout: checkpoint } : record);
      setRecords(nextRecords);
      sessions.current.set(workspaceId, savedSnapshot(workspaceId, { root, records: nextRecords, owners, opened }));
    } else {
      if (records.length >= 20) { setMessage("A maximum of 20 workspaces can be saved."); return; }
      const id = crypto.randomUUID();
      savedId = id;
      const draft = checkpoint;
      const nextRecords = [...records, { id, title: workspaceName.trim(), saved: true, dependencies: [], layout: draft, savedLayout: draft }];
      const nextOwners = { ...owners, ...Object.fromEntries(draft.windows.map((entry) => [entry.id, id])) };
      const nextOpened = { ...opened, [id]: opened[""] ?? [], "": [] };
      setRecords(nextRecords); setOwners(nextOwners); setOpened(nextOpened);
      sessions.current.delete("");
      sessions.current.set(id, { root: emptyLayout(), records: nextRecords, owners: nextOwners, opened: nextOpened });
      setRoot(emptyLayout()); setWorkspaceId(id); current.current = id;
      setRunning((previous) => previous === "" ? id : previous);
      setMode("explorer"); setIntroduced(true);
    }
    setSaving(false); setName(""); setMessage("");
    reportActivity({ type: "workspace-save-requested", subjectId: savedId,
      value: JSON.stringify({ title: workspaceName.trim(), layout: checkpoint }) });
    if (closeAfterSave) {
      pauseWorkspace(running); setClosePrompt(false);
      setClosing({ owner: savedId, discard: false, ids: entries.map((entry) => entry.id) });
      entries.forEach((entry) => entry.close());
    }
  }
  function closeWorkspace(discard = false) {
    if (running === null) return;
    const baseline = sessions.current.get(running);
    const original = running ? baseline?.records.find((record) => record.id === running)?.layout : baseline?.root;
    const originalIds = new Set(original?.windows.map((entry) => entry.id) ?? []);
    const entries = Object.entries(layers).flatMap(([owner, layer]) => layer.windows.filter((entry) => owner === running || originalIds.has(entry.id)));
    if (entries.some((entry) => entry.closeDisabled)) {
      setMessage("Wait for busy windows to finish before closing this workspace."); return;
    }
    pauseWorkspace(running); setClosePrompt(false); setMessage("");
    setClosing({ owner: running, discard, ids: entries.map((entry) => entry.id) });
    entries.forEach((entry) => entry.close());
  }
  useEffect(() => {
    if (initialWorkspace !== hydratedSource) return;
    if (running !== null && !sessions.current.has(running)) sessions.current.set(running, savedSnapshot(running, { root, records, owners, opened }));
  }, [running, root, records, owners, opened, initialWorkspace, hydratedSource]);
  const hasUnsavedChanges = running !== null && (running
    ? layoutSignature(layoutFor(running)) !== layoutSignature(records.find((record) => record.id === running)?.savedLayout ?? emptyLayout())
    : root.windows.length > 0);
  useEffect(() => {
    if (!closing || Object.values(layers).some((layer) => layer.windows.some((entry) => closing.ids.includes(entry.id)))) return;
    const { owner } = closing;
    const baseline = sessions.current.get(owner);
    if (closing.discard && baseline) {
      const before = owner ? baseline.records.find((record) => record.id === owner)?.layout : baseline.root;
      const after = owner ? records.find((record) => record.id === owner)?.layout : root;
      const affected = new Set([...(before?.windows ?? []), ...(after?.windows ?? [])].map((entry) => entry.id));
      const restore = (layout: WindowWorkspace, id: string): WindowWorkspace => {
        const original = id ? baseline.records.find((record) => record.id === id)?.layout : baseline.root;
        const windows = [...layout.windows.filter((entry) => !affected.has(entry.id)),
          ...(original?.windows.filter((entry) => affected.has(entry.id)) ?? [])];
        return { ...(id === owner && original ? original : layout), windows };
      };
      const nextRoot = restore(root, "");
      const nextRecords = records.map((record) => ({ ...record, layout: restore(record.layout, record.id) }));
      setRoot(nextRoot); setRecords(nextRecords);
      setOwners((previous) => ({
        ...Object.fromEntries(Object.entries(previous).filter(([id]) => !affected.has(id))),
        ...Object.fromEntries(Object.entries(baseline.owners).filter(([id]) => affected.has(id))),
      }));
      setOpened((previous) => ({ ...previous, [owner]: baseline.opened[owner] ?? previousSelection(before ?? emptyLayout()) }));
      layers[""]?.restoreWorkspace(nextRoot);
      nextRecords.forEach((record) => layers[record.id]?.restoreWorkspace(record.layout));
    } else {
      layers[owner]?.restoreWorkspace(owner ? records.find((record) => record.id === owner)?.layout ?? emptyLayout() : root);
    }
    sessions.current.delete(owner);
    setRunning(null); current.current = owner; setWorkspaceId(owner);
    setView("dependencies"); setBrowserOpen(true); setClosing(null); setSaving(false); setMessage("");
  }, [closing, layers, root, records, opened]);
  function deleteWorkspace() {
    if (!confirmDelete) return;
    const entries = layers[confirmDelete]?.windows ?? [];
    if (entries.some((entry) => entry.closeDisabled)) {
      setMessage("Wait for busy windows to finish before deleting this workspace."); return;
    }
    pauseWorkspace(confirmDelete);
    setDeleting(confirmDelete); setConfirmDelete(null); setMessage("");
    entries.forEach((entry) => entry.close());
  }
  useEffect(() => {
    if (deleting === null || layers[deleting]?.windows.length) return;
    const ids = new Set(records.find((record) => record.id === deleting)?.layout.windows.map((entry) => entry.id) ?? []);
    setRecords((previous) => previous.filter((record) => record.id !== deleting));
    setOwners((previous) => Object.fromEntries(Object.entries(previous).filter(([, owner]) => owner !== deleting)));
    setOpened((previous) => Object.fromEntries(Object.entries(previous).filter(([owner]) => owner !== deleting)));
    ids.forEach((id) => boundWindows.current.delete(id));
    pendingGroups.current = pendingGroups.current.filter((entry) => entry.owner !== deleting);
    sessions.current.delete(deleting);
    if (pendingOpen.current?.owner === deleting) pendingOpen.current = null;
    if (workspaceId === deleting) { setWorkspaceId(""); current.current = ""; }
    if (running === deleting) setRunning(null);
    if (!browserOpen) { setWorkspaceId(""); current.current = ""; setView("dependencies"); }
    setBrowserOpen(true); setDeleting(null); setSaving(false); setMessage("");
  }, [deleting, layers, records, root, workspaceId, running, browserOpen]);
  function addDependency() {
    const dependency = dependencies.find((entry) => entry.id === choice);
    if (!dependency) { setMessage("Choose a dependency to add."); return; }
    const owner = owners[dependency.id] ?? (root.windows.some((entry) => entry.id === dependency.id) ? "" : undefined);
    if (owner !== undefined && owner !== workspaceId) {
      if (!transfer(dependency.id, workspaceId)) return;
    }
    else {
      if (owner === undefined && groupsFor(workspaceId).reduce((count, entry) => count + entry.members.length, 0) >= 50) {
        setMessage("A workspace can contain up to 50 windows."); return;
      }
      current.current = workspaceId;
      if (!dependency.id.startsWith("action:")) {
        managedOpens.current.set(dependency.id, workspaceId);
        bind(dependency.id, workspaceId);
      }
      dependency.onOpen();
    }
    setChoice(""); setMessage("");
  }
  function openSingleTrack() {
    const dependency = dependencies.find((entry) => entry.id === choice && entry.id.startsWith("track:"));
    if (!dependency) { setMessage("Choose a dub, sample or vocal to open."); return; }
    const owner = owners[dependency.id] ?? "";
    if (owner !== workspaceId && !transfer(dependency.id, workspaceId)) return;
    if (owner === workspaceId && !layoutFor(workspaceId).windows.some((entry) => entry.id === dependency.id)
      && groupsFor(workspaceId).reduce((count, entry) => count + entry.members.length, 0) >= 50) {
      setMessage("A workspace can contain up to 50 windows."); return;
    }
    pauseWorkspace(running !== workspaceId ? running : null);
    current.current = workspaceId; setRunning(workspaceId); revealWindows();
    if (!layers[owner]?.windows.some((entry) => entry.id === dependency.id)) {
      pendingOpen.current = { owner: workspaceId, ids: [dependency.id] };
    }
    managedOpens.current.set(dependency.id, workspaceId);
    bind(dependency.id, workspaceId);
    dependency.onOpen();
    layers[owner]?.windows.find((entry) => entry.id === dependency.id)?.restore();
    setChoice(""); setMessage(""); setBrowserOpen(false); setManagerOpen(!mobile);
  }
  const singleTrackPicker = <details className="workspace-editor-section">
    <summary>Open dub, sample or vocal</summary>
    <form className="workspace-toolbar" aria-label="Open dub, sample or vocal" onSubmit={(event) => { event.preventDefault(); openSingleTrack(); }}>
      <label>Dub, sample or vocal<select value={choice} onChange={(event) => setChoice(event.currentTarget.value)}>
        <option value="">Choose a dub, sample or vocal</option>
        {dependencies.filter((entry) => entry.id.startsWith("track:")).map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
      </select></label>
      <Button size="small" type="submit">Open in workspace</Button>
    </form>
  </details>;
  function requestBlank() {
    setMessage(""); setBlankName(""); setBlankPrompt(root.windows.length > 0); setBrowserOpen(true);
    if (!root.windows.length) startBlank(false);
  }
  const blankControls = startingBlank ? <>
    <p role="status" className="workspace-description">Confirm any unsaved editor changes to finish starting a blank Draft. Saved workspaces will be kept.</p>
    <Button size="small" variant="secondary" onClick={() => {
      const owner = Object.keys(layers).find((id) => layers[id].windows.some((entry) => startingBlank.ids.includes(entry.id)));
      if (owner === undefined) return;
      setEntryHandled(true); current.current = owner; setWorkspaceId(owner); setRunning(owner);
      setOpened((previous) => ({ ...previous, [owner]: layers[owner].windows.map((entry) => entry.id) }));
      revealWindows(); layers[owner].windows.forEach((entry) => entry.restore());
      setBrowserOpen(false); setManagerOpen(true);
    }}>Review unsaved windows</Button>
    <Button size="small" variant="tertiary" onClick={() => { setStartingBlank(null); setBlankPrompt(false); setMessage(""); }}>Cancel starting Draft</Button>
  </> : blankPrompt ? <form className="workspace-toolbar" aria-label="Save changes before starting Draft" onSubmit={(event) => { event.preventDefault(); startBlank(true); }}>
    <p className="workspace-description">Draft has unsaved windows. Save them as a workspace before starting blank? Saved workspaces keep their arrangements; editors may ask you to save their changes separately.</p>
    <label>Workspace name<input autoFocus maxLength={100} value={blankName} onChange={(event) => setBlankName(event.currentTarget.value)} /></label>
    <Button type="submit">Save and start blank</Button>
    <Button variant="secondary" onClick={() => startBlank(false)}>Discard Draft and start blank</Button>
    <Button variant="tertiary" onClick={() => { setBlankPrompt(false); setMessage(""); }}>Cancel</Button>
  </form> : null;
  const deletionControls = deleting !== null ? <>
    <p role="status" className="workspace-description">Close the remaining windows to finish deleting this workspace. Confirm any unsaved changes in their editors.</p>
    <Button size="small" variant="tertiary" onClick={() => setDeleting(null)}>Cancel deletion</Button>
    {browserOpen && <Button size="small" variant="secondary" onClick={() => {
      pauseWorkspace(running); revealWindows(); setRunning(deleting); setWorkspaceId(deleting); current.current = deleting;
      setOpened((previous) => ({ ...previous, [deleting]: layers[deleting]?.windows.map((entry) => entry.id) ?? [] }));
      layers[deleting]?.windows.forEach((entry) => entry.restore());
      setBrowserOpen(false); setManagerOpen(true);
    }}>Show windows</Button>}
  </> : confirmDelete ? <>
    <p className="workspace-description">Delete {title(confirmDelete)} and close all its windows? Unsaved window drafts may be lost. Source packs and tracks will not be deleted.</p>
    <div className="workspace-runtime__actions">
      <Button size="small" variant="secondary" onClick={deleteWorkspace}>Confirm deletion</Button>
      <Button size="small" variant="tertiary" onClick={() => { setConfirmDelete(null); setMessage(""); }}>Cancel</Button>
    </div>
  </> : null;
  const browser = <nav ref={browserRef} aria-label="Workspace Explorer" data-window-system data-workspace-navigator
    className={`workspace-explorer workspace-palette--charcoal${mobile ? " workspace-explorer--maximized" : ""}`}>
    <header className="workspace-explorer__header">
      {!entryPending && view === "dependencies" && <Button size="small" variant="tertiary" aria-label="Back to workspaces" title="Back to workspaces"
        leadingIcon={<ChevronRight style={{ transform: "rotate(180deg)" }} />} onClick={showWorkspaces} />}
      <div className="workspace-explorer__heading">
        <span className="workspace-description">{view === "workspaces" ? "Workspace Explorer" : "Workspace"}</span>
        <h2>{entryPending ? "Continue your workspace" : view === "workspaces" ? "Workspaces" : title(workspaceId)}</h2>
      </div>
      {!entryPending && minimizeAllControl}
      {!entryPending && <Button size="small" variant="tertiary" aria-label="Minimize Workspace Explorer" leadingIcon={<WindowMinimize />} onClick={() => setBrowserOpen(false)} />}
    </header>
    <div className="workspace-explorer__body">
      {message && <p role="alert" className="workspace-explorer__message">{message}</p>}
      {entryPending || blankControls ? <section className="workspace-explorer-intro" aria-label="Workspace startup">
        {!restorationReady ? <p role="status">Loading your saved workspace...</p> : blankControls ?? <>
          <p className="workspace-description">Load your previous workspace, or start with an empty Draft. Playback will not start automatically.</p>
          {previousWorkspaceId !== null && layoutFor(previousWorkspaceId).windows.length > 0 &&
            <Button onClick={() => openWorkspace(previousWorkspaceId)}>Load previous workspace: {title(previousWorkspaceId)}</Button>}
          <Button variant="secondary" onClick={requestBlank}>Start empty Draft</Button>
        </>}
      </section> : <>
      {deletionControls && <section className="workspace-editor-section" aria-label="Delete workspace">{deletionControls}</section>}
      {mode === "simple" && view === "workspaces" ? <section className="workspace-explorer-intro">
        <h3>{introduced ? "Explorer mode" : "Choose how you work"}</h3>
        <p>Choose a workspace to open its windows together in the window manager.</p>
        <Button onClick={() => changeMode("explorer")}>Enable Explorer</Button>
        <Button variant="tertiary" onClick={() => { setView("dependencies"); setBrowserOpen(false); }}>Stay in Simple mode</Button>
      </section> : view === "workspaces" ? <>
        <p className="workspace-description">Choose a workspace to open all its windows.</p>
        <ul className="workspace-explorer__workspaces">
          {[{ id: "", title: "Draft Workspace", saved: false }, ...records].map((record) => <li key={record.id} className={`workspace-library__entry workspace-card workspace-card--other${running === record.id ? " workspace-card--open" : ""}`}>
            <Button variant="tertiary" leadingIcon={<Folder />} aria-label={`Open workspace: ${record.title}`} onClick={() => openWorkspace(record.id)}>
              <span className="workspace-library__copy"><strong>{record.title}</strong>
                <span className="workspace-description">{groupsFor(record.id).length} dependencies</span></span>
              <Badge>{running === record.id ? "Active" : record.id ? "Saved" : "Draft"}</Badge>
              <ChevronRight aria-hidden="true" size={16} />
            </Button>
            <Button className="workspace-library__manage" size="small" variant="tertiary" aria-label={`Manage workspace: ${record.title}`}
              onClick={() => browseWorkspace(record.id)}>Manage</Button>
            {record.id && <Button className="workspace-library__manage" size="small" variant="tertiary" aria-label={`Delete workspace: ${record.title}`}
              disabled={deleting !== null} onClick={() => { setConfirmDelete(record.id); setMessage(""); }}>Delete</Button>}
          </li>)}
        </ul>
        <form className="workspace-toolbar" aria-label="Create workspace" onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) { setMessage("Enter a workspace name."); return; }
          if (records.length >= 20) { setMessage("A maximum of 20 workspaces can be saved."); return; }
          const id = crypto.randomUUID();
          const checkpoint = emptyLayout();
          setRecords((previous) => [...previous, { id, title: name.trim(), saved: true, dependencies: [], layout: checkpoint, savedLayout: checkpoint }]);
          reportActivity({ type: "workspace-save-requested", subjectId: id, value: JSON.stringify({ title: name.trim(), layout: checkpoint }) });
          setName(""); setWorkspaceId(id); current.current = id; setRunning(id); setBrowserOpen(false); setManagerOpen(!mobile);
        }}><label>New workspace name<input value={name} maxLength={100} onChange={(event) => setName(event.currentTarget.value)} /></label><Button type="submit">Create workspace</Button></form>
      </> : <>
        <p className="workspace-description">Manage the windows and groups in this workspace.</p>
        <div className="workspace-explorer__selection">
          <h3>Dependencies ({groups.length})</h3>
        </div>
        <ul className="workspace-explorer__dependencies" aria-label="Workspace dependencies">
          {groups.map((group) => {
            const active = running === workspaceId && group.members.some((id) => (opened[workspaceId] ?? []).includes(id));
            const entries = layers[workspaceId]?.windows.filter((entry) => group.members.includes(entry.id)) ?? [];
            const state = entries.some((entry) => entry.visible) ? entries.some((entry) => entry.visible && entry.placement === "fullscreen") ? "Maximized" : "Visible"
              : entries.length && entries.every((entry) => entry.minimized) ? "Minimized" : "Hidden";
            return <li key={group.id} className={`workspace-dependency-tile workspace-card workspace-card--${group.kind}${active ? " workspace-card--open" : ""}`}>
              <div className="workspace-explorer__dependency">
                <WindowVisibility state={state} /><span className="workspace-explorer__dependency-copy"><strong>{group.title}</strong><span className="workspace-description">{group.members.length > 1 ? `${group.members.length} tabs` : group.kind === "other" ? "Window" : group.kind === "dub" ? "Dub" : group.kind === "vocal" ? "Vocal" : "Sample"}</span></span></div>
              {group.members.length > 1 && <details className="workspace-directory"><summary>Preview tabs</summary><ul>{group.members.map((id) => <li key={id}>{layers[workspaceId]?.windows.find((entry) => entry.id === id)?.title ?? layoutFor(workspaceId).windows.find((entry) => entry.id === id)?.title ?? id}</li>)}</ul></details>}
            </li>;
          })}
        </ul>
        {!groups.length && <section className="workspace-explorer__empty"><h3>Add your first window</h3><p className="workspace-description">Choose content below, or open a window from the app.</p></section>}
        {singleTrackPicker}
        <details className="workspace-editor-section" open={!groups.length || undefined}>
          <summary>Add content</summary>
          <p className="workspace-description">Add a window to this workspace. Content from another workspace moves here with its grouped tabs.</p>
        <form className="workspace-toolbar" aria-label="Add workspace content" onSubmit={(event) => { event.preventDefault(); addDependency(); }}>
          <label>Add dependency<select value={choice} onChange={(event) => setChoice(event.currentTarget.value)}><option value="">Choose content</option>{dependencies.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>
          <Button size="small" variant="secondary" type="submit">Add dependency</Button>
        </form>
        </details>
        {mode === "explorer" && <section className="workspace-editor-section" aria-label="Workspace details">
          {workspaceId && <Button size="small" variant="secondary" disabled={deleting !== null}
            onClick={() => { setConfirmDelete(workspaceId); setMessage(""); }}>Delete Workspace</Button>}
          {!saving ? <Button size="small" variant="tertiary" onClick={() => { setSaving(true); setName(workspaceId ? title(workspaceId) : ""); }}>{workspaceId ? "Rename workspace" : "Save Draft as workspace"}</Button>
          : <form className="workspace-toolbar" aria-label="Save workspace" onSubmit={(event) => { event.preventDefault(); saveWorkspace(); }}><label>Workspace name<input autoFocus value={name} maxLength={100} onChange={(event) => setName(event.currentTarget.value)} /></label><Button type="submit">Save</Button><Button variant="tertiary" onClick={() => { setSaving(false); setMessage(""); }}>Cancel</Button></form>}
          {!workspaceId && <p className="workspace-description">Saving gives this Draft a name and keeps its windows together.</p>}
        </section>}
      </>}
      <details className="workspace-explorer-settings"><summary>Explorer settings</summary>
        <Button size="small" variant="secondary" aria-pressed={mode === "simple"} onClick={() => changeMode(mode === "simple" ? "explorer" : "simple")}>Simple mode {mode === "simple" ? "(on)" : "(off)"}</Button>
        <p className="workspace-description">Simple mode uses Draft Workspace only. Your other workspaces and drafts are preserved.</p>
      </details>
      </>}
    </div>
    {!entryPending && !blankControls && view === "dependencies" && <footer className="workspace-explorer__footer"><Button onClick={() => openWorkspace(workspaceId)}>Open Workspace</Button></footer>}
  </nav>;
  const layer = running === null ? undefined : layers[running];
  const runtimeGroups = [...new Set(visibleEntries.map((entry) => layer?.groups[entry.id] ?? entry.id))].map((id) => {
    const members = visibleEntries.filter((entry) => (layer?.groups[entry.id] ?? entry.id) === id);
    const kind = members.every((entry) => entry.kind === "vocal") ? "vocal" : members.every((entry) => entry.kind === "sample") ? "sample" : members.every((entry) => entry.kind === "dub") ? "dub" : "other";
    return { id, members, kind };
  });
  const runtimeSections = [
    { kind: "dub", label: "Dubs" },
    { kind: "sample", label: "Samples" },
    { kind: "vocal", label: "Vocals" },
    { kind: "other", label: "Mixed & other windows" },
  ].map((section) => ({ ...section, groups: runtimeGroups.filter((group) => group.kind === section.kind) }))
    .filter((section) => section.groups.length > 0);
  const focusedWindow = !windowsHidden ? visibleEntries.find((entry) => entry.id === activeWindowId && entry.visible && !entry.minimized)
    ?? [...visibleEntries].filter((entry) => entry.visible && !entry.minimized).sort((a, b) => b.order - a.order)[0] : undefined;
  const managerExpanded = managerOpen;
  const manager = (running !== null || deleting !== null || closing !== null) && <nav aria-label="Window manager" className="workspace-runtime workspace-palette--charcoal" data-window-system data-workspace-navigator>
    <header><div className="workspace-explorer__heading"><span className="workspace-description">Window manager · {runtimeGroups.length} {runtimeGroups.length === 1 ? "group" : "groups"}</span><h2>{running === null ? "Window manager" : title(running)}</h2></div>{minimizeAllControl}<Button size="small" variant="tertiary" aria-label={managerExpanded ? "Minimize window manager" : "Show window manager"} aria-expanded={managerExpanded} onClick={() => setManagerOpen(!managerExpanded)} leadingIcon={managerExpanded ? <WindowMinimize /> : <WindowRestore />} /></header>
    {windowsHidden && <Button size="small" variant="secondary" onClick={() => revealWindows()}>Show windows</Button>}
    <div className="workspace-runtime__body" hidden={!managerExpanded}><ul aria-label="Open workspace windows" className="workspace-runtime__sections">{runtimeSections.map((section) => <li key={section.kind}>
      <header className="workspace-runtime__section-header"><h3>{section.label}</h3><span className="workspace-description">{section.groups.length} {section.groups.length === 1 ? "group" : "groups"}</span></header>
      <ul aria-label={section.kind === "other" ? section.label : `${section.label} windows`} className="workspace-runtime__list">{section.groups.map(({ id, members, kind }) => {
      return <li key={id} className={`workspace-dependency-tile workspace-card workspace-card--${kind}${members.some((entry) => !entry.minimized) ? " workspace-card--open" : ""}`}>
        <WindowGroupControl compact title={members.length > 1 ? layer!.groupTitle(members[0].id) : members[0].title} entries={members} members={members} showAll contextHidden={windowsHidden} focusedWindowId={focusedWindow?.id} highlighted={false} onRename={(name) => layer!.renameGroup(members[0].id, name)} onRestore={layer!.dismissMinimizeNotice}
          onFocus={(id) => { layers[running!]?.windows.find((entry) => entry.id === id)?.restore(); }} />
      </li>;
      })}</ul>
    </li>)}</ul></div>
    {managerExpanded && <footer className="workspace-runtime__footer">
      {message && <p role="alert" className="workspace-explorer__message">{message}</p>}
      {!startingBlank && !closing && deleting === null && !confirmDelete && singleTrackPicker}
      {startingBlank ? blankControls : closing ? <>
        <p role="status" className="workspace-description">Close the remaining windows to finish closing this workspace. Confirm any unsaved changes in their editors.</p>
        <Button size="small" variant="tertiary" onClick={() => setClosing(null)}>Cancel closing</Button>
      </> : deletionControls ? deletionControls : saving ? <form className="workspace-toolbar" aria-label="Save workspace" onSubmit={(event) => { event.preventDefault(); saveWorkspace(name, closePrompt); }}>
        <label>Workspace name<input autoFocus value={name} maxLength={100} onChange={(event) => setName(event.currentTarget.value)} /></label>
        <Button size="small" type="submit">Save</Button>
        <Button size="small" variant="tertiary" onClick={() => { setSaving(false); setClosePrompt(false); setMessage(""); }}>Cancel</Button>
      </form> : closePrompt ? <>
        <p className="workspace-description">Save changes before closing? Discard restores the last saved workspace layout.</p>
        <div className="workspace-runtime__actions">
          <Button size="small" onClick={() => {
            if (running) saveWorkspace(title(running), true);
            else { setName(""); setSaving(true); }
          }}>Save</Button>
          <Button size="small" variant="secondary" onClick={() => closeWorkspace(true)}>Discard</Button>
          <Button size="small" variant="tertiary" onClick={() => { setClosePrompt(false); setMessage(""); }}>Cancel</Button>
        </div>
      </> : <><p className="workspace-description" role="status">{hasUnsavedChanges ? "Unsaved workspace changes" : "All workspace changes saved"}</p><div className="workspace-runtime__actions">
        <Button size="small" onClick={() => {
          setMessage("");
          if (running) saveWorkspace(title(running));
          else { setName(""); setSaving(true); }
        }}>Save Workspace</Button>
        <Button size="small" variant="secondary" onClick={() => {
          setMessage(""); if (hasUnsavedChanges) setClosePrompt(true); else closeWorkspace();
        }}>Close Workspace</Button>
        <Button size="small" variant="tertiary" onClick={requestBlank}>Start empty Draft</Button>
        <Button size="small" variant="secondary" disabled={!running} title={!running ? "Save Draft as a workspace before deleting it" : undefined}
          onClick={() => { setConfirmDelete(running); setMessage(""); }}>Delete Workspace</Button>
      </div></>}
    </footer>}
  </nav>;
  const narrowSidebar = sidebarCollapsed && !browserOpen;
  const workspaceControls = <>
    {!browserOpen && (!narrowSidebar || mobile) && manager}
    {!browserOpen && <>
      <Button ref={launcher} size="small" variant="secondary" aria-label="Workspaces" title="Workspaces" leadingIcon={<Folder />}
        onClick={showWorkspaces}>{narrowSidebar && !mobile ? undefined : "Workspaces"}</Button>
      {mode === "simple" && (!narrowSidebar || mobile) && <Button size="small" variant="tertiary" onClick={showWorkspaces}>Explorer</Button>}
    </>}
  </>;
  const hasSidebar = !mobile;
  return <BrowseChromeContext.Provider value={{ compact: browseCompact, setCompact: setBrowseCompact }}><WorkspaceRoutingContext.Provider value={{ current, openOwner: (id) => managedOpens.current.get(id) ?? live.current.running ?? "", owners, layers, bind, active: () => false, hidden, hideWindows, revealWindows, actions, additions, added,
    workspaceDropTarget: () => null, moveIntoWorkspace: transfer, featureWindows: props.featureWindows, tracklistControl: props.tracklistControl }}>
    <div className={`workspace-root${hasSidebar ? " workspace-root--sidebar" : ""}${hasSidebar && narrowSidebar ? " workspace-root--sidebar-collapsed" : ""}`}><div className="workspace-stage" ref={setStage}>
      {stage && <>
        <WindowLayer {...props} initialWorkspace={flatLayout(initialWorkspace ?? emptyLayout())} onContext={bindContext("")} childrenInPage container={stage}
          onWorkspaceChange={(layout) => updateLayout("", layout)} onActiveGroupChange={undefined} windowManager={null}>{children}</WindowLayer>
        {records.map((record) => <WorkspaceLayer key={record.id} record={record} stage={stage} onContext={bindContext(record.id)}
          onChange={(layout) => updateLayout(record.id, layout)} featureWindows={props.featureWindows} tracklistControl={props.tracklistControl} />)}
      </>}
      <div className="workspace-activity-stack" data-window-system data-workspace-navigator>
        {activityWindows}{mobile && workspaceControls}
      </div>
      {stage && browserOpen && mobile && <WorkspaceSheet context={`${workspaceId}:${view}`} nonModal={!entryPending && tutorialBrowser} onClose={() => { setBrowserOpen(false); setTutorialBrowser(false); tutorialOpenedBrowser.current = false; }}>{browser}</WorkspaceSheet>}
    </div>{hasSidebar && <aside aria-label="Workspace and player" className="workspace-sidebar" data-window-system data-workspace-navigator>
      <div className="workspace-sidebar__controls">{workspaceControls}</div>
      {stage && browserOpen && browser}
      {sidebarContent && <div className="workspace-sidebar__player">{sidebarContent}</div>}
    </aside>}</div>
  </WorkspaceRoutingContext.Provider></BrowseChromeContext.Provider>;
}

function WorkspaceLayer({ record, stage, onContext, onChange, featureWindows, tracklistControl }: {
  record: SavedWorkspace; stage: HTMLElement; onContext: (layer: WindowLayerContext) => void; onChange: (layout: WindowWorkspace) => void;
  featureWindows: ComponentProps<typeof WindowLayer>["featureWindows"]; tracklistControl: ComponentProps<typeof WindowLayer>["tracklistControl"];
}) {
  const initial = useRef(record.layout);
  return <WindowLayer initialWorkspace={initial.current} container={stage} childrenInPage onContext={onContext} onWorkspaceChange={onChange}
    featureWindows={featureWindows} tracklistControl={tracklistControl} windowManager={null}>{null}</WindowLayer>;
}

function WorkspaceSheet({ children, context, nonModal, onClose }: { children: ReactNode; context: string; nonModal: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (dialog.open) dialog.close();
    if (nonModal) dialog.show(); else dialog.showModal();
  }, [context, nonModal]);
  return createPortal(<dialog ref={ref} aria-label="Workspace Explorer" className={`workspace-explorer-sheet${nonModal ? " workspace-explorer-sheet--tutorial" : ""}`} data-window-system data-workspace-navigator
    onCancel={(event) => { event.preventDefault(); onClose(); }}>{children}</dialog>, document.body);
}
