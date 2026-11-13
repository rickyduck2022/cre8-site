import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { PlayerPositionMenuProps } from "@craft/ui";
import type { CommunitySection } from "../types/community";
import { readPlayerLayout, savePlayerLayout } from "./playerLayoutStorage";
import { useFloatingPlayerPosition } from "./useFloatingPlayerPosition";

export function usePlayerLayout({ activeSection, hasTrack, enabled, packId = null }: {
  activeSection: CommunitySection;
  hasTrack: boolean;
  enabled: boolean;
  packId?: string | null;
}) {
  const [savedLayout] = useState(readPlayerLayout);
  const [minimized, setMinimized] = useState(savedLayout.minimized);
  const [placement, setPlacement] = useState(savedLayout.placement);
  const [opacity, setOpacity] = useState(savedLayout.opacity);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [collapsed, setCollapsed] = useState(false);
  const desktop = viewportWidth > 760;
  useEffect(() => { setCollapsed(false); }, [packId]);
  const playerRef = useRef<HTMLElement>(null);
  const [playerElement, setPlayerElement] = useState<HTMLElement | null>(null);
  const attachPlayer = useCallback((element: HTMLElement | null) => {
    playerRef.current = element;
    setPlayerElement(element);
  }, []);
  const wasFullscreen = useRef(false);
  const focusAfterOpening = useRef(false);
  const context = activeSection === "messenger" ? "messenger" : "other";
  const isMinimized = !desktop && (minimized[context] ?? true);
  const isHeader = !desktop && !isMinimized && placement[context] === "header";
  const isFullscreen = !desktop && !isMinimized && placement[context] === "fullscreen";
  const floating = useFloatingPlayerPosition(
    playerRef,
    enabled && isMinimized && hasTrack && Boolean(playerElement),
    expandAt,
    savedLayout.position,
  );
  const mobileEdgeDock = viewportWidth <= 760 && isMinimized
    && (floating.position === "left-edge" || floating.position === "right-edge")
    ? floating.position : null;
  const canAdjustOpacity = viewportWidth <= 760 && isMinimized && !floating.isDocked && !mobileEdgeDock;
  const positions: PlayerPositionMenuProps["positions"] = desktop
    ? ["footer"]
    : ["fullscreen", "header", "footer", "minimized", "left-edge", "right-edge"];
  const currentPosition: PlayerPositionMenuProps["current"] = !isMinimized
    ? (isFullscreen ? "fullscreen" : isHeader ? "header" : "footer")
    : mobileEdgeDock ?? (viewportWidth <= 760 ? "minimized" : !floating.isDocked ? "floating" : viewportWidth >= 1051 ? "sidebar" : "default");

  useEffect(() => {
    savePlayerLayout({ minimized, placement, position: floating.position, opacity });
  }, [minimized, placement, floating.position, opacity]);

  useLayoutEffect(() => {
    if (wasFullscreen.current && !isFullscreen) {
      playerRef.current?.querySelector<HTMLButtonElement>(".player-position-menu__trigger")?.focus();
    }
    wasFullscreen.current = isFullscreen;
  }, [isFullscreen, playerElement]);

  useLayoutEffect(() => {
    if (!mobileEdgeDock && focusAfterOpening.current) {
      focusAfterOpening.current = false;
      playerRef.current?.querySelector<HTMLButtonElement>(".audio-player__drag")?.focus();
    }
  }, [mobileEdgeDock, playerElement]);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useLayoutEffect(() => {
    const player = playerElement;
    const dashboard = player?.closest<HTMLElement>(".community-dashboard-template");
    if (!player || !dashboard) return;
    const workspace = desktop ? player.closest<HTMLElement>(".workspace-root") : null;
    const heightProperty = isMinimized ? "--measured-minimized-player-height" : "--measured-app-player-height";
    const headerSlot = isHeader ? dashboard.querySelector<HTMLElement>(".app-header-player-slot") : null;
    const updateHeight = () => {
      const height = `${player.getBoundingClientRect().height}px`;
      dashboard.style.setProperty(heightProperty, height);
      workspace?.style.setProperty("--workspace-footer-height", height);
      if (headerSlot) dashboard.style.setProperty("--header-player-top", `${headerSlot.getBoundingClientRect().top}px`);
    };
    updateHeight();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateHeight);
    observer?.observe(player);
    if (headerSlot) observer?.observe(headerSlot);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
      dashboard.style.removeProperty(heightProperty);
      dashboard.style.removeProperty("--header-player-top");
      workspace?.style.removeProperty("--workspace-footer-height");
    };
  }, [activeSection, desktop, isMinimized, isHeader, isFullscreen, collapsed, hasTrack, playerElement]);

  function expandAt(target: "header" | "footer" | "right-dock" | "fullscreen" | "window") {
    setPlacement((current) => ({ ...current, [context]: target }));
    setMinimized((current) => ({ ...current, [context]: false }));
  }

  function selectPosition(position: NonNullable<PlayerPositionMenuProps["current"]>) {
    if (desktop) return;
    if (position === "floating" || position === "minimized") {
      if (mobileEdgeDock) floating.reset();
      else if (!isMinimized || floating.isDocked) floating.popOut();
      setMinimized((current) => ({ ...current, [context]: true }));
    } else if (position === "header" || position === "footer" || position === "right-dock" || position === "fullscreen" || position === "window") {
      floating.dock();
      expandAt(position);
    } else if (position === "left-edge" || position === "right-edge") {
      floating.dockToEdge(position);
      setMinimized((current) => ({ ...current, [context]: true }));
    } else {
      floating.dock();
      setMinimized((current) => ({ ...current, [context]: true }));
    }
  }

  function changeMinimized(nextMinimized: boolean) {
    if (desktop) setCollapsed(nextMinimized);
    else {
      if (window.innerWidth <= 760 && nextMinimized && floating.isDocked) floating.reset();
      setMinimized((current) => ({ ...current, [context]: nextMinimized }));
    }
  }

  function openEdgeDock() {
    focusAfterOpening.current = true;
    floating.reset();
  }

  const dashboardClassName = [
    hasTrack && "community-dashboard-template--has-player",
    hasTrack && isMinimized && "community-dashboard-template--player-minimized",
    hasTrack && isMinimized && (floating.isDocked || (floating.isInitial && viewportWidth <= 760)) && "community-dashboard-template--player-docked",
    hasTrack && isHeader && "community-dashboard-template--player-header",
    hasTrack && desktop && collapsed && "community-dashboard-template--player-collapsed",
    hasTrack && isFullscreen && "community-dashboard-template--player-fullscreen",
  ].filter(Boolean).join(" ");
  const style: CSSProperties = desktop ? {} : { ...floating.style, opacity: canAdjustOpacity ? opacity / 100 : undefined };

  return {
    playerRef: attachPlayer, floating, isMinimized, isHeader, isFullscreen, mobileEdgeDock, dashboardClassName,
    positions, currentPosition, selectPosition, changeMinimized, openEdgeDock,
    desktop, collapsed: desktop && collapsed,
    opacityControl: canAdjustOpacity ? { value: opacity, onChange: setOpacity } : undefined,
    style,
  };
}

export type PlayerLayoutController = ReturnType<typeof usePlayerLayout>;
