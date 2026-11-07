import type { Meta, StoryObj } from "@storybook/react";
import { DubPost } from "./DubPost";

const meta = {
  title: "Organisms/DubPost",
  component: DubPost,
  args: {
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
      fileSize: "WAV · 62.4 MB",
    },
    likes: 28,
    comments: 6,
    downloads: 18,
  },
} satisfies Meta<typeof DubPost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
