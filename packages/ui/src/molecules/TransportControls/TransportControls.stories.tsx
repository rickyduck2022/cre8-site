import type { Meta, StoryObj } from "@storybook/react";
import { TransportControls } from "./TransportControls";

const meta = {
  title: "Molecules/TransportControls",
  component: TransportControls,
  args: { playing: false },
} satisfies Meta<typeof TransportControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
