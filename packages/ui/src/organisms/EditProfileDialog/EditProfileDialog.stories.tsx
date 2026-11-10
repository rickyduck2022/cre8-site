import type { Meta, StoryObj } from "@storybook/react";
import { EditProfileDialog } from "./EditProfileDialog";

const meta = {
  title: "Organisms/EditProfileDialog",
  component: EditProfileDialog,
  args: {
    profile: { displayName: "Amber", role: "DJ", bio: "Collecting Jungle.", genre: "Jungle" },
    onClose: () => undefined,
    onSubmit: async () => true,
  },
} satisfies Meta<typeof EditProfileDialog>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const SaveFailure: Story = {
  args: {
    onSubmit: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return false;
    },
  },
};
