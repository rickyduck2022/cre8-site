import type { Meta, StoryObj } from "@storybook/react";
import { TrackFileMetadata } from "./TrackFileMetadata";

const meta = {
  title: "Molecules/TrackFileMetadata",
  component: TrackFileMetadata,
  args: {
    fileType: "MP3",
    bitrateKbps: 320,
  },
} satisfies Meta<typeof TrackFileMetadata>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
