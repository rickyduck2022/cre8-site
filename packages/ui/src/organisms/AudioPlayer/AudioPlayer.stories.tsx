import type { Meta, StoryObj } from "@storybook/react";
import { AudioPlayer } from "./AudioPlayer";

const meta = {
  title: "Organisms/AudioPlayer",
  component: AudioPlayer,
  args: {
    track: {
      title: "Alien",
      artist: "Malaa",
      duration: "03:42",
    },
    playing: true,
    currentTimeSeconds: 93,
    durationSeconds: 222,
  },
} satisfies Meta<typeof AudioPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {};

export const Compact: Story = {
  args: { variant: "compact" },
};

export const Mini: Story = {
  args: { variant: "mini" },
};
