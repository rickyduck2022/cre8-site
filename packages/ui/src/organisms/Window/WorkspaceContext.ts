import { createContext, useContext, type ContextType, type MutableRefObject } from "react";
import type { FeatureWindowSystem, WindowContext, WindowTracklistControl } from "./Window";

export type WindowLayerContext = NonNullable<ContextType<typeof WindowContext>>;
export interface WorkspaceAddition {
  label: string;
  expiresAt: number;
}
export interface WorkspaceRouting {
  current: MutableRefObject<string>;
  openOwner: (id: string) => string;
  owners: Record<string, string>;
  layers: Record<string, WindowLayerContext>;
  bind: (id: string, owner: string, requested?: boolean) => void;
  active: (id: string) => boolean;
  hidden: (id: string) => boolean;
  hideWindows: () => void;
  revealWindows: (id?: string) => void;
  actions: (id: string) => { label: string; onSelect: () => void }[];
  additions: Record<string, WorkspaceAddition>;
  added: (ids: string[], owner: string) => void;
  workspaceDropTarget: (id: string, x: number, y: number) => {
    id: string; title: string; bounds: { left: number; top: number; width: number; height: number };
  } | null;
  moveIntoWorkspace: (id: string, owner: string) => void;
  featureWindows?: FeatureWindowSystem;
  tracklistControl?: WindowTracklistControl;
}
export const WorkspaceRoutingContext = createContext<WorkspaceRouting | null>(null);
export const useWorkspaceRouting = () => useContext(WorkspaceRoutingContext);
