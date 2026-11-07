import type { Meta, StoryObj } from "@storybook/react";
import { ShareEntry } from "./ShareEntry";

const meta = {
  title: "Molecules/ShareEntry",
  component: ShareEntry,
  args: { name: "Sam Rivera" },
} satisfies Meta<typeof ShareEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
