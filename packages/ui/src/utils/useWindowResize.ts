import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { WindowPoint } from "./useWindowPosition";

export type WindowSize = { width: number; height: number };
type Mode = "floating" | "left" | "right" | "fullscreen";

export function useWindowResize(ref: RefObject<HTMLElement | null>, enabled: boolean, mode: Mode, onPosition: (point: WindowPoint) => void, onDockWidthChange?: (width: number | null) => void) {
  const [size, setSize] = useState<WindowSize | null>(null);
  const [dockWidth, setDockWidth] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; width: number; height: number; left: number; top: number } | null>(null);

  function apply(width: number, height: number, left: number, top: number) {
    if (mode === "floating") {
      const maxWidth = Math.max(0, window.innerWidth - Math.max(0, left) - 8);
      const maxHeight = Math.max(0, window.innerHeight - Math.max(0, top) - 8);
      setSize({
        width: Math.max(Math.min(360, maxWidth), Math.min(maxWidth, width)),
        height: Math.max(Math.min(240, maxHeight), Math.min(maxHeight, height)),
      });
    } else {
      const next = Math.max(Math.min(360, window.innerWidth - 16), Math.min(window.innerWidth - 16, width));
      setDockWidth(next);
      onDockWidthChange?.(next);
    }
  }

  useLayoutEffect(() => {
    if (!enabled) return;
    const stop = () => { drag.current = null; setResizing(false); };
    window.addEventListener("resize", stop);
    return () => { stop(); window.removeEventListener("resize", stop); };
  }, [enabled, mode]);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    const element = ref.current;
    if (!enabled || mode === "fullscreen" || !element || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    const bounds = element.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      width: bounds.width, height: bounds.height, left: bounds.left, top: bounds.top };
    if (mode === "floating") onPosition({ x: bounds.left, y: bounds.top });
    setResizing(true);
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const origin = drag.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    apply(origin.width + (event.clientX - origin.x) * (mode === "right" ? -1 : 1),
      origin.height + event.clientY - origin.y, origin.left, origin.top);
  }
  function stop(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setResizing(false);
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const element = ref.current;
    if (!enabled || !element || mode === "fullscreen") return;
    if (event.key === "Home") {
      event.preventDefault();
      if (mode === "floating") setSize(null);
      else { setDockWidth(null); onDockWidthChange?.(null); }
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const bounds = element.getBoundingClientRect();
    const step = event.shiftKey ? 64 : 16;
    const horizontal = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const vertical = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    if (mode === "floating") onPosition({ x: bounds.left, y: bounds.top });
    apply(bounds.width + horizontal * (mode === "right" ? -1 : 1), bounds.height + vertical, bounds.left, bounds.top);
  }

  return { size, setSize, dockWidth, resizing, onPointerDown, onPointerMove, onPointerUp: stop,
    onPointerCancel: stop, onLostPointerCapture: stop, onKeyDown };
}
