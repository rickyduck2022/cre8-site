import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InfiniteScroll } from "./InfiniteScroll";

describe("InfiniteScroll", () => {
  it("scrolls to the bottom when the follow key changes", () => {
    const onLoadMore = vi.fn();
    const { container, rerender } = render(
      <InfiniteScroll
        firstItemKey="first-message"
        hasMore={false}
        itemCount={1}
        label="Messages"
        loading={false}
        onLoadMore={onLoadMore}
        role="log"
        scrollToBottomKey="latest-message-1"
      >
        <p>First message</p>
      </InfiniteScroll>,
    );
    const viewport = container.querySelector<HTMLElement>("[role='log']")!;
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 800 });
    viewport.scrollTop = 240;

    rerender(
      <InfiniteScroll
        firstItemKey="first-message"
        hasMore={false}
        itemCount={2}
        label="Messages"
        loading={false}
        onLoadMore={onLoadMore}
        role="log"
        scrollToBottomKey="latest-message-2"
      >
        <p>First message</p>
        <p>New message</p>
      </InfiniteScroll>,
    );

    expect(viewport.scrollTop).toBe(800);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not force the bottom when only the first item changes", () => {
    const { container, rerender } = render(
      <InfiniteScroll
        firstItemKey="message-2"
        hasMore
        itemCount={2}
        label="Messages"
        loading={false}
        onLoadMore={() => undefined}
        role="log"
        scrollToBottomKey="latest-message"
      >
        <p>Message two</p>
        <p>Message three</p>
      </InfiniteScroll>,
    );
    const viewport = container.querySelector<HTMLElement>("[role='log']")!;
    viewport.scrollTop = 180;

    rerender(
      <InfiniteScroll
        firstItemKey="message-1"
        hasMore
        itemCount={3}
        label="Messages"
        loading={false}
        onLoadMore={() => undefined}
        role="log"
        scrollToBottomKey="latest-message"
      >
        <p>Message one</p>
        <p>Message two</p>
        <p>Message three</p>
      </InfiniteScroll>,
    );

    expect(viewport.scrollTop).toBe(180);
  });
});
