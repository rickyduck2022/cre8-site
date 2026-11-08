import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { TagSelector } from "./TagSelector";

const meta = {
  title: "Molecules/TagSelector",
  component: TagSelector,
} satisfies Meta<typeof TagSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TrackTags: Story = {
  args: { label: "Tags", options: ["Jump Up", "Rollers", "Jungle", "Liquid"], value: ["Jungle"], onChange: () => undefined },
  render: () => {
    const Example = () => {
      const [value, setValue] = useState<string[]>(["Jungle"]);
      return <TagSelector label="Tags" options={["Jump Up", "Rollers", "Jungle", "Liquid"]} value={value} onChange={setValue} />;
    };
    return <Example />;
  },
};
