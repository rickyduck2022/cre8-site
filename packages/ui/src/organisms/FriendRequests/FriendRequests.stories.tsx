import type { Meta, StoryObj } from "@storybook/react";
import { FriendRequests } from "./FriendRequests";

const meta = {
  title: "Organisms/FriendRequests",
  component: FriendRequests,
  args: {
    description: "People who want to join your circle.",
    requests: [
      { name: "Serena", detail: "2 mutual friends" },
      { name: "Malaa", detail: "Friend request" },
      { name: "Hek", detail: "3 mutual friends" },
    ],
  },
} satisfies Meta<typeof FriendRequests>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
