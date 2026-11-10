import { act, cleanup, renderHook } from "@testing-library/react";
import type { KeyboardEvent, PointerEvent } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useWindowResize } from "./useWindowResize";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup(mode: "floating" | "left" | "right" | "fullscreen" = "floating") {
  vi.stubGlobal("innerWidth", 900); vi.stubGlobal("innerHeight", 700);
  const element = document.createElement("section");
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 100, y: 80, left: 100, top: 80, right: 700, bottom: 580, width: 600, height: 500, toJSON() {},
  });
  const handle = document.createElement("button");
  handle.setPointerCapture = vi.fn();
  const pointer = (clientX = 700, clientY = 580, pointerId = 1) => ({
    pointerId, isPrimary: true, button: 0, clientX, clientY, currentTarget: handle, preventDefault: vi.fn(),
  } as PointerEvent<HTMLButtonElement>);
  const key = (key: string, shiftKey = false) => ({ key, shiftKey, preventDefault: vi.fn() } as KeyboardEvent<HTMLButtonElement>);
  const onPosition = vi.fn();
  const ref = { current: element };
  const hook = renderHook(({ enabled, mode }) => useWindowResize(ref, enabled, mode, onPosition), { initialProps: { enabled: true, mode } });
  return { ...hook, handle, pointer, key, onPosition };
}

it("resizes through pointer capture, ignores other pointers and stops on cancellation or capture loss", () => {
  const { result, handle, pointer, onPosition } = setup();
  act(() => result.current.onPointerDown(pointer()));
  expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
  expect(onPosition).toHaveBeenCalledWith({ x: 100, y: 80 });
  expect(result.current.resizing).toBe(true);
  act(() => result.current.onPointerMove(pointer(760, 620, 2)));
  expect(result.current.size).toBeNull();
  act(() => result.current.onPointerMove(pointer(760, 620)));
  expect(result.current.size).toEqual({ width: 660, height: 540 });
  act(() => result.current.onPointerCancel(pointer()));
  act(() => result.current.onPointerMove(pointer(800, 640)));
  expect(result.current.size).toEqual({ width: 660, height: 540 });
  expect(result.current.resizing).toBe(false);
  act(() => result.current.onPointerDown(pointer()));
  act(() => result.current.onLostPointerCapture(pointer()));
  expect(result.current.resizing).toBe(false);
});

it("enforces minimum size and available viewport space at the current position", () => {
  const { result, pointer } = setup();
  act(() => result.current.onPointerDown(pointer()));
  act(() => result.current.onPointerMove(pointer(-1000, -1000)));
  expect(result.current.size).toEqual({ width: 360, height: 240 });
  act(() => result.current.onPointerMove(pointer(9000, 9000)));
  expect(result.current.size).toEqual({ width: 792, height: 612 });
  act(() => result.current.onPointerUp(pointer()));
  expect(result.current.resizing).toBe(false);
});

it("supports keyboard resize, larger steps and reset without resizing disabled or fullscreen windows", () => {
  const { result, key, rerender, pointer } = setup();
  act(() => result.current.onKeyDown(key("ArrowRight")));
  expect(result.current.size).toEqual({ width: 616, height: 500 });
  act(() => result.current.onKeyDown(key("ArrowDown", true)));
  expect(result.current.size).toEqual({ width: 600, height: 564 });
  act(() => result.current.onKeyDown(key("Home")));
  expect(result.current.size).toBeNull();
  rerender({ enabled: false, mode: "floating" });
  act(() => result.current.onKeyDown(key("ArrowRight")));
  act(() => result.current.onPointerDown(pointer()));
  expect(result.current.resizing).toBe(false);
  expect(result.current.size).toBeNull();
  rerender({ enabled: true, mode: "fullscreen" });
  act(() => result.current.onKeyDown(key("ArrowRight")));
  act(() => result.current.onPointerDown(pointer()));
  expect(result.current.size).toBeNull();
});

it("resizes docks from their inner edge and retains independent floating dimensions", () => {
  const { result, pointer, key, rerender } = setup();
  act(() => result.current.onKeyDown(key("ArrowRight")));
  const floating = result.current.size;
  rerender({ enabled: true, mode: "right" });
  act(() => result.current.onPointerDown(pointer()));
  act(() => result.current.onPointerMove(pointer(600, 580)));
  expect(result.current.dockWidth).toBe(700);
  expect(result.current.size).toEqual(floating);
  rerender({ enabled: true, mode: "left" });
  act(() => result.current.onPointerDown(pointer()));
  act(() => result.current.onPointerMove(pointer(780, 580)));
  expect(result.current.dockWidth).toBe(680);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(result.current.resizing).toBe(false);
  act(() => result.current.onKeyDown(key("Home")));
  expect(result.current.dockWidth).toBeNull();
  expect(result.current.size).toEqual(floating);
});
