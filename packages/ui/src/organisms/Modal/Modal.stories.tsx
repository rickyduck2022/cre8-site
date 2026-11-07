import type { Meta, StoryObj } from "@storybook/react";
import { Modal } from "./Modal";

const meta = {
  title: "Organisms/Modal",
  component: Modal,
  args: {
    title: "Share a dub",
    isOpen: true,
    onClose: () => undefined,
    children: <p>Modal content is composed by the consuming feature.</p>,
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
