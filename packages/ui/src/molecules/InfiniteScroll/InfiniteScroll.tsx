import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ScrollTrigger } from "../../atoms/ScrollTrigger/ScrollTrigger";
import { ScrollViewport } from "../../atoms/ScrollViewport/ScrollViewport";
import { Button } from "../../atoms/Button/Button";
import "../../atoms/ScrollViewport/ScrollViewport.css";
import "../Molecules.css";

export interface InfiniteScrollProps {
  children: ReactNode;
  itemCount: number;
  firstItemKey?: string;
  scrollToBottomKey?: string | number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void | boolean | Promise<void | boolean>;
  label?: string;
  className?: string;
  contentClassName?: string;
  initialPosition?: "start" | "end";
  loadDirection?: "start" | "end";
  loadThreshold?: number;
  role?: "log" | "region";
}

export function InfiniteScroll({
  children,
  itemCount,
  firstItemKey,
  scrollToBottomKey,
  hasMore,
  loading,
  onLoadMore,
  label = "items",
  className,
  contentClassName,
  initialPosition = "start",
  loadDirection = "start",
  loadThreshold = 96,
  role = "region",
}: InfiniteScrollProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const pendingPrependHeight = useRef<number | null>(null);
  const previousCount = useRef(itemCount);
  const previousFirstItemKey = useRef(firstItemKey);
  const previousBottomKey = useRef(scrollToBottomKey);
  const firstRender = useRef(true);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => setRoot(viewportRef.current), []);

  const loadMore = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !hasMore || loading || loadingRef.current) return;
    loadingRef.current = true;
    if (loadDirection === "start") pendingPrependHeight.current = viewport.scrollHeight;
    setLoadFailed(false);
    Promise.resolve().then(onLoadMore).then((succeeded) => {
      if (succeeded === false) setLoadFailed(true);
    }).catch(() => {
      setLoadFailed(true);
    }).finally(() => {
      loadingRef.current = false;
    });
  }, [hasMore, loadDirection, loading, onLoadMore]);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!root || !trigger || !hasMore || loading || loadFailed || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      {
        root,
        rootMargin: loadDirection === "start"
          ? `${loadThreshold}px 0px 0px`
          : `0px 0px ${loadThreshold}px 0px`,
        threshold: 0,
      },
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [hasMore, loadDirection, loadFailed, loadMore, loadThreshold, loading, root]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (firstRender.current) {
      firstRender.current = false;
      if (initialPosition === "end") viewport.scrollTop = viewport.scrollHeight;
    } else if (itemCount !== previousCount.current) {
      if (loadDirection === "start" && pendingPrependHeight.current !== null && firstItemKey !== previousFirstItemKey.current) {
        viewport.scrollTop += viewport.scrollHeight - pendingPrependHeight.current;
        pendingPrependHeight.current = null;
      } else if (pendingPrependHeight.current !== null) {
        pendingPrependHeight.current = viewport.scrollHeight;
      }
    }
    previousCount.current = itemCount;
    previousFirstItemKey.current = firstItemKey;
    if (scrollToBottomKey !== previousBottomKey.current) {
      viewport.scrollTop = viewport.scrollHeight;
      previousBottomKey.current = scrollToBottomKey;
    }
  }, [firstItemKey, initialPosition, itemCount, loadDirection, scrollToBottomKey]);

  return (
    <ScrollViewport
      aria-label={label}
      className={["infinite-scroll", className].filter(Boolean).join(" ")}
      ref={viewportRef}
      role={role}
      onScroll={(event) => {
        const atLoadEdge = loadDirection === "start"
          ? event.currentTarget.scrollTop <= loadThreshold
          : event.currentTarget.scrollWidth > event.currentTarget.clientWidth + 1
            ? event.currentTarget.scrollWidth - event.currentTarget.scrollLeft - event.currentTarget.clientWidth <= loadThreshold
            : event.currentTarget.scrollHeight - event.currentTarget.scrollTop - event.currentTarget.clientHeight <= loadThreshold;
        if (typeof IntersectionObserver === "undefined" && atLoadEdge) {
          loadMore();
        }
      }}
    >
      <div className={["infinite-scroll__content", contentClassName].filter(Boolean).join(" ")}>
        {loadDirection === "start" && <ScrollTrigger ref={triggerRef} />}
        {loadDirection === "start" && loading && <div className="infinite-scroll__status" role="status">Loading older {label}…</div>}
        {loadDirection === "start" && loadFailed && (
          <div className="infinite-scroll__status" role="status">
            Couldn’t load older {label}.
            <Button onClick={loadMore} size="small" variant="tertiary">Try again</Button>
          </div>
        )}
        {children}
        {loadDirection === "end" && <ScrollTrigger ref={triggerRef} />}
        {loadDirection === "end" && loading && <div className="infinite-scroll__status" role="status">Loading more {label}…</div>}
        {loadDirection === "end" && loadFailed && (
          <div className="infinite-scroll__status" role="status">
            Couldn’t load more {label}.
            <Button onClick={loadMore} size="small" variant="tertiary">Try again</Button>
          </div>
        )}
        {!hasMore && itemCount > 0 && (
          <div className="infinite-scroll__end" aria-hidden="true" />
        )}
      </div>
    </ScrollViewport>
  );
}
