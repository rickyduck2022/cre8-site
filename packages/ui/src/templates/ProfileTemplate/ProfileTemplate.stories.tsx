import type { Meta, StoryObj } from "@storybook/react";
import { ProfileTemplate } from "./ProfileTemplate";
import type { Dub, MemberProfile } from "../communityTypes";

const profile: MemberProfile = {
  id: "meladee",
  username: "meladee",
  displayName: "Meladee",
  presence: "online",
  genre: "UK Garage, Bassline",
  role: "DJ / Producer",
  bio: "Collecting late-night rollers and sharing the ones that stay with me.",
  groups: ["Friends"],
};

const uploads: Dub[] = [
  {
    id: "underground",
    title: "Underground",
    artist: "Meladee",
    uploader: "meladee",
    uploaderDisplayName: "Meladee",
    uploadedAt: "2026-11-06T22:06:00.000Z",
    bpm: 132,
    genre: "Bassline",
    duration: "03:56",
    likes: 63,
    downloads: 82,
    artwork: "artwork-orange",
    message: "A little something from last night's session.",
  },
];

const meta = {
  title: "Templates/Profile",
  component: ProfileTemplate,
  parameters: { layout: "fullscreen" },
  args: {
    profile,
    uploads,
    isOwnProfile: true,
    playingDubId: null,
    isPlaying: false,
    onEditProfile: () => undefined,
    onMessage: () => undefined,
    onPlay: () => undefined,
    onDownload: () => undefined,
  },
} satisfies Meta<typeof ProfileTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
