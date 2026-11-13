import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { EdgeTab } from "../../atoms/EdgeTab/EdgeTab";
import { useMobileLayout } from "../../utils/useMobileLayout";
import "./DubSearchToolbar.css";
import { useTutorialNavigation } from "../../foundations/TutorialNavigationContext";

interface DubSearchToolbarProps {
  children: (onSearch: () => void) => ReactNode;
  query: string;
  compactVault?: boolean;
  activeCount?: number;
  error?: string | null;
}

export function DubSearchToolbar({ children, query, compactVault = false, activeCount = 0, error }: DubSearchToolbarProps) {
  const [minimized, setMinimized] = useState(compactVault);
  const mobile = useMobileLayout();
  const vaultCollapsed = compactVault && mobile && minimized;
  const [searchCount, setSearchCount] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const previousSearch = useRef({ query, searchCount });
  const contentId = useId();
  useTutorialNavigation((surface) => {
    setMinimized(surface !== "search" && surface !== "filters");
  });

  useLayoutEffect(() => {
    if (previousSearch.current.query === query && previousSearch.current.searchCount === searchCount) return;
    previousSearch.current = { query, searchCount };
    const toolbar = toolbarRef.current;
    const viewport = toolbar?.closest<HTMLElement>(".scroll-viewport")
      ?? toolbar?.closest<HTMLElement>(".dashboard-template")?.querySelector<HTMLElement>(".dashboard-template__body");
    const collection = compactVault ? toolbar?.closest<HTMLElement>(".latest-dubs-template") : toolbar?.parentElement;
    const anchor = compactVault && mobile ? toolbar?.parentElement : toolbar;
    if (!toolbar || !viewport || !collection || !anchor) return;

    if (toolbar.closest(".dashboard-template")) {
      viewport.scrollTop = 0;
    } else {
      collection.style.setProperty("--dub-search-results-min-height", `${Math.max(0, viewport.clientHeight - anchor.offsetHeight)}px`);
      viewport.scrollTop += anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientTop;
    }
  }, [query, searchCount, compactVault, mobile]);

  return (
    <div className={`dub-search-toolbar${compactVault ? " dub-search-toolbar--vault" : ""}${minimized ? " dub-search-toolbar--minimized" : ""}`} ref={toolbarRef}>
      <div className="dub-search-toolbar__content" id={contentId} hidden={vaultCollapsed}>{children(() => setSearchCount((count) => count + 1))}</div>
      {compactVault ? <Button
        aria-controls={contentId}
        aria-expanded={!vaultCollapsed}
        aria-label={`Search and filters${activeCount ? `, ${activeCount} active` : ""}`}
        className="dub-search-toolbar__vault-toggle"
        leadingIcon={<Search />}
        onClick={() => setMinimized((current) => !current)}
        variant="secondary"
      >
        {activeCount > 0 && <span className="dub-search-toolbar__active-count" aria-hidden="true">{activeCount}</span>}
      </Button> : <EdgeTab
        aria-controls={contentId}
        aria-expanded={!minimized}
        aria-label={minimized ? "Expand search controls" : "Minimize search controls"}
        className="dub-search-toolbar__toggle"
        leadingIcon={<ChevronDown />}
        onClick={() => setMinimized((current) => !current)}
      />}
      {vaultCollapsed && error && <p className="dub-search-toolbar__error" role="alert">{error}</p>}
    </div>
  );
}
