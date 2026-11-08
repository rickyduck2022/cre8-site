import type { Meta, StoryObj } from "@storybook/react";
import { MessengerTemplate } from "./MessengerTemplate";
import type { Buddy, Conversation, Dub } from "../communityTypes";

const buddies: Buddy[] = [
  {
    id: "evan",
    username: "evan.wav",
    displayName: "Evan",
    presence: "online",
    genre: "House, Garage",
    role: "Producer",
    bio: "Making warm sounds for small rooms.",
    groups: ["Friends"],
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
];

const dubs: Dub[] = [
  {
    id: "night-shift",
    title: "Night Shift",
    artist: "Evan.wav",
    uploader: "evan.wav",
    uploaderDisplayName: "Evan",
    uploadedAt: "2026-11-05T15:42:00.000Z",
    bpm: 128,
    genre: "Deep House",
    duration: "05:11",
    likes: 212,
    downloads: 248,
    artwork: "artwork-green",
    message: "For the rooms that don't need a big drop.",
  },
];

const conversations: Conversation[] = [
  {
    buddyId: "evan",
    messages: [
      {
        id: "message-1",
        sender: "them",
        text: "Been working on something new. Want an early listen?",
        sentAt: "2026-11-07T14:52:00.000Z",
      },
      {
        id: "message-2",
        sender: "you",
        text: "Always. Send it over!",
        sentAt: "2026-11-07T14:55:00.000Z",
        dubId: "night-shift",
      },
    ],
  },
];

const meta = {
  title: "Templates/Messenger",
  component: MessengerTemplate,
  parameters: { layout: "fullscreen" },
  args: {
    buddies,
    conversations,
    dubs,
    shareableDubs: dubs,
    initialBuddyId: "evan",
    chatConnectionStatus: "connected",
    nowPlayingId: null,
    isPlaying: false,
    onOpenProfile: () => undefined,
    onPlay: () => undefined,
    onStartConversation: () => undefined,
    onCreateAndShareDub: () => undefined,
    onSelectConversation: () => undefined,
    onLoadOlderMessages: async () => true,
    onSendMessage: () => true,
  },
} satisfies Meta<typeof MessengerTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
