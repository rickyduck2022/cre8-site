import type { Meta, StoryObj } from "@storybook/react";
import { SearchField } from "./SearchField";

const meta = {
  title: "Molecules/SearchField",
  component: SearchField,
  args: { placeholder: "Search artists, dubs, or genres", shortcut: "? K" },
} satisfies Meta<typeof SearchField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
