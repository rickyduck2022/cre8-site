import type { Meta, StoryObj } from "@storybook/react";
import { AListBadge } from "./AListBadge";

const meta = {
  title: "Atoms/AListBadge",
  component: AListBadge,
} satisfies Meta<typeof AListBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ApprovedArtist: Story = {
  render: () => <strong>Artist name<AListBadge /></strong>,
};
