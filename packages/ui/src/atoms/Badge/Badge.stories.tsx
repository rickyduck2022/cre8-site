import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";

const meta = {
  title: "Atoms/Badge",
  component: Badge,
  args: {
    children: "3",
    variant: "accent",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "accent", "audio"],
    },
    dot: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Count: Story = {};

export const Notifications: Story = {
  render: () => (
    <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
      <Badge>3</Badge>
      <Badge variant="audio">2</Badge>
      <Badge dot aria-label="New activity" />
    </div>
  ),
};
