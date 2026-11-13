import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FilterTab } from "../../atoms/FilterTab/FilterTab";
import { Badge } from "../../atoms/Badge/Badge";
import { SnapPreview } from "../../atoms/SnapPreview/SnapPreview";
import "../../foundations/MediaPalette.css";
import "./CollectionTabs.css";

export interface CollectionTab {
  id: string;
  label: string;
  panelId: string;
  icon?: ReactNode;
  kind?: string;
  isPlaying?: boolean;
}

export interface CollectionTabsProps {
  tabs: CollectionTab[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: string;
  className?: string;
  onTearOut?: (id: string, point: { x: number; y: number }) => void;
  onReorder?: (ids: string[]) => void;
  getDropTarget?: (point: { x: number; y: number }) => {
    label: string; bounds: { left: number; top: number; width: number; height: number };
  } | null;
}

const mediaKinds = ["dub", "sample", "vocal"];
const kindClass = (kind?: string) => kind === "dialog" || kind === "profile" ? "window-kind--dialog" : kind && mediaKinds.includes(kind) ? `media-kind--${kind}` : "";

export function CollectionTabs({ tabs, selectedId, onSelect, label, className = "", onTearOut, onReorder, getDropTarget }: CollectionTabsProps) {
  const root = useRef<HTMLDivElement>(null);
  const keyboardSelection = useRef(false);
  const drag = useRef<{ id: string; pointerId: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ label: string; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<ReturnType<NonNullable<CollectionTabsProps["getDropTarget"]>>>(null);
  const [reorderTarget, setReorderTarget] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!keyboardSelection.current) return;
    keyboardSelection.current = false;
    const selected = root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selectedId]);
  const sharedKind = tabs.length > 0 && tabs.every((tab) => tab.kind === tabs[0].kind) ? kindClass(tabs[0].kind) : "";
  function outside(x: number, y: number) {
    const bounds = root.current?.getBoundingClientRect();
    return !bounds || x < bounds.left - 12 || x > bounds.right + 12 || y < bounds.top - 12 || y > bounds.bottom + 12;
  }
  function endDrag(tab: CollectionTab, event: PointerEvent<HTMLButtonElement>, release: boolean) {
    if (drag.current?.id !== tab.id || drag.current.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) >= 6;
    drag.current = null;
    setGhost(null);
    setDropTarget(null);
    setReorderTarget(null);
    if (!release || !moved) return;
    if (onTearOut && outside(event.clientX, event.clientY)) {
      suppressClick.current = true;
      onTearOut(tab.id, { x: event.clientX, y: event.clientY });
    } else if (onReorder) {
      const target = tabAt(event.clientX);
      if (target && target !== tab.id) { suppressClick.current = true; reorder(tab.id, target); }
    }
  }
  function tabAt(x: number) {
    const elements = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    return elements.find((element) => { const bounds = element.getBoundingClientRect(); return x >= bounds.left && x <= bounds.right; })?.id;
  }
  function reorder(source: string, target: string) {
    const ids = tabs.map((tab) => tab.id);
    const from = ids.indexOf(source);
    const to = ids.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, source);
    onReorder?.(ids);
  }
  return <div ref={root} className={`collection-tabs${sharedKind ? ` ${sharedKind}` : ""} ${className}`} role="tablist" aria-label={label} data-reorderable={onReorder ? "" : undefined}>
    {tabs.map((tab, index) => <FilterTab key={tab.id} id={tab.id}
      title={onReorder ? `${tab.label} — drag to reorder; Alt+Left/Right moves this tab${onTearOut ? "; drag out to ungroup" : ""}`
        : onTearOut ? `${tab.label} — drag out of the tabs to move it to its own window` : tab.label}
      className={kindClass(tab.kind) || undefined}
      data-reorder-target={reorderTarget === tab.id ? "" : undefined}
      active={selectedId === tab.id} tabIndex={selectedId === tab.id ? 0 : -1} aria-controls={tab.panelId}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={() => onSelect(tab.id)}
      onPointerDown={onTearOut || onReorder ? (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        suppressClick.current = false;
        drag.current = { id: tab.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      } : undefined}
      onPointerMove={onTearOut || onReorder ? (event) => {
        if (drag.current?.id !== tab.id || drag.current.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) < 6) return;
        const out = outside(event.clientX, event.clientY);
        setGhost(out && onTearOut ? { label: tab.label, x: event.clientX, y: event.clientY } : null);
        setDropTarget(out ? getDropTarget?.({ x: event.clientX, y: event.clientY }) ?? null : null);
        setReorderTarget(!out && onReorder ? tabAt(event.clientX) ?? null : null);
      } : undefined}
      onPointerUp={onTearOut || onReorder ? (event) => endDrag(tab, event, true) : undefined}
      onPointerCancel={onTearOut || onReorder ? (event) => endDrag(tab, event, false) : undefined}
      onLostPointerCapture={onTearOut || onReorder ? (event) => endDrag(tab, event, false) : undefined}
      onKeyDown={(event) => {
        if (event.altKey && onReorder && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          const target = tabs[index + (event.key === "ArrowLeft" ? -1 : 1)];
          if (target) { reorder(tab.id, target.id); keyboardSelection.current = false; }
          return;
        }
        let next: number;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        keyboardSelection.current = tabs[next].id !== selectedId;
        onSelect(tabs[next].id);
      }}>{tab.icon && <span className="collection-tabs__icon" aria-hidden="true">{tab.icon}</span>}{tab.isPlaying && <Badge dot variant="audio" role="status" aria-label="Now playing" />}{tab.label}</FilterTab>)}
    {ghost && createPortal(<div aria-hidden="true" className="collection-tabs__ghost" style={{ left: ghost.x + 12, top: ghost.y + 12 }}>
      <span className="collection-tabs__ghost-title">{ghost.label}</span>
      <span className="collection-tabs__ghost-hint">{dropTarget?.label ?? "Release to move to its own window"}</span>
    </div>, document.body)}
    {dropTarget && <SnapPreview active label={dropTarget.label} style={{
      left: dropTarget.bounds.left, top: dropTarget.bounds.top, width: dropTarget.bounds.width, height: dropTarget.bounds.height,
    }} />}
  </div>;
}
