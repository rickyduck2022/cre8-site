import { AppHeader } from "../../organisms/AppHeader/AppHeader";
import { AudioPlayer } from "../../organisms/AudioPlayer/AudioPlayer";
import { CommunityPanel } from "../../organisms/CommunityPanel/CommunityPanel";
import { Feed } from "../../organisms/Feed/Feed";
import { Navigation } from "../../organisms/Navigation/Navigation";
import type { DubPostProps } from "../../organisms/DubPost/DubPost";
import {
  mobileNavigation,
  templatePosts,
} from "../TemplateContent";
import "../TemplateFrame.css";
import "./MobileTemplate.css";

export interface MobileTemplateProps {
  posts?: DubPostProps[];
  userName?: string;
  className?: string;
  showCommunity?: boolean;
}

export function MobileTemplate({
  className,
  posts = templatePosts,
  showCommunity = true,
  userName = "Meladee",
}: MobileTemplateProps) {
  return (
    <main
      className={["template-frame", "mobile-template", className]
        .filter(Boolean)
        .join(" ")}
    >
      <AppHeader
        userName={userName}
        variant="mobile"
      />
      <div className="mobile-template__body">
        <Feed
          posts={posts}
          userName={userName}
          variant="mobile"
        />
        {showCommunity && (
          <aside
            aria-label="Community activity"
            className="mobile-template__community"
          >
            <CommunityPanel />
          </aside>
        )}
      </div>
      <footer aria-label="Playback and navigation" className="mobile-template__footer">
        <AudioPlayer
          track={{ title: "Alien", artist: "Malaa", duration: "03:42" }}
          variant="full"
        />
        <Navigation
          activeItem="Feed"
          sections={mobileNavigation}
          variant="horizontal"
        />
      </footer>
    </main>
  );
}
