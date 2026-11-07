import type { Meta, StoryObj } from "@storybook/react";
import { FilterTab } from "./FilterTab";

const meta = {
  title: "Atoms/FilterTab",
  component: FilterTab,
  args: {
    children: "Add dub",
    active: true,
  },
} satisfies Meta<typeof FilterTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};

export const Filters: Story = {
  render: () => (
    <div role="tablist" aria-label="Track filters" style={{ display: "flex", gap: 8 }}>
      <FilterTab active>Add dub</FilterTab>
      <FilterTab>Not played yet</FilterTab>
      <FilterTab>Recently played</FilterTab>
    </div>
  ),
};
