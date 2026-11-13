import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FloatingWindow, WindowLayer, type WindowWorkspace } from "./organisms/Window/Window";
import { useWindowWorkspace } from "../../../apps/web/src/hooks/useWindowWorkspace";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const saved: WindowWorkspace = {
  version: 1, playerTrackId: null, dockWidths: { ":left": 420 },
  windows: [{
    id: "pack:one", title: "Studio",
    frame: { placement: "left", position: { x: 90, y: 80 }, size: { width: 600, height: 480 } },
    restoreFrame: null, minimized: true, group: null, order: 0, dockOrder: 3,
  }],
};

it("restores stable names, docking, widths and minimized state, and reports subsequent changes", async () => {
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  const change = vi.fn();
  render(<WindowLayer initialWorkspace={saved} onWorkspaceChange={change}>
    <FloatingWindow windowId="pack:one" title="Original" active order={0} onActivate={vi.fn()} onClose={vi.fn()}>
      Draft
    </FloatingWindow>
  </WindowLayer>);
  expect(screen.getByRole("region", { name: "Minimized window: Studio" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Restore Studio", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "Studio" });
  expect(dialog).toHaveClass("floating-window--left");
  expect(dialog).not.toHaveClass("floating-window--minimized");
  expect(dialog.style.width).toBe("420px");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "floating" } });
  await waitFor(() => expect(change).toHaveBeenLastCalledWith(expect.objectContaining({
    windows: [expect.objectContaining({ id: "pack:one", title: "Studio", minimized: false,
      frame: expect.objectContaining({ placement: "floating", size: { width: 600, height: 480 } }) })],
  })));
});

it("debounces account saves, flushes before unload, and serializes writes", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const save = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; })).mockResolvedValue(undefined);
  const { result } = renderHook(() => useWindowWorkspace("one", saved, false, save, vi.fn()));
  expect(result.current.ready).toBe(true);
  act(() => { result.current.onChange(saved); result.current.onChange({ ...saved, windows: [] }); });
  await act(async () => { vi.advanceTimersByTime(600); });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith("one", { ...saved, windows: [] });
  act(() => { result.current.onChange(saved); window.dispatchEvent(new Event("pagehide")); });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { release(); await result.current.flush(); });
  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith("one", saved);
});

it("restores independent tab order and a stable group name rather than activation order", () => {
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  const workspace: WindowWorkspace = { ...saved, dockWidths: {}, windows: ["One", "Two", "Three"].map((id, order) => ({
    ...saved.windows[0], id: `pack:${id}`, title: id, order, minimized: false,
    frame: { placement: "floating", position: "initial", size: null },
    group: "studio", groupTitle: "Production", tabOrder: [2, 0, 1][order],
  })) };
  render(<WindowLayer initialWorkspace={workspace}>
    {workspace.windows.map((entry) => <FloatingWindow key={entry.id} windowId={entry.id} title="Original"
      active={entry.order === 2} order={entry.order} onActivate={vi.fn()} onClose={vi.fn()}>Draft</FloatingWindow>)}
  </WindowLayer>);
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Two", "Three", "One"]);
  expect(screen.getByRole("tab", { name: "Three", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("dialog", { name: "Three", exact: true }).querySelector(".floating-window__group-label")).toHaveTextContent("Production");
});

it("waits for account data, keeps snapshots stable during refresh, and does not mix accounts", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const { result, rerender } = renderHook(({ userId, snapshot, loading }) =>
    useWindowWorkspace(userId, snapshot, loading, save, vi.fn()), {
    initialProps: { userId: "one", snapshot: saved as WindowWorkspace | null, loading: true },
  });
  expect(result.current.ready).toBe(false);
  rerender({ userId: "one", snapshot: saved, loading: false });
  expect(result.current.initial).toEqual(saved);
  rerender({ userId: "one", snapshot: { ...saved, windows: [] }, loading: false });
  expect(result.current.initial).toEqual(saved);
  act(() => result.current.onChange(saved));
  rerender({ userId: "two", snapshot: null, loading: false });
  await act(async () => { await result.current.flush(); });
  expect(save).toHaveBeenCalledWith("one", saved);
  expect(result.current.initial).toBeNull();
  act(() => result.current.onChange({ ...saved, windows: [] }));
  await act(async () => { await result.current.flush(); });
  expect(save).toHaveBeenLastCalledWith("two", { ...saved, windows: [] });
});

it("reports failed saves without claiming success", async () => {
  const notify = vi.fn();
  const save = vi.fn().mockRejectedValue(new Error("Workspace save failed"));
  const { result } = renderHook(() => useWindowWorkspace("one", null, false, save, notify));
  act(() => result.current.onChange(saved));
  await act(async () => { await result.current.flush(); });
  expect(notify).toHaveBeenCalledWith("Workspace save failed", "error");
});
