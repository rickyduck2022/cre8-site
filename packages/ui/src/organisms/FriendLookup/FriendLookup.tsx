import { MessageCircle, UserPlus } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { ArtistCard } from "../../molecules/ArtistCard/ArtistCard";
import { SearchField } from "../../molecules/SearchField/SearchField";
import type { Buddy, MemberSearchResult } from "../../types/domain";
import "../Organisms.css";
import "./FriendLookup.css";

export interface FriendLookupProps {
  query: string;
  results: MemberSearchResult[];
  isSearching?: boolean;
  onQueryChange: (query: string) => void;
  onAdd: (member: MemberSearchResult) => void;
  onOpenProfile?: (username: string) => void;
  buddies?: Pick<Buddy, "id" | "username">[];
  onOpenChat?: (buddyId: string) => void;
}

export function FriendLookup({ buddies = [], isSearching = false, onAdd, onOpenChat, onOpenProfile, onQueryChange, query, results }: FriendLookupProps) {
  return (
    <section aria-label="Find artists" className="friend-lookup">
      <h2>Find artists</h2>
      <p className="friend-lookup__hint">Search all artists by username or ID to add new friends.</p>
      <SearchField
        aria-label="Find artists by username or ID"
        autoComplete="off"
        id="artist-lookup"
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        placeholder="Paste an artist username or ID"
        value={query}
      />
      {isSearching && <p role="status">Searching artists…</p>}
      {query.trim().length >= 2 && !isSearching && (
        results.length ? (
          <ul className="friend-lookup__results" aria-label="Matching artists">
            {results.map((member) => {
              const buddy = buddies.find((contact) => contact.username === member.username);
              return (
                <li key={member.id}>
                  <ArtistCard
                    name={member.displayName}
                    username={member.username}
                    avatarUrl={member.avatarUrl}
                    aListApproved={member.aListApproved}
                    detail={`ID: ${member.id}${member.artistId ? ` · Artist: ${member.artistId}` : ""}`}
                    onOpenProfile={onOpenProfile}
                    action={buddy ? (
                      <div className="friend-lookup__actions">
                        <Badge>Added</Badge>
                        {onOpenChat && (
                          <Button
                            aria-label={`Message ${member.displayName}`}
                            leadingIcon={<MessageCircle />}
                            onClick={() => onOpenChat(buddy.id)}
                            size="small"
                            variant="secondary"
                          >Message</Button>
                        )}
                      </div>
                    ) : (
                      <Button
                        aria-label={`Add ${member.displayName}`}
                        leadingIcon={<UserPlus />}
                        onClick={() => onAdd(member)}
                        size="small"
                        variant="secondary"
                      >Add friend</Button>
                    )}
                  />
                </li>
              );
            })}
          </ul>
        ) : <p className="friend-lookup__empty" role="status">No artists found. Check the username or ID.</p>
      )}
    </section>
  );
}
