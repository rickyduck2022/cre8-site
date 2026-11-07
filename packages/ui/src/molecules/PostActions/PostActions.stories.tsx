import type { Meta, StoryObj } from "@storybook/react";
import { PostActions } from "./PostActions";

const meta = {
  title: "Molecules/PostActions",
  component: PostActions,
  args: { likes: 12, comments: 4, downloads: 2 },
} satisfies Meta<typeof PostActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
