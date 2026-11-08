import type { Meta, StoryObj } from "@storybook/react";
import { TrackMetadata } from "./TrackMetadata";
import { TrackFileMetadata } from "../TrackFileMetadata/TrackFileMetadata";

const meta = {
  title: "Molecules/TrackMetadata",
  component: TrackMetadata,
  args: { tags: ["New", "Electronic", "Dub"], duration: "03:42", bpm: "128", keySignature: "F? minor" },
} satisfies Meta<typeof TrackMetadata>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InlineDark: Story = {
  render: () => (
    <div style={{ maxWidth: 250 }}>
      <TrackMetadata tags={["Jungle", "Rollers"]} bpm="174" layout="inline" tagVariant="dark">
        <TrackFileMetadata fileType="WAV" bitrateKbps={320} layout="inline" tagVariant="dark" />
      </TrackMetadata>
    </div>
  ),
};
