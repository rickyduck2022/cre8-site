import type { Meta, StoryObj } from "@storybook/react";
import { DubUploadForm } from "./DubUploadForm";

const meta = {
  title: "Molecules/DubUploadForm",
  component: DubUploadForm,
  args: {
    artists: [{ id: "artist-meladee", name: "Meladee" }],
    onCancel: () => undefined,
    onSubmit: () => undefined,
  },
} satisfies Meta<typeof DubUploadForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
