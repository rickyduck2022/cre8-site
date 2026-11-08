import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { FriendPicker } from "./FriendPicker";

const meta = {
  title: "Molecules/FriendPicker",
  component: FriendPicker,
  args: {
    buddies: [
      { id: "friend-1", username: "meladee", displayName: "Meladee", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] },
      { id: "friend-2", username: "holik", displayName: "Holik", presence: "offline", genre: "Jungle", role: "DJ", bio: "", groups: [] },
    ],
    selectedIds: [],
    onChange: () => undefined,
  },
  render: (args) => {
    const [selectedIds, setSelectedIds] = useState(args.selectedIds);
    return <FriendPicker {...args} selectedIds={selectedIds} onChange={setSelectedIds} />;
  },
} satisfies Meta<typeof FriendPicker>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const NoFriends: Story = { args: { buddies: [] } };
export const AlreadyShared: Story = { args: { sharedIds: ["friend-1"] } };
