import type { Meta, StoryObj } from "@storybook/react";
import { Check, Download, UserPlus, Upload } from "@craft/icons";
import { Action } from "./Action";

const meta = {
  title: "Atoms/Action",
  component: Action,
  args: {
    children: "Upload dub",
    icon: <Upload />,
    variant: "neutral",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["neutral", "primary", "audio"],
    },
  },
} satisfies Meta<typeof Action>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Examples: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Action icon={<Upload />}>Upload dub</Action>
      <Action icon={<Check />} variant="primary">Accept</Action>
      <Action>Ignore</Action>
      <Action icon={<UserPlus />}>Invite a friend</Action>
      <Action variant="primary">Share a dub</Action>
      <Action icon={<Download />}>Download</Action>
    </div>
  ),
};
