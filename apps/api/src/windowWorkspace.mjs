const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const bounded = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const text = (value, max) => typeof value === "string" && value.length > 0 && value.length <= max;

function frame(value) {
  if (!record(value) || !["floating", "left", "right", "fullscreen"].includes(value.placement)) return null;
  const position = value.position;
  if (position !== null && position !== "initial"
    && !(record(position) && bounded(position.x, 0, 100000) && bounded(position.y, 0, 100000))) return null;
  const size = value.size;
  if (size !== null && !(record(size) && bounded(size.width, 1, 100000) && bounded(size.height, 1, 100000))) return null;
  return {
    placement: value.placement,
    position: record(position) ? { x: position.x, y: position.y } : position,
    size: size ? { width: size.width, height: size.height } : null,
  };
}

export function parseWindowWorkspace(value, nested = false) {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.windows) || value.windows.length > 50
    || !record(value.dockWidths) || Object.keys(value.dockWidths).length > 20
    || (value.playerTrackId !== null && !text(value.playerTrackId, 200))) {
    return { error: "Provide a valid window workspace (up to 50 windows)." };
  }
  const ids = new Set();
  const windows = [];
  for (const entry of value.windows) {
    if (!record(entry) || !text(entry.id, 220) || !/^(?:player|pack:.+|conversation:.+|track:.+|profile:[a-z0-9._-]{3,24}|workspace:[a-zA-Z0-9_-]{1,100})$/.test(entry.id)
      || ids.has(entry.id) || typeof entry.minimized !== "boolean"
      || (entry.title !== null && (!text(entry.title, 100) || !entry.title.trim()))
      || (entry.group !== null && !text(entry.group, 250))
      || (entry.groupTitle !== undefined && (!text(entry.groupTitle, 100) || !entry.groupTitle.trim() || entry.group === null))
      || (entry.tabOrder !== undefined && (!Number.isInteger(entry.tabOrder) || !bounded(entry.tabOrder, 0, 100000)))
      || !Number.isInteger(entry.order) || !bounded(entry.order, 0, 100000)
      || !Number.isInteger(entry.dockOrder) || !bounded(entry.dockOrder, 0, 100000)) {
      return { error: "Provide valid, uniquely identified windows." };
    }
    const savedFrame = frame(entry.frame);
    const restoreFrame = entry.restoreFrame === null ? null : frame(entry.restoreFrame);
    if (!savedFrame || (entry.restoreFrame !== null && !restoreFrame)) return { error: "Provide valid window positions and sizes." };
    ids.add(entry.id);
    windows.push({
      id: entry.id, title: entry.title, minimized: entry.minimized, group: entry.group,
      order: entry.order, dockOrder: entry.dockOrder, frame: savedFrame, restoreFrame,
      ...(entry.tabOrder !== undefined ? { tabOrder: entry.tabOrder } : {}),
      ...(entry.groupTitle !== undefined ? { groupTitle: entry.groupTitle.trim() } : {}),
    });
  }
  const dockWidths = {};
  for (const [key, width] of Object.entries(value.dockWidths)) {
    if (!/^.{0,100}:(left|right)$/.test(key) || (width !== null && !bounded(width, 1, 100000))) {
      return { error: "Provide valid dock widths." };
    }
    dockWidths[key] = width;
  }
  const workspace = { version: 1, windows, dockWidths, playerTrackId: value.playerTrackId };
  if (value.openedDependencies !== undefined) {
    if (!Array.isArray(value.openedDependencies) || value.openedDependencies.length > 50
      || new Set(value.openedDependencies).size !== value.openedDependencies.length
      || value.openedDependencies.some((id) => !ids.has(id) || id.startsWith("workspace:"))) {
      return { error: "Provide valid, unique opened dependencies from this workspace." };
    }
    workspace.openedDependencies = value.openedDependencies;
  }
  if (value.mode !== undefined) {
    if (nested || !["simple", "explorer"].includes(value.mode)) return { error: "Provide a valid workspace mode." };
    workspace.mode = value.mode;
  }
  if (value.explorerIntroduced !== undefined) {
    if (nested || typeof value.explorerIntroduced !== "boolean") return { error: "Provide a valid Explorer introduction preference." };
    workspace.explorerIntroduced = value.explorerIntroduced;
  }
  if (value.workspaces !== undefined) {
    if (nested || !Array.isArray(value.workspaces) || value.workspaces.length > 20) return { error: "Provide up to 20 workspace contexts." };
    const workspaces = [];
    const contextIds = new Set();
    for (const context of value.workspaces) {
      if (!record(context) || !text(context.id, 100) || !/^[a-zA-Z0-9_-]+$/.test(context.id) || contextIds.has(context.id)
        || !text(context.title, 100) || !context.title.trim() || typeof context.saved !== "boolean"
        || !Array.isArray(context.dependencies) || context.dependencies.length > 20
        || context.dependencies.some((id) => !text(id, 100)) || new Set(context.dependencies).size !== context.dependencies.length) {
        return { error: "Provide valid, uniquely identified workspace contexts." };
      }
      const parsed = parseWindowWorkspace(context.layout, true);
      if (parsed.error) return parsed;
      const saved = context.savedLayout === undefined ? null : parseWindowWorkspace(context.savedLayout, true);
      if (saved?.error) return saved;
      if (saved?.workspace.windows.some((entry) => entry.id.startsWith("workspace:") || entry.id === "player")) {
        return { error: "Saved checkpoints must contain only independent content windows." };
      }
      contextIds.add(context.id);
      workspaces.push({ id: context.id, title: context.title.trim(), saved: context.saved, dependencies: context.dependencies, layout: parsed.workspace,
        ...(saved ? { savedLayout: saved.workspace } : {}) });
    }
    const layouts = [workspace, ...workspaces.map((context) => context.layout)];
    const allIds = layouts.flatMap((layout) => layout.windows.map((entry) => entry.id));
    if (allIds.length > 200 || new Set(allIds).size !== allIds.length
      || allIds.some((id) => id.startsWith("workspace:") && !contextIds.has(id.slice(10)))
      || workspaces.some((context) => context.dependencies.some((id) => !contextIds.has(id)))) return { error: "Provide valid workspace dependencies and unique window ownership." };
    const graph = new Map(workspaces.map((context) => [context.id, [...context.dependencies,
      ...context.layout.windows.filter((entry) => entry.id.startsWith("workspace:")).map((entry) => entry.id.slice(10))]]));
    const visiting = new Set();
    const visited = new Set();
    function cycle(id) {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      if ((graph.get(id) ?? []).some(cycle)) return true;
      visiting.delete(id); visited.add(id); return false;
    }
    if ([...contextIds].some(cycle)) return { error: "Workspace dependencies must not contain cycles." };
    workspace.workspaces = workspaces;
  } else if (windows.some((entry) => entry.id.startsWith("workspace:")) && !nested) return { error: "Provide workspace contexts for workspace windows." };
  if (value.viewedWorkspaceId !== undefined) {
    if (nested || typeof value.viewedWorkspaceId !== "string"
      || (value.viewedWorkspaceId !== "" && !workspace.workspaces?.some((entry) => entry.id === value.viewedWorkspaceId))) {
      return { error: "Provide a viewed workspace from this account's workspace list." };
    }
    workspace.viewedWorkspaceId = value.viewedWorkspaceId;
  }
  if (value.activeWorkspaceId !== undefined) {
    if (nested || (value.activeWorkspaceId !== null && (typeof value.activeWorkspaceId !== "string"
      || (value.activeWorkspaceId !== "" && !workspace.workspaces?.some((entry) => entry.id === value.activeWorkspaceId))))) {
      return { error: "Provide an active workspace from this account's workspace list." };
    }
    workspace.activeWorkspaceId = value.activeWorkspaceId;
  }
  return { workspace };
}
