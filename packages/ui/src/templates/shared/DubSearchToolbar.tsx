import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "@craft/icons";
import { EdgeTab } from "../../atoms/EdgeTab/EdgeTab";
import "./DubSearchToolbar.css";

interface DubSearchToolbarProps {
  children: (onSearch: () => void) => ReactNode;
  query: string;
}

export function DubSearchToolbar({ children, query }: DubSearchToolbarProps) {
  const [minimized, setMinimized] = useState(false);
  const [searchCount, setSearchCount] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const previousSearch = useRef({ query, searchCount });
  const contentId = useId();

  useLayoutEffect(() => {
    if (previousSearch.current.query === query && previousSearch.current.searchCount === searchCount) return;
    previousSearch.current = { query, searchCount };
    const toolbar = toolbarRef.current;
    const viewport = toolbar?.closest<HTMLElement>(".scroll-viewport")
      ?? toolbar?.closest<HTMLElement>(".dashboard-template")?.querySelector<HTMLElement>(".dashboard-template__body");
    const collection = toolbar?.parentElement;
    if (!toolbar || !viewport || !collection) return;

    if (toolbar.closest(".dashboard-template")) {
      viewport.scrollTop = 0;
    } else {
      collection.style.setProperty("--dub-search-results-min-height", `${Math.max(0, viewport.clientHeight - toolbar.offsetHeight)}px`);
      viewport.scrollTop += toolbar.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientTop;
    }
  }, [query, searchCount]);

  return (
    <div className={`dub-search-toolbar${minimized ? " dub-search-toolbar--minimized" : ""}`} ref={toolbarRef}>
      <div className="dub-search-toolbar__content" id={contentId}>{children(() => setSearchCount((count) => count + 1))}</div>
      <EdgeTab
        aria-controls={contentId}
        aria-expanded={!minimized}
        aria-label={minimized ? "Expand search controls" : "Minimize search controls"}
        className="dub-search-toolbar__toggle"
        leadingIcon={<ChevronDown />}
        onClick={() => setMinimized((current) => !current)}
      />
    </div>
  );
}
