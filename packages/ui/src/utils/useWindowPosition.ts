import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

export type WindowPoint = { x: number; y: number };
export type WindowPosition = WindowPoint | null | "initial" | "left-edge" | "right-edge";
export interface WindowSnapTarget<Kind extends string> {
  kind: Kind;
  style: CSSProperties;
  active: boolean;
  previewStyle?: CSSProperties;
}

export function clampWindowPosition(position: WindowPoint, element: HTMLElement): WindowPoint {
  const bounds = element.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(Math.max(0, window.innerWidth - bounds.width), position.x)),
    y: Math.max(0, Math.min(Math.max(0, window.innerHeight - bounds.height), position.y)),
  };
}

export function useWindowPosition<Kind extends string>(elementRef: RefObject<HTMLElement | null>, enabled: boolean, {
  initialPosition = "initial",
  clamp = clampWindowPosition,
  targets,
  onSnap,
}: {
  initialPosition?: WindowPosition;
  clamp?: (position: WindowPoint, element: HTMLElement) => WindowPoint;
  targets: (element: HTMLElement, position: WindowPoint, x: number, y: number, offset: WindowPoint) => WindowSnapTarget<Kind>[];
  onSnap: (target: Kind) => WindowPosition;
}) {
  const [position, setPosition] = useState<WindowPosition>(initialPosition);
  const [previews, setPreviews] = useState<WindowSnapTarget<Kind>[]>([]);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; origin: WindowPoint; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!enabled || !element) return;
    const update = () => setPosition((current) => {
      if (!current || typeof current === "string") return current;
      const next = clamp(current, element);
      return next.x === current.x && next.y === current.y ? current : next;
    });
    update();
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      drag.current = null;
      setPreviews([]);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [enabled, elementRef, clamp]);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    const element = elementRef.current;
    if (!enabled || !element || event.button !== 0 || !event.isPrimary) return;
    const bounds = element.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { x: bounds.left, y: bounds.top }, moved: false };
    setPreviews(targets(element, { x: bounds.left, y: bounds.top }, event.clientX, event.clientY, { x: event.clientX - bounds.left, y: event.clientY - bounds.top }));
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function nextPosition(clientX: number, clientY: number, element: HTMLElement) {
    const active = drag.current!;
    return clamp({ x: active.origin.x + clientX - active.startX, y: active.origin.y + clientY - active.startY }, element);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    const element = elementRef.current;
    if (!active || active.pointerId !== event.pointerId || !element) return;
    if (!active.moved && event.clientX === active.startX && event.clientY === active.startY) return;
    active.moved = true;
    const next = nextPosition(event.clientX, event.clientY, element);
    setPosition(next);
    setPreviews(targets(element, next, event.clientX, event.clientY, { x: active.startX - active.origin.x, y: active.startY - active.origin.y }));
    return true;
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    const element = elementRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    setPreviews([]);
    if (active.moved && element) {
      const next = nextPosition(event.clientX, event.clientY, element);
      const target = targets(element, next, event.clientX, event.clientY, { x: active.startX - active.origin.x, y: active.startY - active.origin.y }).find((candidate) => candidate.active);
      setPosition(target ? onSnap(target.kind) : next);
    }
    drag.current = null;
  }

  function stopDragging(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId === event.pointerId) {
      drag.current = null;
      setPreviews([]);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const element = elementRef.current;
    if (!enabled || !element) return;
    if (event.key === "Home") {
      event.preventDefault();
      setPosition("initial");
      return;
    }
    const movement: Record<string, WindowPoint> = {
      ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 },
      ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 },
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    const bounds = element.getBoundingClientRect();
    setPosition(clamp({ x: bounds.left + delta.x, y: bounds.top + delta.y }, element));
  }

  return { position, setPosition, previews, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: stopDragging, onLostPointerCapture: stopDragging, onKeyDown };
}
