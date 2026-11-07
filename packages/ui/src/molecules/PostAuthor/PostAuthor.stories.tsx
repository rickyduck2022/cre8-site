import type { Meta, StoryObj } from "@storybook/react";
import { PostAuthor } from "./PostAuthor";

const meta = {
  title: "Molecules/PostAuthor",
  component: PostAuthor,
  args: { name: "Malaa", detail: "Music producer", timestamp: "1h ago" },
} satisfies Meta<typeof PostAuthor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
