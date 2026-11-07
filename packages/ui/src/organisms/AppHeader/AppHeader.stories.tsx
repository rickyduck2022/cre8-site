import type { Meta, StoryObj } from "@storybook/react";
import { AppHeader } from "./AppHeader";

const meta = {
  title: "Organisms/AppHeader",
  component: AppHeader,
  args: {
    userName: "Meladee",
    searchPlaceholder: "Search artists, dubs, or genres",
    onEditProfile: () => undefined,
    onLogout: () => undefined,
  },
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { variant: "compact" },
};
