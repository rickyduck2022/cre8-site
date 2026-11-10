import { useMemo, useState } from "react";
import { MessageCircle, UserPlus, Users } from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { AListBadge } from "../../atoms/AListBadge/AListBadge";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { ArtistCard } from "../../molecules/ArtistCard/ArtistCard";
import { FriendLookup } from "../../organisms/FriendLookup/FriendLookup";
import type { Buddy, MemberSearchResult, Presence } from "../communityTypes";
import { PresenceIndicator } from "../shared/PresenceIndicator";
import "../CommunityPageTemplates.css";
import "./BuddyListTemplate.css";

export interface BuddySuggestion {
  username: string;
  displayName: string;
  genre: string;
  avatarUrl?: string;
  aListApproved?: boolean;
}

export interface BuddyListTemplateProps {
  buddies: Buddy[];
  suggestedMembers?: BuddySuggestion[];
  memberSearchResults?: MemberSearchResult[];
  isSearchingMembers?: boolean;
  memberSearchQuery?: string;
  onMemberSearchQueryChange?: (query: string) => void;
  onAddMatchedMember?: (member: MemberSearchResult) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  onAddFriend: (buddy: Buddy) => void;
  onOpenChat: (buddyId: string) => void;
  onRemoveFriend: (buddyId: string) => void;
  onSelectProfile: (username: string) => void;
}

export function BuddyListTemplate({
  buddies,
  suggestedMembers = [],
  memberSearchResults = [],
  isSearchingMembers = false,
  memberSearchQuery = "",
  onMemberSearchQueryChange,
  onAddMatchedMember,
  query = "",
  onQueryChange,
  onAddFriend,
  onOpenChat,
  onRemoveFriend,
  onSelectProfile,
}: BuddyListTemplateProps) {
  const [presenceFilter, setPresenceFilter] = useState<Presence | "all">("all");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredBuddies = useMemo(
    () =>
      buddies.filter((buddy) => {
        const matchesQuery = [buddy.username, buddy.displayName, buddy.genre]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery);
        return (
          matchesQuery &&
          (presenceFilter === "all" || buddy.presence === presenceFilter)
        );
      }),
    [buddies, normalizedQuery, presenceFilter],
  );
  const filteredSuggestions = useMemo(
    () => suggestedMembers.filter(
      (suggestion) =>
        !buddies.some((buddy) => buddy.username === suggestion.username),
    ),
    [buddies, suggestedMembers],
  );
  const buddyPagination = usePagination(
    filteredBuddies,
    `${normalizedQuery}|${presenceFilter}`,
  );
  const suggestionPagination = usePagination(filteredSuggestions);
  const onlineCount = buddies.filter((buddy) => buddy.presence === "online").length;
  const awayCount = buddies.filter((buddy) => buddy.presence === "away").length;
  const offlineCount = buddies.filter((buddy) => buddy.presence === "offline").length;

  return (
    <div className="buddy-list-template">
      <section className="page-intro">
        <div>
          <span className="eyebrow">YOUR PEOPLE</span>
          <h1>Friend List</h1>
          <p>Your friends, just like the good old days.</p>
        </div>
        <Button
          leadingIcon={<UserPlus />}
          onClick={() => document.getElementById("artist-lookup")?.focus()}
          size="small"
        >
          Find artists
        </Button>
      </section>

      <FriendLookup
        buddies={buddies}
        isSearching={isSearchingMembers}
        onAdd={(member) => onAddMatchedMember?.(member)}
        onOpenChat={onOpenChat}
        onOpenProfile={onSelectProfile}
        onQueryChange={onMemberSearchQueryChange ?? (() => undefined)}
        query={memberSearchQuery}
        results={memberSearchResults}
      />

      <div className="buddy-stats">
        <PresenceFilter
          count={onlineCount}
          isSelected={presenceFilter === "online"}
          label="Online"
          onClick={() =>
            setPresenceFilter(presenceFilter === "online" ? "all" : "online")
          }
          presence="online"
        />
        <PresenceFilter
          count={awayCount}
          isSelected={presenceFilter === "away"}
          label="Away"
          onClick={() =>
            setPresenceFilter(presenceFilter === "away" ? "all" : "away")
          }
          presence="away"
        />
        <PresenceFilter
          count={offlineCount}
          isSelected={presenceFilter === "offline"}
          label="Offline"
          onClick={() =>
            setPresenceFilter(presenceFilter === "offline" ? "all" : "offline")
          }
          presence="offline"
        />
      </div>

      <div className="buddy-list__search">
        <h2>Search friends</h2>
        <p>Filter your saved contacts by name or genre.</p>
        <SearchField
          aria-label="Search friends"
          onChange={(event) => onQueryChange?.(event.target.value)}
          placeholder="Search friends by name or genre"
          value={query}
        />
      </div>

      <section className="buddy-list" aria-label="Contacts">
        {buddyPagination.items.map((buddy) => (
          <article className="buddy-row" key={buddy.id}>
            <button
              aria-label={`View ${buddy.displayName}'s profile`}
              className={`buddy-row__avatar buddy-row__avatar--${buddy.presence}`}
              onClick={() => onSelectProfile(buddy.username)}
              type="button"
            >
              <Avatar
                name={buddy.displayName}
                size="medium"
                src={buddy.avatarUrl}
                status={buddy.presence === "offline" ? "inactive" : "active"}
              />
              <PresenceIndicator presence={buddy.presence} />
            </button>
            <button
              className="buddy-row__identity text-button"
              onClick={() => onSelectProfile(buddy.username)}
              type="button"
            >
              <strong>{buddy.displayName}{buddy.aListApproved && <AListBadge />}</strong>
              <span>@{buddy.username} · {buddy.genre}</span>
            </button>
            <Badge
              className={`presence-badge presence-badge--${buddy.presence}`}
              variant={buddy.presence === "online" ? "audio" : "default"}
            >
              {buddy.presence}
            </Badge>
            <div className="buddy-row__actions">
              <Button
                aria-label={`Message ${buddy.displayName}`}
                className="app-icon-button"
                leadingIcon={<MessageCircle />}
                onClick={() => onOpenChat(buddy.id)}
                size="small"
                variant="secondary"
              >
                <span className="sr-only">Message</span>
              </Button>
              <Button
                onClick={() => onRemoveFriend(buddy.id)}
                size="small"
                variant="tertiary"
              >
                Remove
              </Button>
            </div>
          </article>
        ))}
        {filteredBuddies.length === 0 && (
          <div className="empty-state">
            <Users aria-hidden="true" />
            <strong>No friends match</strong>
            <span>Try a different search or presence filter.</span>
          </div>
        )}
      </section>
      <Pagination
        itemCount={filteredBuddies.length}
        label="Friends"
        onPageChange={buddyPagination.setPage}
        onPageSizeChange={buddyPagination.setPageSize}
        page={buddyPagination.page}
        pageSize={buddyPagination.pageSize}
        totalPages={buddyPagination.totalPages}
      />

      <section className="discover-buddies">
        <div className="section-heading">
          <div>
            <span className="eyebrow">GOOD TUNES FIND GOOD PEOPLE</span>
            <h2>People you may know</h2>
          </div>
        </div>
        <div className="discover-buddies__grid">
          {suggestionPagination.items.map((suggestion) => (
              <article className="suggestion-card" key={suggestion.username}>
                <ArtistCard name={suggestion.displayName} username={suggestion.username} avatarUrl={suggestion.avatarUrl} aListApproved={suggestion.aListApproved} detail={suggestion.genre} onOpenProfile={onSelectProfile} size="medium" action={
                <Button
                  aria-label={`Add ${suggestion.displayName}`}
                  leadingIcon={<UserPlus />}
                  onClick={() =>
                    onAddFriend({
                      ...suggestion,
                      id: suggestion.username,
                      presence: "offline",
                      role: "Artist",
                      bio: "",
                      groups: [],
                    })
                  }
                  size="small"
                  variant="secondary"
                >
                  Add
                </Button>} />
              </article>
          ))}
        </div>
        <Pagination
          itemCount={filteredSuggestions.length}
          label="Suggested friends"
          onPageChange={suggestionPagination.setPage}
          onPageSizeChange={suggestionPagination.setPageSize}
          page={suggestionPagination.page}
          pageSize={suggestionPagination.pageSize}
          totalPages={suggestionPagination.totalPages}
        />
      </section>
    </div>
  );
}

interface PresenceFilterProps {
  count: number;
  isSelected: boolean;
  label: string;
  onClick: () => void;
  presence: Presence;
}

function PresenceFilter({
  count,
  isSelected,
  label,
  onClick,
  presence,
}: PresenceFilterProps) {
  return (
    <button
      aria-pressed={isSelected}
      className={`buddy-stat${isSelected ? " is-selected" : ""}`}
      onClick={onClick}
      type="button"
    >
      <PresenceIndicator presence={presence} />
      <strong>{count}</strong>
      <span>{label}</span>
    </button>
  );
}
