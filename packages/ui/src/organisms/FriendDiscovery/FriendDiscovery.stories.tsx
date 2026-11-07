import type { Meta, StoryObj } from "@storybook/react";
import { FriendDiscovery } from "./FriendDiscovery";

const meta = {
  title: "Organisms/FriendDiscovery",
  component: FriendDiscovery,
  args: {
    friends: [
      { name: "Dickey", detail: "Shared music taste" },
      { name: "Kaskade", detail: "3 mutual friends" },
      { name: "Hek", detail: "On the same frequency" },
    ],
  },
} satisfies Meta<typeof FriendDiscovery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
