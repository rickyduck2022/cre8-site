import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../atoms/Button/Button";
import { ArtistCard } from "./ArtistCard";

const meta = { title: "Molecules/ArtistCard", component: ArtistCard, args: { name: "Amber", username: "amber", detail: "Jungle", aListApproved: true, onOpenProfile: () => undefined } } satisfies Meta<typeof ArtistCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithAction: Story = { args: { action: <Button size="small" variant="secondary">Add</Button> } };
