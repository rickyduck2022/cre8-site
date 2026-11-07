import type { Meta, StoryObj } from "@storybook/react";
import { TabletTemplate } from "./TabletTemplate";

const meta = {
  title: "Templates/Tablet",
  component: TabletTemplate,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "tablet" },
  },
} satisfies Meta<typeof TabletTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
