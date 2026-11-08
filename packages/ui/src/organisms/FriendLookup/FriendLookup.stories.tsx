import type { Meta, StoryObj } from "@storybook/react";
import { FriendLookup } from "./FriendLookup";

const meta = {
  title: "Organisms/FriendLookup",
  component: FriendLookup,
  args: {
    query: "amber",
    results: [
      { id: "user-amber", artistId: "artist-amber", username: "amber", displayName: "Amber", genre: "Jungle" },
    ],
    onQueryChange: () => undefined,
    onAdd: () => undefined,
  },
} satisfies Meta<typeof FriendLookup>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Results: Story = {};
