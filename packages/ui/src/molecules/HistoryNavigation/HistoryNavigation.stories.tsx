import type { Meta, StoryObj } from "@storybook/react";
import { HistoryNavigation } from "./HistoryNavigation";

const meta = {
  title: "Molecules/HistoryNavigation",
  component: HistoryNavigation,
  args: {
    canGoBack: true,
    onBack: () => undefined,
  },
} satisfies Meta<typeof HistoryNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Unavailable: Story = { args: { canGoBack: false } };
