import type { WindowPosition } from "../../utils/useWindowPosition";
import type { WindowSize } from "../../utils/useWindowResize";

export interface WindowFrame {
  placement: "floating" | "left" | "right" | "fullscreen";
  position: WindowPosition;
  size: WindowSize | null;
}

export interface SavedWindow {
  id: string;
  title: string | null;
  frame: WindowFrame;
  restoreFrame: WindowFrame | null;
  minimized: boolean;
  group: string | null;
  order: number;
  dockOrder: number;
  tabOrder?: number;
  groupTitle?: string;
}

export interface WindowWorkspace {
  version: 1;
  windows: SavedWindow[];
  dockWidths: Record<string, number | null>;
  playerTrackId: string | null;
  mode?: "simple" | "explorer";
  explorerIntroduced?: boolean;
  viewedWorkspaceId?: string;
  activeWorkspaceId?: string | null;
  openedDependencies?: string[];
  workspaces?: SavedWorkspace[];
}

export interface SavedWorkspace {
  id: string;
  title: string;
  saved: boolean;
  dependencies: string[];
  layout: Omit<WindowWorkspace, "workspaces" | "mode" | "explorerIntroduced" | "viewedWorkspaceId" | "activeWorkspaceId">;
  savedLayout?: SavedWorkspace["layout"];
}

export function workspaceWindows(workspace: WindowWorkspace | null | undefined): SavedWindow[] {
  return [...(workspace?.windows ?? []), ...(workspace?.workspaces ?? []).flatMap((entry) => entry.layout.windows)];
}
