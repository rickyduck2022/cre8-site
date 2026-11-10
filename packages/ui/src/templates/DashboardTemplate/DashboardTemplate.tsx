import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ScrollViewport } from "../../atoms/ScrollViewport/ScrollViewport";
import "../../atoms/ScrollViewport/ScrollViewport.css";
import { AppHeader } from "../../organisms/AppHeader/AppHeader";
import { CommunityPanel } from "../../organisms/CommunityPanel/CommunityPanel";
import { Feed } from "../../organisms/Feed/Feed";
import { Navigation } from "../../organisms/Navigation/Navigation";
import type { DubPostProps } from "../../organisms/DubPost/DubPost";
import { desktopNavigation, templatePosts } from "../TemplateContent";
import { CollectionHeaderContext } from "../shared/CollectionHeaderContext";
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
  const [collectionHeader, setCollectionHeader] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (scrollContent && contentRef.current) contentRef.current.scrollTop = 0;
  }, [scrollContent, scrollResetKey]);

  const hasCustomContent = children !== undefined;
  const communityContent =
    community !== undefined
      ? community
      : hasCustomContent
        ? null
        : <CommunityPanel variant="sidebar" />;

  return (
    <CollectionHeaderContext.Provider value={collectionHeader}>
    <main
      className={["template-frame", "dashboard-template", className]
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
        <div className="dashboard-template__header">
          {header ?? <AppHeader userName={userName} variant="compact" />}
          <div className="dashboard-template__collection-header" ref={setCollectionHeader} />
        </div>
        {contentOverlay && <div className="dashboard-template__content-overlay">{contentOverlay}</div>}
        <ScrollViewport
          aria-label={scrollContent ? "Page content" : undefined}
          className={[
            "dashboard-template__body",
            !communityContent && "dashboard-template__body--single",
            !scrollContent && "dashboard-template__body--unconstrained",
          ].filter(Boolean).join(" ")}
          role={scrollContent ? "region" : undefined}
          ref={contentRef}
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
  );
}