import type { Meta, StoryObj } from "@storybook/react";
import { FriendRequest } from "./FriendRequest";

const meta = {
  title: "Molecules/FriendRequest",
  component: FriendRequest,
  args: { name: "Evan", detail: "Friend request" },
} satisfies Meta<typeof FriendRequest>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
