import type { Meta, StoryObj } from "@storybook/react";
import { ShareDubDialog } from "./ShareDubDialog";

const meta = {
  title: "Organisms/ShareDubDialog",
  component: ShareDubDialog,
  args: {
    dub: {
      id: "dub-1", title: "Night Drive", artist: "Amber", uploader: "amber",
      uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00Z", bpm: 174,
      genre: "Jungle", duration: "03:30", likes: 0, downloads: 0,
      artwork: "whitelabel", message: "", distribution: "private",
    },
    buddies: [
      { id: "friend-1", username: "meladee", displayName: "Meladee", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] },
      { id: "friend-2", username: "holik", displayName: "Holik", presence: "offline", genre: "Jungle", role: "DJ", bio: "", groups: [] },
    ],
    onClose: () => undefined,
    onFindFriends: () => undefined,
    onOpenChat: () => undefined,
    onSendMessage: async () => true,
  },
} satisfies Meta<typeof ShareDubDialog>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const NoFriends: Story = { args: { buddies: [] } };
