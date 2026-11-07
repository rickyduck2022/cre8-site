import type { Meta, StoryObj } from "@storybook/react";
import { Brand } from "./Brand";

const meta = {
  title: "Molecules/Brand",
  component: Brand,
  args: { size: "large" },
} satisfies Meta<typeof Brand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
