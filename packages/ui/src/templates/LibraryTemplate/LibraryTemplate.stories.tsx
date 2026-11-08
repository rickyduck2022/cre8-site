import type { Meta, StoryObj } from "@storybook/react";
import { LibraryTemplate } from "./LibraryTemplate";

const meta = {
  title: "Templates/LibraryTemplate",
  component: LibraryTemplate,
  args: {
    downloads: [{
      downloadedAt: "2026-11-02T12:00:00.000Z",
      dub: {
        id: "dub-library", title: "Night Drive", artist: "Amber", uploader: "amber",
        uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z", bpm: 174,
        genre: "Jungle, Rollers", tags: ["Jungle", "Rollers"], duration: "03:30",
        likes: 2, downloads: 12, artwork: "whitelabel", message: "Fresh from the studio.",
      },
    }],
    onDownload: () => undefined,
    onPlay: () => undefined,
  },
} satisfies Meta<typeof LibraryTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const Empty: Story = { args: { downloads: [] } };
