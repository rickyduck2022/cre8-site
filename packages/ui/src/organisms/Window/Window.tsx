import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { FilterTab } from "../../atoms/FilterTab/FilterTab";
import { SnapPreview } from "../../atoms/SnapPreview/SnapPreview";
import { useMobileLayout } from "../../utils/useMobileLayout";
import { useWindowPosition, type WindowPoint, type WindowPosition, type WindowSnapTarget } from "../../utils/useWindowPosition";
import { useWindowResize, type WindowSize } from "../../utils/useWindowResize";
import "./Window.css";

type Placement = "floating" | "left" | "right" | "fullscreen";
interface WindowFrame {
  placement: Placement;
  position: WindowPosition;
  size: WindowSize | null;
}
interface WindowEntry {
  id: string;
  title: string;
  placement: Placement;
  minimized: boolean;
  order: number;
  activate: () => void;
  element: HTMLDialogElement | null;
  setFrame: (frame: WindowFrame) => void;
}
const WindowContext = createContext<{
  windows: WindowEntry[];
  register: (entry: WindowEntry) => void;
  unregister: (id: string) => void;
  dockWidths: { left: number | null; right: number | null };
  setDockWidth: (side: "left" | "right", width: number | null) => void;
  groups: Record<string, string>;
  join: (source: string, target: string, frame: WindowFrame) => void;
  detach: (id: string) => void;
  syncFrame: (source: string, frame: WindowFrame) => void;
} | null>(null);
function dockTargets(_element: HTMLElement, _position: WindowPoint, x: number, y: number): WindowSnapTarget<"left" | "right">[] {
  return (["left", "right"] as const).map((kind) => ({
    kind, active: y >= 0 && y <= window.innerHeight && (kind === "left" ? x <= 32 : x >= window.innerWidth - 32),
    style: { [kind]: 8, top: 8, width: Math.min(480, window.innerWidth / 2 - 16), height: window.innerHeight - 16 },
  }));
}

export interface FloatingWindowProps {
  title: string;
  children: ReactNode;
  active: boolean;
  order: number;
  openRequest?: number;
  onActivate: () => void;
  onClose: () => void;
  className?: string;
}

export function WindowLayer({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<WindowEntry[]>([]);
  const [groups, setGroups] = useState<Record<string, string>>({});
  const groupSequence = useRef(0);
  const [dockWidths, setDockWidths] = useState<{ left: number | null; right: number | null }>({ left: null, right: null });
  const setDockWidth = useCallback((side: "left" | "right", width: number | null) => {
    setDockWidths((current) => current[side] === width ? current : { ...current, [side]: width });
  }, []);
  const register = useCallback((entry: WindowEntry) => {
    setWindows((current) => {
      const existing = current.find((item) => item.id === entry.id);
      if (!existing) return [...current, entry];
      if (existing.title === entry.title && existing.placement === entry.placement && existing.minimized === entry.minimized
        && existing.order === entry.order && existing.activate === entry.activate && existing.element === entry.element) return current;
      return current.map((item) => item.id === entry.id ? entry : item);
    });
  }, []);
  const unregister = useCallback((id: string) => {
    setWindows((current) => current.filter((entry) => entry.id !== id));
    setGroups((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);
  function detach(id: string) {
    setGroups((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  function join(source: string, target: string, frame: WindowFrame) {
    const targetEntry = windows.find((entry) => entry.id === target);
    if (!targetEntry) return;
    const members = windows.filter((entry) => !entry.minimized && (
      entry.id === source || entry.id === target
      || (groups[source] && groups[entry.id] === groups[source])
      || (groups[target] && groups[entry.id] === groups[target])
      || ((targetEntry.placement === "left" || targetEntry.placement === "right") && entry.placement === targetEntry.placement)
    ));
    const groupId = groups[target] ?? `${target}-group-${++groupSequence.current}`;
    setGroups((current) => ({ ...current, ...Object.fromEntries(members.map((entry) => [entry.id, groupId])) }));
    members.forEach((entry) => entry.setFrame(frame));
  }
  function syncFrame(source: string, frame: WindowFrame) {
    if (!groups[source]) return;
    windows.filter((entry) => entry.id !== source && !entry.minimized && groups[entry.id] === groups[source])
      .forEach((entry) => entry.setFrame(frame));
  }
  return createPortal(<WindowContext.Provider value={{ windows, register, unregister, dockWidths, setDockWidth, groups, join, detach, syncFrame }}><div className="window-layer">{children}</div></WindowContext.Provider>, document.body);
}

export function FloatingWindow({ title, children, active, order, openRequest = 0, onActivate, onClose, className = "" }: FloatingWindowProps) {
  const mobile = useMobileLayout();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const layout = useContext(WindowContext);
  const register = layout?.register;
  const unregister = layout?.unregister;
  const activateRef = useRef(onActivate);
  useLayoutEffect(() => { activateRef.current = onActivate; }, [onActivate]);
  const activate = useCallback(() => activateRef.current(), []);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [placement, setPlacement] = useState<Placement>("floating");
  const [minimized, setMinimized] = useState(false);
  const [offset] = useState(() => (order % 6) * 24);
  const dock = placement === "left" || placement === "right" ? placement : null;
  const group = layout?.windows.filter((entry) => !entry.minimized && entry.placement === placement && (
    dock ? entry.placement === dock : layout.groups[titleId] && layout.groups[entry.id] === layout.groups[titleId]
  )) ?? [];
  const selected = group.reduce<WindowEntry | undefined>((latest, entry) => !latest || entry.order > latest.order ? entry : latest, undefined);
  const tabbed = !mobile && !minimized && group.length > 1;
  const dockHidden = tabbed && selected?.id !== titleId;
  function groupingTargets(x: number, y: number): WindowSnapTarget<string>[] {
    return (layout?.windows ?? []).filter((entry) => entry.id !== titleId && !entry.minimized && entry.element?.open
      && !group.some((member) => member.id === entry.id))
      .sort((a, b) => b.order - a.order).map((entry) => {
        const element = entry.element!;
        const bounds = element.getBoundingClientRect();
        const regions = element.querySelectorAll<HTMLElement>(".floating-window__header, .floating-window__tabs");
        const hit = Array.from(regions).some((region) => {
          const rect = region.getBoundingClientRect();
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        });
        return { kind: `group:${entry.id}`, active: hit,
          style: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } };
      });
  }
  const movement = useWindowPosition(ref, !mobile && !dockHidden && placement !== "fullscreen" && !minimized, {
    targets: (element, point, x, y) => {
      const grouping = groupingTargets(x, y).find((target) => target.active);
      return grouping ? [grouping] : dockTargets(element, point, x, y).map((target) => ({
        ...target, style: { ...target.style, width: layout?.dockWidths[target.kind] ?? target.style.width },
      }));
    },
    onSnap: (target): WindowPosition => {
      if (target === "left" || target === "right") { setPlacement(target); return null; }
      const entry = layout?.windows.find((item) => `group:${item.id}` === target);
      if (!entry?.element || !layout) return movement.position;
      const bounds = entry.element.getBoundingClientRect();
      const position = { x: bounds.left, y: bounds.top };
      layout.join(titleId, entry.id, { placement: entry.placement, position, size: entry.placement === "floating"
        ? { width: bounds.width, height: bounds.height } : null });
      return position;
    },
  });
  const resize = useWindowResize(ref, !mobile && !dockHidden && !minimized, placement, movement.setPosition,
    (width) => { if (dock) layout?.setDockWidth(dock, width); });
  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const setFrame = useCallback((frame: WindowFrame) => {
    setPlacement(frame.placement); movement.setPosition(frame.position); resize.setSize(frame.size);
  }, [movement.setPosition, resize.setSize]);
  useLayoutEffect(() => { register?.({ id: titleId, title, placement, minimized, order, activate, element: ref.current, setFrame }); }, [register, titleId, title, placement, minimized, order, activate, setFrame]);
  const syncFrameRef = useRef(layout?.syncFrame);
  useLayoutEffect(() => { syncFrameRef.current = layout?.syncFrame; });
  const groupId = layout?.groups[titleId];
  useLayoutEffect(() => {
    if (active && !mobile && !minimized && groupId) syncFrameRef.current?.(titleId, {
      placement, position: movement.position, size: resize.size,
    });
  }, [active, mobile, minimized, titleId, groupId, placement, movement.position, resize.size]);
  useLayoutEffect(() => () => { unregister?.(titleId); }, [unregister, titleId]);
  useLayoutEffect(() => { setMinimized(false); }, [openRequest]);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const modal = useRef(false);
  const changingVisibility = useRef(false);
  useLayoutEffect(() => {
    const dialog = ref.current;
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const returnFocus = document.activeElement === document.body || dialog?.contains(document.activeElement);
      if (dialog?.open) dialog.close();
      if (returnFocus && restoreFocus.current?.isConnected) restoreFocus.current.focus();
    };
  }, []);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const wasOpen = dialog.open;
    const previousFocus = document.activeElement;
    changingVisibility.current = true;
    // Native modal dialogs occupy the top layer; only the active mobile window opens there.
    const visible = mobile ? active : !dockHidden;
    if (dialog.open && (modal.current !== mobile || !visible)) dialog.close();
    if (mobile) {
      if (active && !dialog.open) dialog.showModal();
    } else {
      if (visible && !dialog.open) dialog.show();
    }
    modal.current = mobile;
    if (visible && !active && !wasOpen && previousFocus instanceof HTMLElement && previousFocus.isConnected
      && !dialog.contains(previousFocus) && (previousFocus.closest("dialog")?.open ?? true)) previousFocus.focus({ preventScroll: true });
    if (visible && active && (!dialog.contains(document.activeElement) || (!wasOpen && tabbed))) {
      const target = dialog.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
        ?? dialog.querySelector<HTMLButtonElement>(".floating-window__close");
      target?.focus({ preventScroll: true });
      if (tabbed) target?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
    changingVisibility.current = false;
  }, [mobile, active, openRequest, minimized, dockHidden, tabbed]);

  function place(next: Placement) {
    layout?.detach(titleId);
    setPlacement(next);
    setMinimized(false);
    movement.setPosition("initial");
  }
  const point = movement.position && typeof movement.position === "object" ? movement.position : null;
  const minimizedIds = layout?.windows.filter((entry) => entry.minimized).map((entry) => entry.id) ?? [];
  const stackIndex = Math.max(0, minimizedIds.indexOf(titleId));
  const stackRows = Math.max(1, Math.floor((viewport.height - 32) / 60));
  const stackColumns = Math.max(1, Math.ceil(Math.max(1, minimizedIds.length) / stackRows));
  const stackWidth = Math.min(360, (viewport.width - 32) / stackColumns - 8);
  const floatingWidth = resize.size ? Math.min(resize.size.width, viewport.width - 16) : undefined;
  const floatingHeight = resize.size ? Math.min(resize.size.height, viewport.height - 16) : undefined;
  const dockWidth = dock && layout ? layout.dockWidths[dock] : resize.dockWidth;
  const cascadeOffset = groupId ? 0 : offset;
  const style: CSSProperties = {
    zIndex: minimized && !mobile ? (layout?.windows.length ?? order + 1) * 2 + stackIndex + 1 : order * 2 + 1,
    ...(placement === "floating" && !mobile ? {
      left: point ? Math.min(point.x, viewport.width - (floatingWidth ?? 0)) : `min(calc(100vw - ${floatingWidth ? `${floatingWidth}px` : "min(42rem, 100vw - 2rem)"} - 1rem), calc(12vw + ${cascadeOffset}px))`,
      top: point ? Math.min(point.y, viewport.height - (floatingHeight ?? 0)) : `min(calc(100dvh - ${floatingHeight ? `${floatingHeight}px` : "min(38rem, 100dvh - 2rem)"} - 1rem), calc(12vh + ${cascadeOffset}px))`,
      ...(resize.size ? { width: floatingWidth, height: floatingHeight } : {}),
    } : {}),
    ...(dock && dockWidth && !mobile ? { width: Math.min(dockWidth, viewport.width - 16) } : {}),
    ...(minimized && !mobile ? {
      left: "auto", top: "auto", right: 16 + Math.floor(stackIndex / stackRows) * (stackWidth + 8),
      bottom: 16 + (stackIndex % stackRows) * 60, width: stackWidth, height: 52,
    } : {}),
  };
  return <>
    <dialog ref={ref} aria-labelledby={titleId} aria-modal={mobile && active ? true : undefined}
      className={`floating-window floating-window--${placement}${active ? " floating-window--active" : ""}${minimized && !mobile ? " floating-window--minimized" : ""}${resize.resizing ? " floating-window--resizing" : ""} ${className}`}
      style={style} onPointerDownCapture={() => { if (!active) onActivate(); }}
      onFocusCapture={() => { if (!active && !changingVisibility.current) onActivate(); }}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      onKeyDown={(event) => {
        if (!mobile && active && event.key === "Escape" && !event.defaultPrevented && (event.target as HTMLElement).closest("dialog") === ref.current) {
          event.preventDefault(); event.stopPropagation(); onClose();
        }
      }}>
      <header className="floating-window__header">
        <h2 id={titleId} title={title}>{minimized && !mobile ? <button type="button" className="floating-window__restore" title={`Restore ${title}`}
          onClick={() => setMinimized(false)}>{title}</button> : title}</h2>
        {(!minimized || mobile) && <span className="floating-window__state" aria-hidden="true">{active ? "Active" : "Inactive"}</span>}
        {!mobile && !minimized && <Button variant="tertiary" size="small" className="floating-window__drag"
          aria-label={`Move ${title}; drag or use arrow keys, Home resets position`}
          title="Drag to move; arrow keys move; Home resets"
          disabled={placement === "fullscreen"}
          onPointerDown={movement.onPointerDown}
          onPointerMove={(event) => {
            if (movement.onPointerMove(event) && placement !== "floating") setPlacement("floating");
          }}
          onPointerUp={movement.onPointerUp} onPointerCancel={movement.onPointerCancel} onLostPointerCapture={movement.onLostPointerCapture}
          onKeyDown={(event) => { movement.onKeyDown(event); if (["Home", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) setPlacement("floating"); }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" /></svg>
        </Button>}
        {!mobile && !minimized && <label className="floating-window__position">
          <span className="sr-only">Position {title}</span>
          <select aria-label={`Position ${title}`} value={placement} onChange={(event) => place(event.currentTarget.value as Placement)}>
            <option value="floating">Floating</option><option value="left">Dock left</option><option value="right">Dock right</option><option value="fullscreen">Full screen</option>
          </select>
        </label>}
        {!mobile && <Button variant="tertiary" size="small" aria-label={`${minimized ? "Restore" : "Minimize"} ${title}`}
          title={minimized ? "Restore window" : "Minimize to pack stack"}
          leadingIcon={minimized ? <Maximize2 aria-hidden="true" /> : <Minimize2 aria-hidden="true" />}
          onClick={() => { if (!minimized) layout?.detach(titleId); setMinimized(!minimized); }} />}
        <Button className="floating-window__close" variant="tertiary" size="small" aria-label={`Close ${title}`}
          title="Close window"
          leadingIcon={<X aria-hidden="true" />} onClick={onClose} />
      </header>
      {tabbed && !dockHidden && <div className="floating-window__tabs" role="tablist" aria-label={dock ? `${dock === "left" ? "Left" : "Right"} docked packs` : "Grouped packs"}>
        {group.map((entry, index) => <FilterTab key={entry.id} id={`${titleId}-tab-${entry.id}`} title={entry.title}
          aria-controls={`${entry.id}-panel`} active={entry.id === titleId} tabIndex={entry.id === titleId ? 0 : -1}
          onClick={entry.activate} onKeyDown={(event) => {
            let next: number;
            if (event.key === "ArrowRight") next = (index + 1) % group.length;
            else if (event.key === "ArrowLeft") next = (index + group.length - 1) % group.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = group.length - 1;
            else return;
            event.preventDefault();
            group[next].activate();
          }}>{entry.title}</FilterTab>)}
      </div>}
      {tabbed && !dock && !dockHidden && <Button variant="tertiary" size="small" className="floating-window__detach"
        onClick={() => place("floating")}>Ungroup this pack</Button>}
      <div id={`${titleId}-panel`} className="floating-window__content" hidden={minimized && !mobile}
        role={tabbed ? "tabpanel" : undefined} aria-labelledby={tabbed ? `${selected?.id}-tab-${titleId}` : undefined}>{children}</div>
      {!mobile && !minimized && placement !== "fullscreen" && <button type="button" className={`floating-window__resize${placement === "right" ? " floating-window__resize--left" : ""}`}
        aria-label={`Resize ${title}; drag or use arrow keys, Home resets size`}
        title={placement === "floating" ? "Drag to resize; arrow keys resize; Shift for larger steps; Home resets size" : "Drag or use Left/Right to resize dock width; Home resets"}
        onPointerDown={resize.onPointerDown} onPointerMove={resize.onPointerMove} onPointerUp={resize.onPointerUp}
        onPointerCancel={resize.onPointerCancel} onLostPointerCapture={resize.onLostPointerCapture} onKeyDown={resize.onKeyDown}>
        <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 13 13 3M8 13l5-5M13 13h.01" /></svg>
      </button>}
    </dialog>
    {movement.previews.map((target) => <SnapPreview key={target.kind} active={target.active}
      label={target.kind.startsWith("group:") ? `Release to group with ${layout?.windows.find((entry) => `group:${entry.id}` === target.kind)?.title}`
        : `${target.active ? "Release" : "Drag"} to dock ${target.kind}`} style={{ ...target.style, zIndex: order * 2 + 2 }} />)}
  </>;
}
