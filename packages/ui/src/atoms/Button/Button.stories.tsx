import type { Meta, StoryObj } from "@storybook/react";
import { Download, Plus } from "@craft/icons";
import { Button } from "./Button";

const meta = {
  title: "Atoms/Button",
  component: Button,
  args: {
    children: "Share a dub",
    variant: "primary",
    size: "medium",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "tertiary"],
    },
    size: {
      control: "select",
      options: ["small", "medium", "large"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const WithIcon: Story = {
  args: {
    children: "Share a dub",
    leadingIcon: <Plus />,
  },
};

export const Secondary: Story = {
  args: {
    children: "Add friend",
    variant: "secondary",
  },
};

export const Tertiary: Story = {
  args: {
    children: "Cancel",
    variant: "tertiary",
  },
};

export const Disabled: Story = {
  args: {
    children: "Unavailable",
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    children: "Downloading",
    leadingIcon: <Download />,
    loading: true,
  },
};
