import type { Meta, StoryObj } from "@storybook/react";
import { MobileTemplate } from "./MobileTemplate";

const meta = {
  title: "Templates/Mobile",
  component: MobileTemplate,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
  },
} satisfies Meta<typeof MobileTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FeedOnly: Story = {
  args: { showCommunity: false },
};
