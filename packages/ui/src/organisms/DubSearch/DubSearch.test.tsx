import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createEmptyDubSearchFilters, DubSearch, getDubSearchFilterCount } from "./DubSearch";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it("shows distinct audience tiles with descriptions and explicit selection states", () => {
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={vi.fn()} resultCount={12} />);
    expect(screen.getByText("12 dubs found")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const audience = screen.getByRole("group", { name: "Release audience" });
    for (const [label, variant, description, selected] of [
      ["Worldwide", "worldwide", "Open to the community", true],
      ["Private", "private", "Your own & shared with you", false],
      ["A-List", "alist", "Exclusive & public A-List releases", true],
    ] as const) {
      const checkbox = within(audience).getByRole("checkbox", { name: label });
      expect(checkbox).toHaveAccessibleDescription(description);
      expect(checkbox.closest("label")).toHaveClass(`dub-search__distribution--${variant}`);
      expect(checkbox.closest("label")?.querySelector("svg")).toBeInTheDocument();
      expect(within(checkbox.closest("label")!).getByText(selected ? "Included" : "Not included")).toBeVisible();
    }
    fireEvent.click(within(audience).getByRole("checkbox", { name: "Worldwide" }));
    fireEvent.click(within(audience).getByRole("checkbox", { name: "A-List" }));
    expect(screen.getByText("No audiences selected. This will return no results.")).toBeVisible();
    expect(screen.getByText("Unapplied changes")).toBeVisible();
  });

  it("clears search text without removing applied filters", () => {
    const onQueryChange = vi.fn();
    const onFiltersChange = vi.fn();
    const onSearch = vi.fn();
    render(<DubSearch query="Jungle" onQueryChange={onQueryChange} onSearch={onSearch}
      filters={{ ...createEmptyDubSearchFilters(), tags: ["Liquid"] }} onFiltersChange={onFiltersChange} resultCount={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search text" }));
    expect(onQueryChange).toHaveBeenCalledWith("");
    expect(onFiltersChange).not.toHaveBeenCalled();
    expect(onSearch).toHaveBeenCalledOnce();
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("resets draft choices to collection defaults without changing the query or applying", () => {
    const onQueryChange = vi.fn();
    const onFiltersChange = vi.fn();
    render(<DubSearch query="Night" onQueryChange={onQueryChange}
      filters={{ ...createEmptyDubSearchFilters(), tags: ["Jungle"], distributions: ["private"] }}
      defaultDistributions={["private", "worldwide", "alist"]} onFiltersChange={onFiltersChange} resultCount={1} />);
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reset choices" }));
    expect(screen.getByRole("button", { name: "Jungle" })).toHaveAttribute("aria-pressed", "false");
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).toBeChecked();
    expect(onQueryChange).not.toHaveBeenCalled();
    expect(onFiltersChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...createEmptyDubSearchFilters(), distributions: ["private", "worldwide", "alist"] });
  });

  it("does not mark reordered audience selections as unapplied changes", () => {
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={vi.fn()} resultCount={3} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Worldwide" }));
    expect(screen.getByText("Unapplied changes")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Worldwide" }));
    expect(screen.queryByText("Unapplied changes")).not.toBeInTheDocument();
  });

  it.each([
    ["Minimum BPM", "301", "BPM must be between 0 and 300."],
    ["Minimum Bitrate", "-1", "bitrate must be between 0 and 1000."],
  ])("blocks invalid %s values and explains how to fix them", (name, value, message) => {
    const onFiltersChange = vi.fn();
    const { container } = render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={onFiltersChange} resultCount={3} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const input = screen.getByRole("spinbutton", { name });
    fireEvent.change(input, { target: { value } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(message);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form")!);
    expect(onFiltersChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "100" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeEnabled();
  });

  it("keeps inverted ranges in the panel until corrected", () => {
    const onFiltersChange = vi.fn();
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={onFiltersChange} resultCount={3} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum BPM" }), { target: { value: "180" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum BPM" }), { target: { value: "170" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Minimum BPM must not exceed the maximum.");
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeDisabled();
    expect(onFiltersChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum BPM" }), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ minBpm: "180", maxBpm: "180" }));
    expect(screen.getByRole("button", { name: /Filters/ })).toHaveFocus();
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
    expect(screen.queryByRole("checkbox", { name: "Private" })).not.toBeInTheDocument();
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

  it("uses one search icon and exposes the active filter count accessibly", () => {
    const { container } = render(<DubSearch query="" onQueryChange={vi.fn()} filters={{ ...createEmptyDubSearchFilters(), tags: ["Jungle"] }} onFiltersChange={vi.fn()} resultCount={0} />);
    expect(container.querySelectorAll(".search-field svg")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Filters, 1 active" })).toHaveTextContent("1");
    expect(container.querySelector(".dub-search__toggle .button__icon svg")).toBeInTheDocument();
  });

  it("uses a mobile dialog, discards closed drafts, and applies filters", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const onFiltersChange = vi.fn();
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={onFiltersChange} resultCount={3} />);
    const toggle = screen.getByRole("button", { name: "Filters" });
    expect(toggle).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(toggle);
    const dialog = screen.getByRole("dialog", { name: "Filter dubs" });
    const apply = within(dialog).getByRole("button", { name: "Apply filters" });
    const footer = apply.closest("footer");
    expect(footer).toHaveClass("modal__footer");
    expect(footer).toContainElement(within(dialog).getByText("3 dubs found"));
    expect(apply).toHaveAttribute("form", dialog.querySelector("form")?.id);
    expect(dialog.querySelector(".modal__content")).not.toContainElement(apply);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Private" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(onFiltersChange).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(within(screen.getByRole("dialog")).getByRole("checkbox", { name: "Private" })).not.toBeChecked();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("checkbox", { name: "Private" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...createEmptyDubSearchFilters(), distributions: ["worldwide", "alist", "private"] });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the mobile footer count current and clears filters without submitting", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const onFiltersChange = vi.fn();
    const onQueryChange = vi.fn();
    const props = {
      query: "jungle",
      onQueryChange,
      filters: { ...createEmptyDubSearchFilters(), tags: ["Jungle"] },
      onFiltersChange,
      resultCount: 3,
    };
    const { rerender } = render(<DubSearch {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    const footer = screen.getByRole("button", { name: "Apply filters" }).closest("footer")!;
    rerender(<DubSearch {...props} isSearching />);
    expect(within(footer).getByText("Searching…")).toHaveAttribute("aria-live", "polite");
    rerender(<DubSearch {...props} resultCount={1} />);
    expect(within(footer).getByText("1 dub found")).toBeInTheDocument();
    fireEvent.click(within(footer).getByRole("button", { name: "Clear search" }));
    expect(onFiltersChange).toHaveBeenCalledOnce();
    expect(onFiltersChange).toHaveBeenCalledWith(createEmptyDubSearchFilters());
    expect(onQueryChange).toHaveBeenCalledWith("");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("removes individual applied filters without opening the panel and resets to collection defaults", () => {
    const onFiltersChange = vi.fn();
    const onQueryChange = vi.fn();
    const onSearch = vi.fn();
    const filters = {
      ...createEmptyDubSearchFilters(), tags: ["Liquid", "Jungle"], distributions: ["private" as const],
      minBpm: "170", maxBpm: "176", minBitrate: "128", fileType: "WAV",
    };
    render(<DubSearch query="Night" onQueryChange={onQueryChange} filters={filters}
      onFiltersChange={onFiltersChange} onSearch={onSearch}
      defaultDistributions={["private", "worldwide", "alist"]} resultCount={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Liquid filter" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...filters, tags: ["Jungle"] });
    fireEvent.click(screen.getByRole("button", { name: "Remove BPM: 170 - 176 filter" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...filters, minBpm: "", maxBpm: "" });
    fireEvent.click(screen.getByRole("button", { name: "Remove kbps: 128 - any filter" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...filters, minBitrate: "", maxBitrate: "" });
    fireEvent.click(screen.getByRole("button", { name: "Remove Format: WAV filter" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...filters, fileType: "" });
    fireEvent.click(screen.getByRole("button", { name: "Remove Distribution: Private filter" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...filters, distributions: ["private", "worldwide", "alist"] });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...createEmptyDubSearchFilters(), distributions: ["private", "worldwide", "alist"] });
    expect(onQueryChange).not.toHaveBeenCalled();
    expect(onSearch).toHaveBeenCalledTimes(6);
  });

  it("preserves the draft when switching between desktop and mobile layouts", () => {
    let mobile = false;
    let listener: (() => void) | undefined;
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: mobile,
      addEventListener: (_event: string, callback: () => void) => { listener = callback; },
      removeEventListener: vi.fn(),
    })));
    render(<DubSearch query="" onQueryChange={vi.fn()} filters={createEmptyDubSearchFilters()} onFiltersChange={vi.fn()} resultCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Private" }));
    act(() => { mobile = true; listener?.(); });
    expect(within(screen.getByRole("dialog", { name: "Filter dubs" })).getByRole("checkbox", { name: "Private" })).toBeChecked();
    act(() => { mobile = false; listener?.(); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Private" })).toBeChecked();
  });
});
