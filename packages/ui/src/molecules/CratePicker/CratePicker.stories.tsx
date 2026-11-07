import type { Meta, StoryObj } from "@storybook/react";
import { CratePicker } from "./CratePicker";

const meta = {
  title: "Molecules/CratePicker",
  component: CratePicker,
  args: {
    crates: [
      { id: "late-night", name: "Late-night weapons" },
      { id: "warm-up", name: "Warm-up selections" },
    ],
    onCancel: () => undefined,
    onSelect: () => undefined,
  },
} satisfies Meta<typeof CratePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { crates: [] },
};
