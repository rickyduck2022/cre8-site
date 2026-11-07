import type { Meta, StoryObj } from "@storybook/react";
import { Feed } from "./Feed";

const meta = {
  title: "Organisms/Feed",
  component: Feed,
  args: {
    userName: "Meladee",
    posts: [
      {
        author: "Meladee",
        authorDetail: "Friend",
        timestamp: "24 min ago",
        message: "One for the late hours. Fresh out of the studio — let me know how it hits.",
        track: {
          title: "Alien",
          artist: "Malaa",
          duration: "03:42",
          bpm: "174",
          keySignature: "F minor",
        },
        likes: 28,
        comments: 6,
        downloads: 18,
      },
      {
        author: "Malaa, Hek",
        authorDetail: "2 Friends",
        timestamp: "1 hr ago",
        message: "New roller for the weekend. Tested this one in Bristol last night.",
        track: {
          title: "Renegade",
          artist: "Malaa, Hek",
          duration: "04:18",
          bpm: "174",
          keySignature: "D minor",
        },
        likes: 12,
        comments: 3,
        downloads: 7,
      },
    ],
  },
} satisfies Meta<typeof Feed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
