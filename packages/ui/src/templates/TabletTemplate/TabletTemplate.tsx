import { AppHeader } from "../../organisms/AppHeader/AppHeader";
import { AudioPlayer } from "../../organisms/AudioPlayer/AudioPlayer";
import { CommunityPanel } from "../../organisms/CommunityPanel/CommunityPanel";
import { Feed } from "../../organisms/Feed/Feed";
import { Navigation } from "../../organisms/Navigation/Navigation";
import type { DubPostProps } from "../../organisms/DubPost/DubPost";
import { desktopNavigation, templatePosts } from "../TemplateContent";
import "../TemplateFrame.css";
import "./TabletTemplate.css";

export interface TabletTemplateProps {
  posts?: DubPostProps[];
  userName?: string;
  className?: string;
}

export function TabletTemplate({
  className,
  posts = templatePosts,
  userName = "Meladee",
}: TabletTemplateProps) {
  return (
    <main
      className={["template-frame", "tablet-template", className]
        .filter(Boolean)
        .join(" ")}
    >
      <Navigation
        activeItem="Feed"
        hideOnMobile
        sections={desktopNavigation}
        userName={userName}
        variant="icons"
      />
      <div className="tablet-template__main">
        <AppHeader userName={userName} variant="compact" />
        <div className="tablet-template__body">
          <Feed
            posts={posts}
            userName={userName}
            variant="embedded"
          />
          <aside
            aria-label="Community activity"
            className="tablet-template__community"
          >
            <CommunityPanel />
          </aside>
        </div>
        <AudioPlayer
          track={{ title: "Alien", artist: "Malaa", duration: "03:42" }}
          variant="full"
        />
      </div>
    </main>
  );
}
