import type { FloatingPlayerPosition } from "./useFloatingPlayerPosition";

type PlayerContext = "messenger" | "other";

export interface PlayerLayout {
  minimized: Partial<Record<PlayerContext, boolean>>;
  placement: Partial<Record<PlayerContext, "header" | "footer" | "right-dock" | "fullscreen" | "window">>;
  position: FloatingPlayerPosition;
  opacity: number;
}

const storageKey = "cre8:player-layout";
const defaultLayout: PlayerLayout = {
  minimized: { messenger: false, other: false },
  placement: { messenger: "footer", other: "footer" },
  position: "initial",
  opacity: 100,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContextMap(value: unknown, isValid: (value: unknown) => boolean): boolean {
  return isRecord(value) && Object.entries(value).every(([key, entry]) =>
    (key === "messenger" || key === "other") && isValid(entry));
}

function isPosition(value: unknown): value is FloatingPlayerPosition {
  return value === null || value === "initial" || value === "left-edge" || value === "right-edge" || (isRecord(value)
    && typeof value.x === "number" && Number.isFinite(value.x)
    && typeof value.y === "number" && Number.isFinite(value.y));
}

export function readPlayerLayout(): PlayerLayout {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return defaultLayout;
    const value: unknown = JSON.parse(stored);
    if (isRecord(value)
      && isContextMap(value.minimized, (entry) => typeof entry === "boolean")
      && isContextMap(value.placement, (entry) => entry === "header" || entry === "footer" || entry === "right-dock" || entry === "fullscreen" || entry === "window")
      && isPosition(value.position)
      && (value.opacity === undefined || (typeof value.opacity === "number"
        && Number.isFinite(value.opacity) && value.opacity >= 30 && value.opacity <= 100))) {
      return {
        minimized: value.minimized as PlayerLayout["minimized"],
        placement: value.placement as PlayerLayout["placement"],
        position: value.position,
        opacity: typeof value.opacity === "number" ? value.opacity : 100,
      };
    }
    console.warn("Ignoring invalid saved player layout.");
  } catch (error) {
    console.warn("Unable to read saved player layout.", error);
  }
  return defaultLayout;
}

export function savePlayerLayout(layout: PlayerLayout): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(layout));
  } catch (error) {
    console.warn("Unable to save player layout.", error);
  }
}
