import type { Meta, StoryObj } from "@storybook/react";
import { CommunityPanel } from "./CommunityPanel";

const meta = {
  title: "Organisms/CommunityPanel",
  component: CommunityPanel,
} satisfies Meta<typeof CommunityPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
