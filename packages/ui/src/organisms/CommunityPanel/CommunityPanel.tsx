import { CircleShortcut } from "../../molecules/CircleShortcut/CircleShortcut";
import type { FriendRequestProps } from "../../molecules/FriendRequest/FriendRequest";
import type { SuggestedFriendProps } from "../../molecules/SuggestedFriend/SuggestedFriend";
import { FriendDiscovery } from "../FriendDiscovery/FriendDiscovery";
import { FriendRequests } from "../FriendRequests/FriendRequests";
import { InviteCard } from "../InviteCard/InviteCard";
import {
  OnlineFriends,
  type OnlineFriendsGroup,
} from "../OnlineFriends/OnlineFriends";
import "../Organisms.css";

const defaultRequests: FriendRequestProps[] = [
  { name: "Serena", detail: "2 mutual friends" },
  { name: "Malaa", detail: "Friend request" },
];

const defaultSuggestions: SuggestedFriendProps[] = [
  { name: "Dickey", detail: "Shared music taste" },
  { name: "Kaskade", detail: "3 mutual friends" },
];

const defaultOnlineGroups: OnlineFriendsGroup[] = [
  {
    title: "In the studio",
    friends: [{ name: "MelaDee" }, { name: "Evan" }, { name: "Kai" }],
  },
  {
    title: "What's good",
    friends: [{ name: "Serena" }, { name: "Malaa" }],
  },
];

export interface CommunityPanelProps {
  variant?: "default" | "sidebar";
  circleName?: string;
  circleDetail?: string;
  circleMembers?: string[];
  requests?: FriendRequestProps[];
  suggestions?: SuggestedFriendProps[];
  onlineGroups?: OnlineFriendsGroup[];
  className?: string;
}

export function CommunityPanel({
  circleDetail = "Your friends and their latest dubs",
  circleMembers = ["MelaDee", "Evan", "Serena"],
  circleName = "Your circle",
  className,
  variant = "default",
  onlineGroups = defaultOnlineGroups,
  requests = defaultRequests,
  suggestions = defaultSuggestions,
}: CommunityPanelProps) {
  return (
    <section
      aria-label="Community"
      className={[
        "organism-card",
        "community-panel",
        variant !== "default" && `community-panel--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="community-panel__section community-panel__section--circle organism-card">
        <CircleShortcut
          count={circleMembers.length}
          detail={circleDetail}
          members={circleMembers}
          name={circleName}
        />
      </div>
      <div className="community-panel__section">
        <FriendRequests requests={requests} />
      </div>
      <div className="community-panel__section community-panel__section--wide">
        <FriendDiscovery friends={suggestions} />
      </div>
      <div className="community-panel__section community-panel__section--wide">
        <OnlineFriends groups={onlineGroups} />
      </div>
      <div className="community-panel__section community-panel__section--invite">
        <InviteCard />
      </div>
    </section>
  );
}
