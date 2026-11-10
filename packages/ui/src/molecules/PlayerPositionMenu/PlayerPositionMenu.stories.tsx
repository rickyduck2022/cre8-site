import type { Meta, StoryObj } from "@storybook/react";
import { PlayerPositionMenu } from "./PlayerPositionMenu";

const meta = {
  title: "Molecules/PlayerPositionMenu",
  component: PlayerPositionMenu,
  args: { positions: ["header", "footer", "sidebar", "floating"], current: "footer", onSelect: () => undefined, opacityControl: { value: 100, onChange: () => undefined } },
} satisfies Meta<typeof PlayerPositionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
