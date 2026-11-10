import type { Meta, StoryObj } from "@storybook/react";
import { Modal } from "./Modal";
import { ModalFooter } from "../../molecules/ModalFooter/ModalFooter";
import { Button } from "../../atoms/Button/Button";

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

export const WithFooter: Story = {
  args: {
    children: (
      <>
        <p>Content scrolls independently of the mobile header and footer.</p>
        <ModalFooter>
          <span>3 dubs found</span>
          <Button>Apply filters</Button>
        </ModalFooter>
      </>
    ),
  },
};
