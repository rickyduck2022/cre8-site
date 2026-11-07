import type { Meta, StoryObj } from "@storybook/react";
import { FeedControls } from "./FeedControls";

const meta = {
  title: "Molecules/FeedControls",
  component: FeedControls,
  args: {},
} satisfies Meta<typeof FeedControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
