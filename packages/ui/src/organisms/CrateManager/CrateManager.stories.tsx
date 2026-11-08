import type { Meta, StoryObj } from "@storybook/react";
import { CrateManager } from "./CrateManager";
import type { Dub } from "../../types/domain";

const dubs: Dub[] = [
  {
    id: "night-shift",
    title: "Night Shift",
    artist: "Meladee",
    uploader: "meladee",
    uploaderDisplayName: "Meladee",
    uploadedAt: "2026-11-05T15:42:00.000Z",
    bpm: 128,
    genre: "Deep House",
    duration: "05:11",
    likes: 4,
    downloads: 5,
    artwork: "whitelabel",
    message: "A late-night roller.",
  },
];

const meta = {
  title: "Organisms/CrateManager",
  component: CrateManager,
  args: {
    crates: [
      { id: "late-night", name: "Late-night weapons", dubIds: ["night-shift"] },
      { id: "warmup", name: "Warm-up set", dubIds: [] },
    ],
    dubs,
    onCreateCrate: async () => true,
    onRenameCrate: async () => true,
    onDeleteCrate: async () => true,
    onSetDubInCrate: async () => true,
    onOpenCrate: () => undefined,
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof CrateManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ManageCrates: Story = {};
