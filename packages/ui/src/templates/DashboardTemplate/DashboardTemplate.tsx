import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../../atoms/Button/Button";
import { ScrollViewport } from "../../atoms/ScrollViewport/ScrollViewport";
import "../../atoms/ScrollViewport/ScrollViewport.css";
import { AppHeader } from "../../organisms/AppHeader/AppHeader";
import { CommunityPanel } from "../../organisms/CommunityPanel/CommunityPanel";
import { Feed } from "../../organisms/Feed/Feed";
import { Navigation } from "../../organisms/Navigation/Navigation";
import type { DubPostProps } from "../../organisms/DubPost/DubPost";
import { desktopNavigation, templatePosts } from "../TemplateContent";
import { CollectionHeaderContext } from "../shared/CollectionHeaderContext";
import { FilterHostContext } from "../../foundations/FilterHostContext";
import { BrowseChromeContext } from "../../foundations/BrowseChromeContext";
import { useMobileLayout } from "../../utils/useMobileLayout";
import "../TemplateFrame.css";
import "./DashboardTemplate.css";

export interface DashboardTemplateProps {
  posts?: DubPostProps[];
  userName?: string;
  className?: string;
  navigation?: ReactNode;
  header?: ReactNode;
  contentOverlay?: ReactNode;
  children?: ReactNode;
  community?: ReactNode;
  audioPlayer?: ReactNode;
  footer?: ReactNode;
  scrollContent?: boolean;
  scrollResetKey?: string;
}

export function DashboardTemplate({
  children,
  className,
  community,
  header,
  contentOverlay,
  navigation,
  posts = templatePosts,
  audioPlayer,
  footer,
  scrollContent = false,
  scrollResetKey,
  userName = "Meladee",
}: DashboardTemplateProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobileLayout();
  const [collectionHeader, setCollectionHeader] = useState<HTMLDivElement | null>(null);
  const [filterHost, setFilterHost] = useState<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const bindViewport = useCallback((element: HTMLDivElement | null) => {
    contentRef.current = element;
    setViewport(element);
  }, []);
  const browse = useContext(BrowseChromeContext);
  const [localCompact, setCompact] = useState(false);
  const compact = browse?.compact ?? localCompact;
  const direction = useRef({ top: 0, distance: 0 });
  const browsingUntil = useRef(0);
  const setBrowseCompact = browse?.setCompact;
  const showChrome = useCallback((value: boolean) => {
    setCompact(value);
    setBrowseCompact?.(value);
  }, [setBrowseCompact]);
  useEffect(() => {
    showChrome(false);
    direction.current = { top: 0, distance: 0 };
  }, [scrollResetKey, isMobile, showChrome]);
  useEffect(() => () => browse?.setCompact(false), [browse?.setCompact]);
  useLayoutEffect(() => {
    if (scrollContent && contentRef.current) contentRef.current.scrollTop = 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, [scrollContent, scrollResetKey]);

  const hasCustomContent = children !== undefined;
  const communityContent =
    community !== undefined
      ? community
      : hasCustomContent
        ? null
        : <CommunityPanel variant="sidebar" />;

  return (
    <FilterHostContext.Provider value={{ host: filterHost, viewport }}>
    <CollectionHeaderContext.Provider value={isMobile ? collectionHeader : null}>
    <main
      className={["template-frame", "dashboard-template", isMobile && compact && "dashboard-template--browse-compact", className]
        .filter(Boolean)
        .join(" ")}
    >
      {navigation ?? (
        <Navigation
          activeItem="Feed"
          hideOnMobile
          sections={desktopNavigation}
          userDetail="Friends circle"
          userName={userName}
        />
      )}
      <div className="dashboard-template__main">
        <div className="dashboard-template__header" onFocusCapture={() => showChrome(false)}>
          {header ?? <AppHeader userName={userName} variant="compact" />}
          {isMobile && compact && <Button className="dashboard-template__show-header" variant="tertiary" size="small" onClick={() => showChrome(false)}>Show app header</Button>}
          {isMobile && <div className="dashboard-template__collection-header" ref={setCollectionHeader} />}
        </div>
        {contentOverlay && <div className="dashboard-template__content-overlay">{contentOverlay}</div>}
        <div className="dashboard-template__filter-host" ref={setFilterHost} />
        <ScrollViewport
          aria-label={scrollContent ? "Page content" : undefined}
          className={[
            "dashboard-template__body",
            !communityContent && "dashboard-template__body--single",
            !scrollContent && "dashboard-template__body--unconstrained",
          ].filter(Boolean).join(" ")}
          role={scrollContent ? "region" : undefined}
          ref={bindViewport}
          onWheel={() => { browsingUntil.current = Date.now() + 1000; }}
          onTouchMove={() => { browsingUntil.current = Date.now() + 1000; }}
          onKeyDown={(event) => {
            if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) browsingUntil.current = Date.now() + 1000;
          }}
          onScroll={(event) => {
            if (!isMobile || !scrollContent) return;
            const element = event.currentTarget;
            const top = Math.max(0, element.scrollTop);
            const delta = top - direction.current.top;
            direction.current.top = top;
            const focused = document.activeElement;
            if (Date.now() > browsingUntil.current || element.inert ||
                [...document.querySelectorAll('[role="dialog"], dialog[open]')].some((dialog) => dialog.getClientRects().length > 0) ||
                focused?.matches("input, textarea, select, [contenteditable=true]") ||
                (focused?.matches(":focus-visible") && focused.closest(".dashboard-template__header, [data-workspace-navigator]"))) return;
            if (top < 24) { direction.current.distance = 0; showChrome(false); return; }
            if (Math.sign(delta) !== Math.sign(direction.current.distance)) direction.current.distance = 0;
            direction.current.distance += delta;
            if (Math.abs(direction.current.distance) >= 48) {
              showChrome(direction.current.distance > 0);
              direction.current.distance = 0;
            }
          }}
          tabIndex={scrollContent ? 0 : undefined}
        >
          <div className="dashboard-template__content">
            {hasCustomContent ? (
              children
            ) : (
              <Feed posts={posts} userName={userName} variant="embedded" />
            )}
          </div>
          {communityContent && (
            <aside
              aria-label="Community activity"
              className="dashboard-template__community"
            >
              {communityContent}
            </aside>
          )}
        </ScrollViewport>
        {audioPlayer}
        {footer}
      </div>
    </main>
    </CollectionHeaderContext.Provider>
    </FilterHostContext.Provider>
  );
}