import type { Meta, StoryObj } from "@storybook/react";
import { NotificationCenter } from "./NotificationCenter";

const now = new Date().toISOString();
const meta = {
  title: "Organisms/NotificationCenter",
  component: NotificationCenter,
  args: {
    notifications: [
      {
        id: "notification-1",
        message: "Your dub was added to the Dub Feed.",
        type: "success",
        createdAt: now,
        read: false,
      },
      {
        id: "notification-2",
        message: "A new message is waiting in your inbox.",
        type: "info",
        createdAt: now,
        read: true,
      },
    ],
    unreadCount: 1,
    onOpen: () => undefined,
    onDismiss: () => undefined,
    onClear: () => undefined,
  },
} satisfies Meta<typeof NotificationCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { notifications: [], unreadCount: 0 },
};
