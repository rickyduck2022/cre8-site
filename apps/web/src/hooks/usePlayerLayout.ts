import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { PlayerPositionMenuProps } from "@craft/ui";
import type { CommunitySection } from "../types/community";
import { readPlayerLayout, savePlayerLayout } from "./playerLayoutStorage";
import { useFloatingPlayerPosition } from "./useFloatingPlayerPosition";

export function usePlayerLayout({ activeSection, hasTrack, enabled }: {
  activeSection: CommunitySection;
  hasTrack: boolean;
  enabled: boolean;
}) {
  const [savedLayout] = useState(readPlayerLayout);
  const [minimized, setMinimized] = useState(savedLayout.minimized);
  const [placement, setPlacement] = useState(savedLayout.placement);
  const [opacity, setOpacity] = useState(savedLayout.opacity);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const playerRef = useRef<HTMLElement>(null);
  const wasFullscreen = useRef(false);
  const focusAfterOpening = useRef(false);
  const context = activeSection === "messenger" ? "messenger" : "other";
  const isMinimized = minimized[context] ?? true;
  const isHeader = !isMinimized && placement[context] === "header";
  const isFullscreen = !isMinimized && placement[context] === "fullscreen";
  const isRightDock = !isMinimized && placement[context] === "right-dock" && viewportWidth >= 1051;
  const floating = useFloatingPlayerPosition(
    playerRef,
    enabled && isMinimized && hasTrack,
    expandAt,
    savedLayout.position,
  );
  const mobileEdgeDock = viewportWidth <= 760 && isMinimized
    && (floating.position === "left-edge" || floating.position === "right-edge")
    ? floating.position : null;
  const canAdjustOpacity = viewportWidth <= 760 && isMinimized && !floating.isDocked && !mobileEdgeDock;
  const popsOutOnMinimize = viewportWidth > 760 && (!isMinimized || (floating.isDocked && viewportWidth >= 1051));
  const positions: PlayerPositionMenuProps["positions"] = viewportWidth >= 1051
    ? ["fullscreen", "header", "footer", "sidebar", "right-dock", "floating"]
    : viewportWidth > 760
      ? ["fullscreen", "header", "footer", "default", "floating"]
      : ["fullscreen", "header", "footer", "minimized", "left-edge", "right-edge"];
  const currentPosition: PlayerPositionMenuProps["current"] = !isMinimized
    ? (isFullscreen ? "fullscreen" : isRightDock ? "right-dock" : isHeader ? "header" : "footer")
    : mobileEdgeDock ?? (viewportWidth <= 760 ? "minimized" : !floating.isDocked ? "floating" : viewportWidth >= 1051 ? "sidebar" : "default");

  useEffect(() => {
    savePlayerLayout({ minimized, placement, position: floating.position, opacity });
  }, [minimized, placement, floating.position, opacity]);

  useLayoutEffect(() => {
    if (wasFullscreen.current && !isFullscreen) {
      playerRef.current?.querySelector<HTMLButtonElement>(".player-position-menu__trigger")?.focus();
    }
    wasFullscreen.current = isFullscreen;
  }, [isFullscreen]);

  useLayoutEffect(() => {
    if (!mobileEdgeDock && focusAfterOpening.current) {
      focusAfterOpening.current = false;
      playerRef.current?.querySelector<HTMLButtonElement>(".audio-player__drag")?.focus();
    }
  }, [mobileEdgeDock]);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useLayoutEffect(() => {
    const player = playerRef.current;
    const dashboard = player?.closest<HTMLElement>(".community-dashboard-template");
    if (!player || !dashboard) return;
    const heightProperty = isMinimized ? "--measured-minimized-player-height" : "--measured-app-player-height";
    const headerSlot = isHeader ? dashboard.querySelector<HTMLElement>(".app-header-player-slot") : null;
    const updateHeight = () => {
      dashboard.style.setProperty(heightProperty, `${player.getBoundingClientRect().height}px`);
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
    };
  }, [activeSection, isMinimized, isHeader, isFullscreen, hasTrack]);

  function expandAt(target: "header" | "footer" | "right-dock" | "fullscreen") {
    setPlacement((current) => ({ ...current, [context]: target }));
    setMinimized((current) => ({ ...current, [context]: false }));
  }

  function selectPosition(position: NonNullable<PlayerPositionMenuProps["current"]>) {
    if (position === "floating" || position === "minimized") {
      if (mobileEdgeDock) floating.reset();
      else if (!isMinimized || floating.isDocked) floating.popOut();
      setMinimized((current) => ({ ...current, [context]: true }));
    } else if (position === "header" || position === "footer" || position === "right-dock" || position === "fullscreen") {
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
    if (window.innerWidth > 760 && (!isMinimized || (floating.isDocked && window.innerWidth >= 1051))) {
      floating.popOut();
      setMinimized((current) => ({ ...current, [context]: true }));
    } else {
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
    hasTrack && isRightDock && "community-dashboard-template--player-right",
    hasTrack && isFullscreen && "community-dashboard-template--player-fullscreen",
  ].filter(Boolean).join(" ");
  const style: CSSProperties = { ...floating.style, opacity: canAdjustOpacity ? opacity / 100 : undefined };

  return {
    playerRef, floating, isMinimized, isHeader, isFullscreen, mobileEdgeDock, dashboardClassName,
    popsOutOnMinimize, positions, currentPosition, selectPosition, changeMinimized, openEdgeDock,
    opacityControl: canAdjustOpacity ? { value: opacity, onChange: setOpacity } : undefined,
    style,
  };
}

export type PlayerLayoutController = ReturnType<typeof usePlayerLayout>;
