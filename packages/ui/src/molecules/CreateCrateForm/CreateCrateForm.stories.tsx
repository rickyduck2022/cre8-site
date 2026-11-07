import type { Meta, StoryObj } from "@storybook/react";
import { CreateCrateForm } from "./CreateCrateForm";

const meta = {
  title: "Molecules/CreateCrateForm",
  component: CreateCrateForm,
  args: {
    onCancel: () => undefined,
    onSubmit: () => undefined,
  },
} satisfies Meta<typeof CreateCrateForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
