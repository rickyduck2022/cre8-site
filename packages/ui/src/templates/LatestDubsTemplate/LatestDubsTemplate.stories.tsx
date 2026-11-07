import type { Meta, StoryObj } from "@storybook/react";
import { LatestDubsTemplate } from "./LatestDubsTemplate";
import type { Dub } from "../communityTypes";

const dubs: Dub[] = [
  {
    id: "alien",
    title: "Alien",
    artist: "Malaa",
    uploader: "malaa",
    uploaderDisplayName: "Malaa",
    uploadedAt: "2026-11-07T15:42:00.000Z",
    bpm: 174,
    genre: "Roller",
    duration: "03:42",
    likes: 128,
    downloads: 176,
    artwork: "artwork-cyan",
    message: "One for the late hours. Fresh out of the studio.",
  },
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

const meta = {
  title: "Templates/Dub Feed",
  component: LatestDubsTemplate,
  parameters: { layout: "fullscreen" },
  args: {
    dubs,
    likedDubIds: new Set<string>(),
    nowPlayingId: null,
    isPlaying: false,
    onDownload: () => undefined,
    onOpenProfile: () => undefined,
    onPlay: () => undefined,
  },
} satisfies Meta<typeof LatestDubsTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
