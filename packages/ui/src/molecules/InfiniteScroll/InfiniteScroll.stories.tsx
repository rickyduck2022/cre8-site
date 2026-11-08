import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { InfiniteScroll } from "./InfiniteScroll";

function InfiniteScrollExample() {
  const [items, setItems] = useState(Array.from({ length: 16 }, (_, index) => index + 1));
  const [loading, setLoading] = useState(false);
  const hasMore = items[0] > 1;

  async function loadOlder() {
    setLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    setItems((current) => {
      const first = current[0];
      const count = Math.min(10, first - 1);
      return Array.from({ length: count }, (_, index) => first - count + index).concat(current);
    });
    setLoading(false);
  }

  return (
    <InfiniteScroll
      className="infinite-scroll-story"
      contentClassName="infinite-scroll-story__content"
      hasMore={hasMore}
      initialPosition="end"
      itemCount={items.length}
      label="Example items"
      loading={loading}
      onLoadMore={loadOlder}
    >
      {items.map((item) => <div className="infinite-scroll-story__item" key={item}>Message {item}</div>)}
    </InfiniteScroll>
  );
}

const meta = {
  title: "Molecules/InfiniteScroll",
  component: InfiniteScroll,
  render: () => <InfiniteScrollExample />,
  args: {
    children: null,
    itemCount: 0,
    hasMore: false,
    loading: false,
    onLoadMore: () => undefined,
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InfiniteScroll>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadOlderItems: Story = {};
