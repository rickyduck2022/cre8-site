import type { Meta, StoryObj } from "@storybook/react";
import { Avatar } from "./Avatar";

const meta = {
  title: "Atoms/Avatar",
  component: Avatar,
  args: {
    name: "Sam Rivera",
    size: "medium",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["small", "medium", "large"],
    },
    status: {
      control: "select",
      options: ["active", "inactive"],
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {};

export const Sizes: Story = {
  render: () => (
    <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
      <Avatar name="Sam Rivera" size="small" />
      <Avatar name="Mia Chen" size="medium" status="active" />
      <Avatar name="Noah Kim" size="large" status="inactive" />
    </div>
  ),
};
