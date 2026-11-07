import type { Meta, StoryObj } from "@storybook/react";
import { AccountMenu } from "./AccountMenu";

const meta = {
  title: "Molecules/AccountMenu",
  component: AccountMenu,
  args: {
    userName: "Meladee",
    onEditProfile: () => undefined,
    onLogout: () => undefined,
  },
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
