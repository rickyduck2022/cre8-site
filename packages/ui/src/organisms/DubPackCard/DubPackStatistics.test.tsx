import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { DubPack } from "../../types/domain";
import { DubPackStatistics } from "./DubPackStatistics";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

afterEach(cleanup);

const pack: DubPack = {
  id: "pack", title: "Test release", kind: "dub", status: "published", distribution: "worldwide",
  aListPublic: false, licence: "", description: "", ownerUsername: "artist", ownerDisplayName: "Artist",
  createdAt: "", updatedAt: "", totalBytes: 0, zipDownloads: 2,
  items: [3, 5].map((downloads, index) => ({ dub: {
    id: String(index), title: `Track ${index + 1}`, artist: "Artist", uploader: "artist", uploaderDisplayName: "Artist",
    uploadedAt: "", genre: "", duration: "", bpm: 0, likes: 0, downloads, artwork: "", message: "",
  } })),
};

it("shows ZIP requests separately from aggregate and individual file requests", () => {
  render(<DubPackStatistics pack={pack} />);
  expect(screen.getByText("Whole-pack ZIP downloads").nextElementSibling).toHaveTextContent("2");
  expect(screen.getByText("Total file downloads").nextElementSibling).toHaveTextContent("8");
  expect(within(screen.getByRole("row", { name: "Track 1 3" })).getByRole("cell")).toHaveTextContent("3");
  expect(within(screen.getByRole("row", { name: "Track 2 5" })).getByRole("cell")).toHaveTextContent("5");
  expect(screen.getByText(/File counts include ZIP downloads/)).toBeVisible();
});

it("distinguishes unavailable ZIP data from a known zero and handles empty sample drafts", () => {
  const { rerender } = render(<DubPackStatistics pack={{ ...pack, zipDownloads: undefined }} />);
  expect(screen.getByText("Unavailable")).toBeVisible();
  rerender(<DubPackStatistics pack={{ ...pack, kind: "sample", zipDownloads: 0, items: [] }} />);
  expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
  expect(screen.getByText("Whole-pack ZIP downloads").nextElementSibling).toHaveTextContent("0");
  expect(screen.getByText("Total file downloads").nextElementSibling).toHaveTextContent("0");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("uses the shared A-List distribution roles instead of sample green for A-List statistics", () => {
  render(<DubPackStatistics pack={{ ...pack, kind: "sample", distribution: "alist" }} />);
  expect(screen.getByRole("region")).toHaveClass("media-kind--sample", "dub-pack-statistics--alist");
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src", "foundations", "DistributionSurfaces.css"), "utf8");
  document.head.append(style);
  try {
    const rule = Array.from(style.sheet!.cssRules).find((candidate) =>
      candidate instanceof CSSStyleRule && candidate.selectorText.split(",").some((selector) => selector.trim() === ".dub-pack-statistics--alist"),
    );
    if (!(rule instanceof CSSStyleRule)) throw new Error("Missing shared A-List statistics palette.");
    expect(rule.style.getPropertyValue("--audio-active")).toBe("var(--release-alist-accent)");
    expect(rule.style.getPropertyValue("--surface-media-section")).toBe("var(--release-alist-media-surface)");
  } finally {
    style.remove();
  }
});
