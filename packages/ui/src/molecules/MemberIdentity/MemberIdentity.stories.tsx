import type { Meta, StoryObj } from "@storybook/react";
import { MemberIdentity } from "./MemberIdentity";

const meta = {
  title: "Molecules/MemberIdentity",
  component: MemberIdentity,
  args: { name: "Evan", detail: "Friends circle", status: "active" },
} satisfies Meta<typeof MemberIdentity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
