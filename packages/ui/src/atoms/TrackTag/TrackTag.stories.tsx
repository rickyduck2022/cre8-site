import type { Meta, StoryObj } from "@storybook/react";
import { AudioLines } from "@craft/icons";
import { TrackTag } from "./TrackTag";

const meta = {
  title: "Atoms/TrackTag",
  component: TrackTag,
  args: {
    children: "New",
    variant: "accent",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["neutral", "accent", "audio", "dark"],
    },
  },
} satisfies Meta<typeof TrackTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <TrackTag>Explicit</TrackTag>
      <TrackTag variant="accent">New</TrackTag>
      <TrackTag icon={<AudioLines />} variant="audio">Live</TrackTag>
      <TrackTag variant="dark">Jungle</TrackTag>
    </div>
  ),
};
