import type { Meta, StoryObj } from "@storybook/react";
import { OnlineFriends } from "./OnlineFriends";

const meta = {
  title: "Organisms/OnlineFriends",
  component: OnlineFriends,
  args: {
    groups: [
      {
        title: "In the studio",
        friends: [
          { name: "MelaDee" },
          { name: "Evan" },
          { name: "Kai" },
          { name: "Rae" },
        ],
      },
      {
        title: "What's good",
        friends: [{ name: "Serena" }, { name: "Malaa" }, { name: "Hek" }],
      },
    ],
  },
} satisfies Meta<typeof OnlineFriends>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
