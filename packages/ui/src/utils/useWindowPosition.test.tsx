import { act, cleanup, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { clampWindowPosition, useWindowPosition, windowViewport } from "./useWindowPosition";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("uses the full workspace including its sidebar while preserving nested surface bounds", () => {
  const root = document.createElement("div"); root.className = "workspace-root";
  const stage = document.createElement("div"); stage.className = "workspace-stage";
  const element = document.createElement("section"); stage.append(element); root.append(stage);
  const bounds = (width: number, height: number) => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON() {} });
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue(bounds(1440, 900));
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue(bounds(1056, 900));
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(bounds(640, 480));
  expect(windowViewport(element).width).toBe(1440);
  expect(clampWindowPosition({ x: 800, y: 100 }, element)).toEqual({ x: 800, y: 100 });
  stage.className = "workspace-surface";
  expect(windowViewport(element).width).toBe(1056);
  expect(clampWindowPosition({ x: 800, y: 100 }, element)).toEqual({ x: 416, y: 100 });
});

it("shares pointer capture, cancellation and snap-on-release without moving other windows", () => {
  vi.stubGlobal("innerWidth", 900); vi.stubGlobal("innerHeight", 700);
  const element = document.createElement("section");
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 100, y: 100, left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300, toJSON() {},
  });
  const handle = document.createElement("button");
  handle.setPointerCapture = vi.fn();
  const pointer = (clientX: number, pointerId = 1) => ({
    pointerId, isPrimary: true, button: 0, clientX, clientY: 110, currentTarget: handle,
  } as PointerEvent<HTMLButtonElement>);
  const snap = vi.fn(() => null);
  const targets = (_element: HTMLElement, _position: unknown, x: number) => [{ kind: "right", active: x >= 868, style: { right: 0 } }];
  const ref = { current: element };
  const { result } = renderHook(() => useWindowPosition(ref, true, { targets, onSnap: snap }));
  act(() => result.current.onPointerDown(pointer(110)));
  expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
  act(() => result.current.onPointerMove(pointer(400, 2)));
  expect(result.current.position).toBe("initial");
  act(() => result.current.onPointerMove(pointer(400)));
  expect(result.current.position).toEqual({ x: 390, y: 100 });
  act(() => result.current.onPointerCancel(pointer(400)));
  expect(result.current.previews).toEqual([]);
  expect(snap).not.toHaveBeenCalled();
  act(() => result.current.onPointerDown(pointer(110)));
  act(() => result.current.onPointerMove(pointer(890)));
  expect(result.current.position).toEqual({ x: 500, y: 100 });
  expect(result.current.previews[0].active).toBe(true);
  expect(snap).not.toHaveBeenCalled();
  act(() => result.current.onPointerUp(pointer(890)));
  expect(snap).toHaveBeenCalledWith("right");
  expect(result.current.position).toBeNull();
  expect(result.current.previews).toEqual([]);
});
