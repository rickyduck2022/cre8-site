import { createContext, useContext, useState } from "react";

export type TutorialActivityType = "navigate" | "collection-view" | "search" | "search-cleared"
  | "filters-applied" | "filters-cancelled" | "audience-changed"
  | "playback-started" | "playback-paused" | "window-opened" | "window-minimized" | "window-restored"
  | "workspace-opened" | "workspace-save-requested" | "workspace-saved" | "upload-chosen" | "file-uploaded" | "pack-saved"
  | "media-shared" | "message-sent" | "friend-added";
export interface TutorialActivity { type: TutorialActivityType; value?: string; subjectId?: string }
export interface TutorialRequirement {
  label: string;
  events: TutorialActivity[];
  sameSubjectAsPrevious?: boolean;
  focusTargets?: string[];
  resultTargets?: string[];
  focusStrategy?: "single" | "controls";
}
type Listener = (activity: TutorialActivity) => void;
export interface TutorialActivityChannel {
  report: Listener;
  subscribe: (listener: Listener) => () => void;
}
export const TutorialActivityContext = createContext<TutorialActivityChannel | null>(null);
export function useTutorialActivityChannel(): TutorialActivityChannel {
  const [channel] = useState(() => {
    const listeners = new Set<Listener>();
    return {
      report: (activity: TutorialActivity) => { for (const listener of listeners) listener(activity); },
      subscribe: (listener: Listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    };
  });
  return channel;
}
const ignoreActivity: Listener = () => {};
export function useReportTutorialActivity(): Listener {
  return useContext(TutorialActivityContext)?.report ?? ignoreActivity;
}
