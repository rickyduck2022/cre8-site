import { createContext, useContext, useEffect, useRef } from "react";

export type TutorialSurface = "browse" | "search" | "filters" | "playback" | "workspace" | "upload";
export interface TutorialNavigationRequest { id: number; surface: TutorialSurface; ready: boolean }
export const TutorialNavigationContext = createContext<TutorialNavigationRequest | null>(null);

export function useTutorialNavigation(onReveal: (surface: TutorialSurface) => void) {
  const request = useContext(TutorialNavigationContext);
  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  useEffect(() => {
    if (request?.ready) reveal.current(request.surface);
  }, [request?.id, request?.ready, request?.surface]);
}
