import type { Meta, StoryObj } from "@storybook/react";
import { SuggestedFriend } from "./SuggestedFriend";

const meta = {
  title: "Molecules/SuggestedFriend",
  component: SuggestedFriend,
  args: { name: "Q2B", detail: "Friends you may know" },
} satisfies Meta<typeof SuggestedFriend>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
