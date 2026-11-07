import type { Meta, StoryObj } from "@storybook/react";
import { DashboardTemplate } from "./DashboardTemplate";

const meta = {
  title: "Templates/Dashboard",
  component: DashboardTemplate,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof DashboardTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomAudioPlayer: Story = {
  args: {
    audioPlayer: (
      <div style={{ padding: "1rem" }}>
        Custom AudioPlayer supplied by the consuming application.
      </div>
    ),
  },
};
