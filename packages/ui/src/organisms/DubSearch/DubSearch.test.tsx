import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyDubSearchFilters, DubSearch, getDubSearchFilterCount } from "./DubSearch";

afterEach(cleanup);

describe("DubSearch", () => {
  it("exposes tag, BPM, format, and bitrate controls and updates filters", () => {
    const onFiltersChange = vi.fn();
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={onFiltersChange} fileTypes={["MP3", "WAV"]} resultCount={12} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Jungle" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum BPM" }), { target: { value: "170" } });
    fireEvent.change(screen.getByRole("combobox", { name: "File type" }), { target: { value: "WAV" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum Bitrate" }), { target: { value: "320" } });
    expect(onFiltersChange).toHaveBeenNthCalledWith(1, { ...createEmptyDubSearchFilters(), tags: ["Jungle"] });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...createEmptyDubSearchFilters(), fileType: "WAV" });
    expect(screen.getByText("12 dubs found")).toBeInTheDocument();
  });

  it("counts selected filter groups", () => {
    expect(getDubSearchFilterCount({ ...createEmptyDubSearchFilters(), tags: ["Jungle", "Liquid"], minBpm: "170", fileType: "WAV" })).toBe(4);
  });

  it("keeps search errors visible when the filter panel is collapsed", () => {
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={vi.fn()} resultCount={0} error="Adjust the BPM range." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Adjust the BPM range.");
  });
});
