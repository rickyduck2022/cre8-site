import type { Meta } from "@storybook/react";
import { BuddyListTemplate } from "./BuddyListTemplate";
import type { Buddy } from "../communityTypes";

const buddies = [
  {
    id: "evan",
    username: "evan.wav",
    displayName: "Evan",
    presence: "online",
    genre: "House, Garage",
    role: "Producer",
    bio: "Making warm sounds for small rooms.",
    groups: ["Friends"],
    unread: 2,
  },
  {
    id: "serena",
    username: "serena",
    displayName: "Serena",
    presence: "away",
    genre: "Jungle, DnB",
    role: "DJ",
    bio: "Digging through old records and new dubs.",
    groups: ["Friends"],
  },
] satisfies Buddy[];

const meta = {
  title: "Templates/Friend List",
  component: BuddyListTemplate,
  parameters: { layout: "fullscreen" },
  args: {
    buddies,
    suggestedMembers: [{ username: "rae.wav", displayName: "Rae", genre: "Breaks" }],
    onAddFriend: () => undefined,
    onOpenChat: () => undefined,
    onRemoveFriend: () => undefined,
    onSelectProfile: () => undefined,
  },
} satisfies Meta<typeof BuddyListTemplate>;

export default meta;

export const Default = {};
