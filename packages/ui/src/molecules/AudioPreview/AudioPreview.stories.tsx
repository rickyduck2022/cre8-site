import type { Meta, StoryObj } from "@storybook/react";
import { AudioPreview } from "./AudioPreview";

const meta = {
  title: "Molecules/AudioPreview",
  component: AudioPreview,
  args: { tracks: [{ title: "Alien", artist: "Malaa", duration: "03:42" }, { title: "Renegade", artist: "Malaa, Hek", duration: "04:18" }] },
} satisfies Meta<typeof AudioPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
