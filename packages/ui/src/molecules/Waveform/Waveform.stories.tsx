import type { Meta, StoryObj } from "@storybook/react";
import { Waveform } from "./Waveform";

const meta = {
  title: "Molecules/Waveform",
  component: Waveform,
  args: { label: "Preview waveform", progress: 0.58 },
} satisfies Meta<typeof Waveform>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
