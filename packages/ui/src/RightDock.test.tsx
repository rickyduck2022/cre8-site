import { act, cleanup, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useFloatingPlayerPosition } from "../../../apps/web/src/hooks/useFloatingPlayerPosition";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([1440, 900])("offers right-edge drag docking only at desktop width (%i)", (width) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", 900);
  const dashboard = document.createElement("main");
  dashboard.className = "community-dashboard-template";
  dashboard.innerHTML = '<div class="dashboard-template__body"></div><section class="app-player"></section>';
  const player = dashboard.querySelector<HTMLElement>(".app-player")!;
  const body = dashboard.querySelector<HTMLElement>(".dashboard-template__body")!;
  vi.spyOn(body, "getBoundingClientRect").mockReturnValue({ left: 240, right: width, top: 100, bottom: 900, width: width - 240, height: 800 } as DOMRect);
  vi.spyOn(player, "getBoundingClientRect").mockReturnValue({ left: 300, right: 684, top: 200, bottom: 400, width: 384, height: 200 } as DOMRect);
  const onSnap = vi.fn();
  const playerRef = { current: player };
  const { result } = renderHook(() => useFloatingPlayerPosition(playerRef, true, onSnap));
  const button = document.createElement("button");
  button.setPointerCapture = vi.fn();
  function pointer(clientX: number) {
    return { pointerId: 1, button: 0, isPrimary: true, clientX, clientY: 210, currentTarget: button } as PointerEvent<HTMLButtonElement>;
  }
  act(() => result.current.onPointerDown(pointer(310)));
  act(() => result.current.onPointerMove(pointer(width - 10)));
  const preview = result.current.previews.find(({ kind }) => kind === "right-dock");
  if (width >= 1051) {
    expect(preview).toMatchObject({ active: true, style: { top: 100, height: 800 }, previewStyle: { width: "var(--app-player-right-width)" } });
  } else {
    expect(preview).toBeUndefined();
  }
  act(() => result.current.onPointerUp(pointer(width - 10)));
  expect(result.current.previews).toEqual([]);
  if (width >= 1051) expect(onSnap).toHaveBeenCalledWith("right-dock");
  else expect(onSnap).not.toHaveBeenCalled();
});
