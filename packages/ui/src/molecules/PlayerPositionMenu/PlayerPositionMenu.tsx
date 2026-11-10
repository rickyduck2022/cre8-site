import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Ellipsis } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { PlayerTab } from "../../atoms/PlayerTab/PlayerTab";
import "./PlayerPositionMenu.css";

export type PlayerPosition = "header" | "footer" | "sidebar" | "right-dock" | "default" | "floating" | "left-edge" | "right-edge" | "fullscreen" | "minimized";

export interface PlayerPositionMenuProps {
  positions: PlayerPosition[];
  current?: PlayerPosition;
  onSelect: (position: PlayerPosition) => void;
  opacityControl?: { value: number; onChange: (opacity: number) => void };
}

const labels: Record<PlayerPosition, string> = {
  header: "Header",
  footer: "Footer",
  sidebar: "Left sidebar",
  "right-dock": "Right dock",
  default: "Default mini position",
  floating: "Pop out",
  "left-edge": "Left edge",
  "right-edge": "Right edge",
  fullscreen: "Full screen",
  minimized: "Minimized",
};

function PositionIcon({ position }: { position: PlayerPosition }) {
  const areas: Record<PlayerPosition, { x: number; y: number; width: number; height: number }> = {
    header: { x: 4, y: 5, width: 16, height: 3 },
    footer: { x: 4, y: 16, width: 16, height: 3 },
    sidebar: { x: 4, y: 5, width: 4, height: 14 },
    "right-dock": { x: 16, y: 5, width: 4, height: 14 },
    default: { x: 13, y: 14, width: 6, height: 4 },
    floating: { x: 9, y: 9, width: 6, height: 5 },
    "left-edge": { x: 4, y: 9, width: 2, height: 6 },
    "right-edge": { x: 18, y: 9, width: 2, height: 6 },
    fullscreen: { x: 4, y: 5, width: 16, height: 14 },
    minimized: { x: 13, y: 14, width: 6, height: 4 },
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect {...areas[position]} rx="0.5" fill="currentColor" stroke="none" data-position={position} />
    </svg>
  );
}

export function PlayerPositionMenu({ positions, current, onSelect, opacityControl }: PlayerPositionMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !popover.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    function closeOnResize() { setOpen(false); }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [open]);

  function toggle() {
    if (!open && trigger.current) {
      const bounds = trigger.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - 184, bounds.right - 176));
      setMenuStyle(bounds.top > window.innerHeight / 2
        ? { left, bottom: window.innerHeight - bounds.top + 8, maxHeight: Math.max(0, bounds.top - 16) }
        : { left, top: bounds.bottom + 8, maxHeight: Math.max(0, window.innerHeight - bounds.bottom - 16) });
    }
    setOpen((value) => !value);
  }

  return (
    <div className="player-position-menu" ref={root} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget) && !popover.current?.contains(event.relatedTarget)) setOpen(false);
    }}>
      <PlayerTab ref={trigger} aria-label="Choose player position" aria-expanded={open} aria-controls={open ? id : undefined}
        className="player-position-menu__trigger" leadingIcon={<Ellipsis aria-hidden="true" />}
        onClick={toggle} />
      {open && createPortal(
        <div ref={popover} className="player-position-menu__popover" id={id} role="group" aria-label="Player positions" style={menuStyle}>
          {positions.map((position) => (
            <Button key={position} aria-pressed={current === position} leadingIcon={<PositionIcon position={position} />} onClick={() => {
              setOpen(false);
              onSelect(position);
            }} size="small" variant="tertiary">{labels[position]}</Button>
          ))}
          {opacityControl && <label className="player-position-menu__transparency">
            <span>Opacity <span aria-hidden="true">{opacityControl.value}%</span></span>
            <input type="range" min="30" max="100" step="5" value={opacityControl.value}
              aria-valuetext={`${opacityControl.value}% opacity`}
              onChange={(event) => opacityControl.onChange(Number(event.currentTarget.value))} />
          </label>}
        </div>,
        root.current?.closest("dialog") ?? document.body,
      )}
    </div>
  );
}
