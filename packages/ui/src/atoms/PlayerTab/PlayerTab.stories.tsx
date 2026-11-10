import type { Meta, StoryObj } from "@storybook/react";
import { Maximize2 } from "@craft/icons";
import { PlayerTab } from "./PlayerTab";

const meta = {
  title: "Atoms/PlayerTab",
  component: PlayerTab,
  parameters: {
    docs: {
      description: {
        component: "Shared media-player tab appearance and interaction states. Consumers own positioning and docking geometry; use --player-tab-surface, --player-tab-hover, --player-tab-color and --player-tab-shadow for context styling. Native button props and refs are forwarded for dragging, menus and keyboard access.",
      },
    },
  },
  args: {
    "aria-label": "Expand audio player",
    leadingIcon: <Maximize2 aria-hidden="true" />,
  },
} satisfies Meta<typeof PlayerTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
