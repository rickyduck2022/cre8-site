import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyDubSearchFilters, DubSearch, getDubSearchFilterCount } from "./DubSearch";

afterEach(cleanup);

describe("DubSearch", () => {
  it("applies selected distribution, tag, BPM, format, and bitrate filters only on submit", () => {
    const onFiltersChange = vi.fn();
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={onFiltersChange} fileTypes={["MP3", "WAV"]} resultCount={12} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("checkbox", { name: "Worldwide" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "A-List" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Private" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Private" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Worldwide" }));
    fireEvent.click(screen.getByRole("button", { name: "Jungle" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum BPM" }), { target: { value: "170" } });
    fireEvent.change(screen.getByRole("combobox", { name: "File type" }), { target: { value: "WAV" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum Bitrate" }), { target: { value: "320" } });
    expect(screen.getByText("12 dubs found")).toBeInTheDocument();
    expect(onFiltersChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onFiltersChange).toHaveBeenCalledOnce();
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...createEmptyDubSearchFilters(),
      distributions: ["alist", "private"],
      tags: ["Jungle"], minBpm: "170", fileType: "WAV", maxBitrate: "320",
    });
    expect(screen.queryByRole("checkbox", { name: "Private" })).not.toBeInTheDocument();
  });

  it("counts selected filter groups", () => {
    expect(getDubSearchFilterCount(createEmptyDubSearchFilters())).toBe(0);
    expect(getDubSearchFilterCount({ ...createEmptyDubSearchFilters(), distributions: ["alist", "worldwide"] })).toBe(0);
    expect(getDubSearchFilterCount({ ...createEmptyDubSearchFilters(), distributions: [] })).toBe(1);
    expect(getDubSearchFilterCount({ ...createEmptyDubSearchFilters(), distributions: ["private", "alist"], tags: ["Jungle", "Liquid"], minBpm: "170", fileType: "WAV" })).toBe(5);
  });

  it("discards unsaved edits when the panel is closed and reopened", () => {
    const onFiltersChange = vi.fn();
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={onFiltersChange} resultCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Private" }));
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("checkbox", { name: "Private" })).not.toBeChecked();
    expect(onFiltersChange).not.toHaveBeenCalled();
  });

  it("clears applied and pending filters and the query", () => {
    const onFiltersChange = vi.fn();
    const onQueryChange = vi.fn();
    render(<DubSearch query="jungle" onQueryChange={onQueryChange} filters={{ ...createEmptyDubSearchFilters(), distributions: ["private"] }} onFiltersChange={onFiltersChange} resultCount={1} />);
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Worldwide" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onQueryChange).toHaveBeenCalledWith("");
    expect(onFiltersChange).toHaveBeenCalledWith(createEmptyDubSearchFilters());
    expect(screen.getByRole("checkbox", { name: "Private" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Worldwide" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "A-List" })).toBeChecked();
  });

  it("can hide distribution choices for a fixed-distribution feed", () => {
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={vi.fn()} resultCount={0} showDistributionFilter={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.queryByRole("checkbox", { name: "Private" })).not.toBeInTheDocument();
  });

  it("keeps search errors visible when the filter panel is collapsed", () => {
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={vi.fn()} resultCount={0} error="Adjust the BPM range." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Adjust the BPM range.");
  });
});
