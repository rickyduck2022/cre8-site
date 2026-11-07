import type { ReactNode } from "react";
import { AppHeader } from "../../organisms/AppHeader/AppHeader";
import { AudioPlayer } from "../../organisms/AudioPlayer/AudioPlayer";
import { CommunityPanel } from "../../organisms/CommunityPanel/CommunityPanel";
import { Feed } from "../../organisms/Feed/Feed";
import { Navigation } from "../../organisms/Navigation/Navigation";
import type { DubPostProps } from "../../organisms/DubPost/DubPost";
import { desktopNavigation, templatePosts } from "../TemplateContent";
import "../TemplateFrame.css";
import "./DashboardTemplate.css";

export interface DashboardTemplateProps {
  posts?: DubPostProps[];
  userName?: string;
  className?: string;
  navigation?: ReactNode;
  header?: ReactNode;
  children?: ReactNode;
  community?: ReactNode;
  audioPlayer?: ReactNode;
}

export function DashboardTemplate({
  children,
  className,
  community,
  header,
  navigation,
  posts = templatePosts,
  audioPlayer,
  userName = "Meladee",
}: DashboardTemplateProps) {
  const hasCustomContent = children !== undefined;
  const communityContent =
    community !== undefined
      ? community
      : hasCustomContent
        ? null
        : <CommunityPanel variant="sidebar" />;

  return (
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
        {header ?? <AppHeader userName={userName} variant="compact" />}
        <div
          className={[
            "dashboard-template__body",
            !communityContent && "dashboard-template__body--single",
          ]
            .filter(Boolean)
            .join(" ")}
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
        </div>
        {audioPlayer ?? (
          <AudioPlayer
            track={{ title: "Alien", artist: "Malaa", duration: "03:42" }}
            variant="full"
          />
        )}
      </div>
    </main>
  );
}
