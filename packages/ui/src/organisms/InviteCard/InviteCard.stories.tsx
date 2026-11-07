import type { Meta, StoryObj } from "@storybook/react";
import { InviteCard } from "./InviteCard";

const meta = {
  title: "Organisms/InviteCard",
  component: InviteCard,
} satisfies Meta<typeof InviteCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: {
    title: "Grow your circle.",
    description: "Invite a friend and share your next favorite track.",
    actionLabel: "Invite",
  },
};
