import type { Meta, StoryObj } from "@storybook/react";
import { EditProfileForm } from "./EditProfileForm";

const meta = {
  title: "Molecules/EditProfileForm",
  component: EditProfileForm,
  args: {
    profile: {
      displayName: "Meladee",
      role: "DJ / Producer",
      genre: "UK Garage, Bassline",
      bio: "Collecting late-night rollers and sharing the ones that stay with me.",
    },
    onCancel: () => undefined,
    onSubmit: () => undefined,
  },
} satisfies Meta<typeof EditProfileForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
