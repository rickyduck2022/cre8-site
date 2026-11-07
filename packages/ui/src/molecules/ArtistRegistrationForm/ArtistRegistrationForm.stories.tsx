import type { Meta, StoryObj } from "@storybook/react";
import { ArtistRegistrationForm } from "./ArtistRegistrationForm";

const meta = {
  title: "Molecules/ArtistRegistrationForm",
  component: ArtistRegistrationForm,
  args: {
    onSubmit: () => undefined,
    onSwitchToSignIn: () => undefined,
  },
} satisfies Meta<typeof ArtistRegistrationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
