import type { Meta, StoryObj } from "@storybook/react";
import { NowPlaying } from "./NowPlaying";

const meta = {
  title: "Molecules/NowPlaying",
  component: NowPlaying,
  args: { title: "Alien", artist: "Malaa" },
} satisfies Meta<typeof NowPlaying>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
