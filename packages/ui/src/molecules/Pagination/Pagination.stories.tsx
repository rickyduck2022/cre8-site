import type { Meta, StoryObj } from "@storybook/react";
import { Pagination } from "./Pagination";

const meta = {
  title: "Molecules/Pagination",
  component: Pagination,
  args: {
    itemCount: 28,
    page: 1,
    pageSize: 5,
    totalPages: 6,
    onPageChange: () => undefined,
    onPageSizeChange: () => undefined,
    label: "Dubs",
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
