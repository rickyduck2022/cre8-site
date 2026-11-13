import { useCallback, useEffect, useRef, useState } from "react";
import type { WindowWorkspace } from "@craft/ui";

type Save = (ownerId: string, workspace: WindowWorkspace) => Promise<void>;

export function useWindowWorkspace(userId: string | undefined, workspace: WindowWorkspace | null | undefined,
  loading: boolean, save: Save | undefined, notify: (message: string, type: "error") => void) {
  const [restored, setRestored] = useState<{ userId: string; workspace: WindowWorkspace | null } | null>(null);
  const pending = useRef<{ userId: string; workspace: WindowWorkspace } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const last = useRef("");
  const saving = useRef(Promise.resolve());
  const services = useRef({ save, notify });
  services.current = { save, notify };
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (!next || !services.current.save) return saving.current;
    saving.current = saving.current.then(async () => {
      try {
        await services.current.save?.(next.userId, next.workspace);
      } catch (error) {
        last.current = "";
        services.current.notify(error instanceof Error ? error.message : "Your window workspace could not be saved.", "error");
      }
    });
    return saving.current;
  }, []);
  useEffect(() => {
    if (!userId || loading) { setRestored(null); return; }
    setRestored((current) => current?.userId === userId ? current : { userId, workspace: workspace ?? null });
  }, [userId, loading, workspace]);
  useEffect(() => {
    last.current = "";
    return () => { void flush(); };
  }, [userId, flush]);
  useEffect(() => {
    const hide = () => { void flush(); };
    window.addEventListener("pagehide", hide);
    return () => { window.removeEventListener("pagehide", hide); void flush(); };
  }, [flush]);
  const onChange = useCallback((next: WindowWorkspace) => {
    if (!userId || restored?.userId !== userId || !services.current.save) return;
    const serialized = JSON.stringify(next);
    if (serialized === last.current) return;
    last.current = serialized;
    pending.current = { userId, workspace: next };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 600);
  }, [userId, restored, flush]);
  return { ready: !userId || restored?.userId === userId, initial: restored && restored.userId === userId ? restored.workspace : null, onChange, flush };
}
