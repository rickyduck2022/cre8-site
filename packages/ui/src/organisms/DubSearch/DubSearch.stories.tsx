import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { createEmptyDubSearchFilters, DubSearch, type DubSearchFilters } from "./DubSearch";

const meta = { title: "Organisms/DubSearch", component: DubSearch, parameters: { layout: "padded" } } satisfies Meta<typeof DubSearch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { query: "", onQueryChange: () => undefined, filters: createEmptyDubSearchFilters(), onFiltersChange: () => undefined, resultCount: 24, fileTypes: ["MP3", "WAV", "FLAC"] },
  render: () => {
    const [filters, setFilters] = useState<DubSearchFilters>(createEmptyDubSearchFilters());
    const [query, setQuery] = useState("");
    return <DubSearch query={query} onQueryChange={setQuery} filters={filters} onFiltersChange={setFilters} fileTypes={["MP3", "WAV", "FLAC"]} resultCount={24} />;
  },
};
