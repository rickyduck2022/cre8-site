import { useEffect, useRef, useState } from "react";

type Marker = { session: string; index: number };
type HistoryState = { cre8Navigation?: Marker; [key: string]: unknown };

function currentState(): HistoryState {
  const state: unknown = window.history.state;
  return state && typeof state === "object" && !Array.isArray(state) ? state as HistoryState : {};
}

function newSession(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function useAppHistory(onNavigate: () => void) {
  const marker = useRef<Marker | null>(null);
  const sessionRef = useRef("");
  const maxIndex = useRef(0);
  const lastHash = useRef(window.location.hash);
  const [position, setPosition] = useState({ index: 0, max: 0 });
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  useEffect(() => {
    const session = newSession();
    sessionRef.current = session;
    marker.current = { session, index: 0 };
    window.history.replaceState({ ...currentState(), cre8Navigation: marker.current }, "");
    function sync() {
      const next = currentState().cre8Navigation;
      if (next?.session !== sessionRef.current || !Number.isInteger(next.index)) {
        marker.current = null;
        setPosition({ index: 0, max: 0 });
      } else {
        marker.current = next;
        setPosition({ index: next.index, max: maxIndex.current });
      }
      if (lastHash.current !== window.location.hash) {
        lastHash.current = window.location.hash;
        onNavigateRef.current();
      }
    }
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  function navigate(hash: string) {
    if (window.location.hash === hash) {
      onNavigateRef.current();
      return;
    }
    const previous = marker.current;
    const next = { session: previous?.session ?? newSession(), index: previous ? previous.index + 1 : 0 };
    sessionRef.current = next.session;
    marker.current = next;
    maxIndex.current = next.index;
    window.history.pushState({ ...currentState(), cre8Navigation: next }, "", hash);
    lastHash.current = window.location.hash;
    setPosition({ index: next.index, max: next.index });
    onNavigateRef.current();
  }

  return {
    navigate,
    canGoBack: position.index > 0,
    canGoForward: position.index < position.max,
    goBack: () => window.history.back(),
    goForward: () => window.history.forward(),
  };
}
