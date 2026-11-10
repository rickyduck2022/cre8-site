import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

type Position = { x: number; y: number };
export type FloatingPlayerPosition = Position | null | "initial" | "left-edge" | "right-edge";
type SnapTarget = { kind: "dock" | "footer" | "header" | "left-edge" | "right-edge"; style: CSSProperties; active: boolean; previewStyle?: CSSProperties };
type PlayerPositionStyle = CSSProperties & {
  "--floating-player-left"?: string;
  "--floating-player-top"?: string;
  "--floating-player-right"?: string;
  "--floating-player-bottom"?: string;
};

const positionProperties = [
  "--floating-player-left",
  "--floating-player-top",
  "--floating-player-right",
  "--floating-player-bottom",
] as const;
const snapDistance = 32;

function dockBounds(player: HTMLElement): DOMRect {
  const dashboard = player.closest<HTMLElement>(".community-dashboard-template");
  const wasDocked = dashboard?.classList.contains("community-dashboard-template--player-docked") ?? false;
  const previous = positionProperties.map((property) => player.style.getPropertyValue(property));
  dashboard?.classList.add("community-dashboard-template--player-docked");
  positionProperties.forEach((property) => player.style.removeProperty(property));
  const bounds = player.getBoundingClientRect();
  positionProperties.forEach((property, index) => {
    if (previous[index]) player.style.setProperty(property, previous[index]);
  });
  if (!wasDocked) dashboard?.classList.remove("community-dashboard-template--player-docked");
  return bounds;
}

function clampPosition(position: Position, player: HTMLElement): Position {
  const bounds = player.getBoundingClientRect();
  const tabs = player.querySelectorAll<HTMLElement>(".audio-player__minimize, .audio-player__drag");
  const tabHeight = Array.from(tabs).reduce((height, tab) => {
    const tabBounds = tab.getBoundingClientRect();
    return Math.max(height, Number.isFinite(tabBounds.top) && Number.isFinite(bounds.top)
      ? Math.max(0, bounds.top - tabBounds.top)
      : tabBounds.height);
  }, 0);
  const maxX = Math.max(0, window.innerWidth - bounds.width);
  const maxY = Math.max(0, window.innerHeight - bounds.height);
  return {
    x: Math.max(0, Math.min(maxX, position.x)),
    y: Math.min(maxY, Math.max(Math.min(tabHeight, maxY), position.y)),
  };
}

function snapTargets(player: HTMLElement, position: Position, x: number, y: number, pointerOffset: Position): SnapTarget[] {
  const dashboard = player.closest<HTMLElement>(".community-dashboard-template");
  const targets: SnapTarget[] = [];
  const header = dashboard?.querySelector<HTMLElement>(".app-header-region")?.getBoundingClientRect();
  if (header && header.width > 0 && header.height > 0) {
    targets.push({
      kind: "header",
      active: x >= header.left && x <= header.right && y >= header.top && y <= header.bottom,
      style: { left: header.left, top: header.top, width: header.width, height: header.height },
      previewStyle: { left: header.left, top: header.bottom, width: header.width, height: window.innerWidth <= 760 ? "8.25rem" : "4.75rem" },
    });
  }
  if (window.innerWidth <= 760) {
    const navigation = dashboard?.querySelector<HTMLElement>(".mobile-tabs");
    const bounds = navigation?.getBoundingClientRect();
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      targets.push({
        kind: "footer",
        active: x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom,
        style: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
        previewStyle: { left: bounds.left, width: bounds.width, bottom: window.innerHeight - bounds.top, height: `min(8.25rem, ${bounds.top}px)` },
      });
    }
    const overLeftEdge = x >= 0 && x <= snapDistance && y >= 0 && y <= window.innerHeight;
    if (overLeftEdge) targets.forEach((target) => { target.active = false; });
    const top = header && header.height > 0 ? header.bottom : 0;
    const bottom = bounds && bounds.height > 0 ? bounds.top : window.innerHeight;
    for (const side of ["left-edge", "right-edge"] as const) {
      const left = side === "left-edge" ? 0 : window.innerWidth - snapDistance;
      targets.push({
        kind: side,
        active: side === "left-edge" ? overLeftEdge : !targets.some((target) => target.active) && y >= top && y <= bottom && x >= left && x <= left + snapDistance,
        style: { [side === "left-edge" ? "left" : "right"]: 0, top: "50%", width: "2.75rem", height: "var(--app-player-edge-height)", transform: "translateY(-50%)" },
      });
    }
    return targets;
  }
  const footer = dashboard?.querySelector<HTMLElement>(".app-player-footer-target");
  const bounds = footer?.getBoundingClientRect();
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    targets.push({
      kind: "footer",
      active: x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom,
      style: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
    });
  }
  const dock = dockBounds(player);
  const sidebar = window.innerWidth >= 1051 ? dashboard?.querySelector<HTMLElement>(".app-sidebar")?.getBoundingClientRect() : undefined;
  const overSidebar = !!sidebar && sidebar.width > 0 && sidebar.height > 0
    && x >= sidebar.left && x <= sidebar.right && y >= sidebar.top && y <= sidebar.bottom;
  if (dock.width > 0 && dock.height > 0) {
    targets.push({
      kind: "dock",
      active: !targets.some((target) => target.active) && (overSidebar || Math.hypot(position.x - dock.left, position.y - dock.top) <= snapDistance),
      style: sidebar && sidebar.width > 0 && sidebar.height > 0
        ? { left: sidebar.left, top: sidebar.top, width: sidebar.width, height: sidebar.height }
        : { left: dock.left + pointerOffset.x - snapDistance, top: dock.top + pointerOffset.y - snapDistance, width: snapDistance * 2, height: snapDistance * 2, borderRadius: "50%" },
      previewStyle: sidebar ? { left: dock.left, top: dock.top, width: dock.width, height: dock.height } : undefined,
    });
  }
  return targets;
}

export function useFloatingPlayerPosition(playerRef: RefObject<HTMLElement | null>, enabled: boolean, onSnapToExpanded: (target: "header" | "footer") => void, initialPosition: FloatingPlayerPosition = "initial") {
  const [position, setPosition] = useState<FloatingPlayerPosition>(initialPosition);
  const [previews, setPreviews] = useState<SnapTarget[]>([]);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; origin: Position; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const player = playerRef.current;
    if (!enabled || !player) return;
    const clamp = () => {
      setPosition((current) => {
        if (!current || typeof current === "string") return current;
        const next = clampPosition(current, player);
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };
    clamp();
    window.addEventListener("resize", clamp);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(clamp);
    observer?.observe(player);
    return () => {
      drag.current = null;
      setPreviews([]);
      window.removeEventListener("resize", clamp);
      observer?.disconnect();
    };
  }, [enabled, playerRef]);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    const player = playerRef.current;
    if (!enabled || !player || event.button !== 0 || !event.isPrimary) return;
    const bounds = player.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { x: bounds.left, y: bounds.top }, moved: false };
    setPreviews(snapTargets(player, { x: bounds.left, y: bounds.top }, event.clientX, event.clientY, { x: event.clientX - bounds.left, y: event.clientY - bounds.top }));
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    const player = playerRef.current;
    if (!active || active.pointerId !== event.pointerId || !player) return;
    if (!active.moved && event.clientX === active.startX && event.clientY === active.startY) return;
    active.moved = true;
    const next = clampPosition({
      x: active.origin.x + event.clientX - active.startX,
      y: active.origin.y + event.clientY - active.startY,
    }, player);
    setPosition(next);
    setPreviews(snapTargets(player, next, event.clientX, event.clientY, { x: active.startX - active.origin.x, y: active.startY - active.origin.y }));
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    const player = playerRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    setPreviews([]);
    if (!active.moved || !player) return;
    const position = clampPosition({
      x: active.origin.x + event.clientX - active.startX,
      y: active.origin.y + event.clientY - active.startY,
    }, player);
    const target = snapTargets(player, position, event.clientX, event.clientY, { x: active.startX - active.origin.x, y: active.startY - active.origin.y }).find((candidate) => candidate.active);
    setPosition(target?.kind === "left-edge" || target?.kind === "right-edge" ? target.kind : target ? null : position);
    if (target?.kind === "header" || target?.kind === "footer") onSnapToExpanded(target.kind);
  }

  function stopDragging(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId === event.pointerId) {
      drag.current = null;
      setPreviews([]);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const player = playerRef.current;
    if (!enabled || !player) return;
    if (event.key === "Home") {
      event.preventDefault();
      setPosition("initial");
      return;
    }
    const movement: Record<string, Position> = {
      ArrowLeft: { x: -16, y: 0 },
      ArrowRight: { x: 16, y: 0 },
      ArrowUp: { x: 0, y: -16 },
      ArrowDown: { x: 0, y: 16 },
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    const bounds = player.getBoundingClientRect();
    setPosition(clampPosition({ x: bounds.left + delta.x, y: bounds.top + delta.y }, player));
  }

  function popOut() {
    const player = playerRef.current;
    if (!player) return;
    const bounds = player.getBoundingClientRect();
    const sidebar = player.closest(".community-dashboard-template")?.querySelector<HTMLElement>(".app-sidebar")?.getBoundingClientRect();
    const left = sidebar && sidebar.width > 0 ? sidebar.right + 16 : bounds.left + 16;
    setPosition({ x: Math.max(0, left), y: Math.max(32, bounds.top) });
  }

  const style: PlayerPositionStyle | undefined = position && typeof position !== "string" ? {
    "--floating-player-left": `${position.x}px`,
    "--floating-player-top": `${position.y}px`,
    "--floating-player-right": "auto",
    "--floating-player-bottom": "auto",
  } : undefined;

  return { position, style, previews, isDocked: position === null, isInitial: position === "initial", popOut, dock: () => setPosition(null), dockToEdge: (side: "left-edge" | "right-edge") => setPosition(side), reset: () => setPosition("initial"), onPointerDown, onPointerMove, onPointerUp, onPointerCancel: stopDragging, onLostPointerCapture: stopDragging, onKeyDown };
}
