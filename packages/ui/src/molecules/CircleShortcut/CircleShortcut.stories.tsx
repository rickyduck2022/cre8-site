import type { Meta, StoryObj } from "@storybook/react";
import { CircleShortcut } from "./CircleShortcut";

const meta = {
  title: "Molecules/CircleShortcut",
  component: CircleShortcut,
  args: { name: "Your circle", members: ["Evan", "Serena"] },
} satisfies Meta<typeof CircleShortcut>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
