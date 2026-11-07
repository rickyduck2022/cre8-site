import type { Meta, StoryObj } from "@storybook/react";
import { UploadProgress } from "./UploadProgress";

const meta = {
  title: "Molecules/UploadProgress",
  component: UploadProgress,
  args: {
    progress: {
      phase: "uploading",
      fileName: "late-night-dub.wav",
      progress: 64,
    },
  },
} satisfies Meta<typeof UploadProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Uploading: Story = {};

export const Publishing: Story = {
  args: {
    progress: { phase: "publishing", fileName: "", progress: 100 },
  },
};
