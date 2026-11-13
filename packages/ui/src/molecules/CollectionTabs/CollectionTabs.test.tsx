import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { CollectionTabs } from "./CollectionTabs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

afterEach(cleanup);

it("reorders with pointer or Alt+arrows without selecting, and ignores cancelled drags", () => {
  const onReorder = vi.fn();
  const onSelect = vi.fn();
  render(<CollectionTabs label="Windows" selectedId="one" onSelect={onSelect} onReorder={onReorder}
    tabs={["one", "two", "three"].map((id) => ({ id, label: id, panelId: id + "-panel" }))} />);
  const tabs = screen.getAllByRole("tab");
  const bounds = { x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 40, width: 300, height: 40, toJSON() {} };
  vi.spyOn(screen.getByRole("tablist"), "getBoundingClientRect").mockReturnValue(bounds);
  tabs.forEach((tab, index) => {
    vi.spyOn(tab, "getBoundingClientRect").mockReturnValue({ ...bounds, left: index * 100, right: (index + 1) * 100, width: 100 });
    tab.setPointerCapture = vi.fn();
  });
  fireEvent.keyDown(tabs[0], { key: "ArrowRight", altKey: true });
  expect(onReorder).toHaveBeenLastCalledWith(["two", "one", "three"]);
  const pointer = (type: string, x: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 20 });
    Object.defineProperties(event, { pointerId: { value: 3 }, isPrimary: { value: true } });
    fireEvent(tabs[0], event);
  };
  pointer("pointerdown", 50); pointer("pointermove", 250); pointer("pointercancel", 250);
  expect(onReorder).toHaveBeenCalledTimes(1);
  pointer("pointerdown", 50); pointer("pointermove", 250); pointer("pointerup", 250);
  expect(onReorder).toHaveBeenLastCalledWith(["two", "three", "one"]);
  fireEvent.click(tabs[0]);
  expect(onSelect).not.toHaveBeenCalled();
});

it("gives feature-dialog tabs their neutral design-system identifier even in mixed groups", () => {
  render(<CollectionTabs label="Windows" selectedId="dialog" onSelect={vi.fn()} tabs={[
    { id: "dialog", label: "Edit profile", panelId: "profile", kind: "dialog" },
    { id: "pack", label: "Pack", panelId: "pack-panel", kind: "sample" },
    { id: "member", label: "Member", panelId: "member-panel", kind: "profile" },
  ]} />);
  expect(screen.getByRole("tab", { name: "Edit profile" })).toHaveClass("window-kind--dialog");
  expect(screen.getByRole("tab", { name: "Pack" })).toHaveClass("media-kind--sample");
  expect(screen.getByRole("tab", { name: "Member" })).toHaveClass("window-kind--dialog");
});

it("uses the site-wide Now playing audio badge on playing tabs", () => {
  render(<CollectionTabs label="Windows" selectedId="one" onSelect={vi.fn()}
    tabs={[{ id: "one", label: "Pack", panelId: "pack", isPlaying: true }]} />);
  expect(screen.getByRole("status", { name: "Now playing" })).toHaveClass("badge--audio");
  expect(screen.getByRole("status", { name: "Now playing" }).querySelector(".badge__dot")).toBeInTheDocument();
});

it("keeps the tab-strip background transparent without removing individual tab states", () => {
  const css = readFileSync(resolve("src", "molecules", "CollectionTabs", "CollectionTabs.css"), "utf8");
  const strip = css.match(/\.collection-tabs\s*\{([^}]+)\}/)?.[1];
  expect(strip).toContain("background: transparent;");
  expect(strip).not.toContain("var(--window-header)");
  expect(css).toContain("background: var(--window-tab-surface)");
  expect(css).toContain("background: var(--window-tab-selected)");
});
it("colors tabs per media kind and tears a dragged tab out of the strip", () => {
  const onTearOut = vi.fn();
  const onSelect = vi.fn();
  const { rerender } = render(<CollectionTabs label="Grouped packs" selectedId="a" onSelect={onSelect} onTearOut={onTearOut}
    tabs={[{ id: "a", label: "Dub pack", panelId: "p1", kind: "dub" }, { id: "b", label: "Sample pack", panelId: "p2", kind: "sample" }]} />);
  expect(screen.getByRole("tablist")).not.toHaveClass("media-kind--dub");
  expect(screen.getByRole("tablist")).not.toHaveClass("media-kind--sample");
  expect(screen.getByRole("tab", { name: "Dub pack" })).toHaveClass("media-kind--dub");
  const sample = screen.getByRole("tab", { name: "Sample pack" });
  expect(sample).toHaveClass("media-kind--sample");
  sample.setPointerCapture = vi.fn();
  const pointer = (type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 3 }, isPrimary: { value: true } });
    fireEvent(sample, event);
  };
  pointer("pointerdown", 0, 0);
  pointer("pointermove", 120, 90);
  expect(document.querySelector(".collection-tabs__ghost")).toHaveTextContent("Sample pack");
  pointer("pointerup", 120, 90);
  expect(document.querySelector(".collection-tabs__ghost")).not.toBeInTheDocument();
  expect(onTearOut).toHaveBeenCalledWith("b", { x: 120, y: 90 });
  fireEvent.click(sample);
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(sample);
  expect(onSelect).toHaveBeenCalledWith("b");
  rerender(<CollectionTabs label="Grouped packs" selectedId="a" onSelect={onSelect}
    tabs={[{ id: "a", label: "Dub pack", panelId: "p1", kind: "dub" }, { id: "b", label: "Dub two", panelId: "p2", kind: "dub" }]} />);
  expect(screen.getByRole("tablist")).toHaveClass("media-kind--dub");
});

it("shares raised collection styling and supports automatic selection with roving keyboard focus", () => {
  function Tabs() {
    const [selected, setSelected] = useState("files");
    return <CollectionTabs label="Collection view" selectedId={selected} onSelect={setSelected}
      tabs={[{ id: "files", label: "Dubs", panelId: "results" }, { id: "packs", label: "Packs", panelId: "results" }]} />;
  }
  render(<Tabs />);
  const files = screen.getByRole("tab", { name: "Dubs" });
  const packs = screen.getByRole("tab", { name: "Packs" });
  expect(screen.getByRole("tablist")).toHaveClass("collection-tabs");
  expect(files).toHaveAttribute("tabindex", "0");
  expect(packs).toHaveAttribute("tabindex", "-1");
  fireEvent.keyDown(files, { key: "ArrowLeft" });
  expect(packs).toHaveFocus();
  expect(packs).toHaveAttribute("aria-selected", "true");
  expect(packs).toHaveAttribute("aria-controls", "results");
  fireEvent.keyDown(packs, { key: "ArrowRight" });
  expect(files).toHaveFocus();
  fireEvent.keyDown(files, { key: "End" });
  expect(packs).toHaveFocus();
  fireEvent.keyDown(packs, { key: "Home" });
  expect(files).toHaveFocus();
  fireEvent.click(packs);
  expect(packs).toHaveAttribute("aria-selected", "true");
});
