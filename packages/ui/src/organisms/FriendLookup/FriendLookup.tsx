import { UserPlus } from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Button } from "../../atoms/Button/Button";
import { SearchField } from "../../molecules/SearchField/SearchField";
import type { MemberSearchResult } from "../../templates/communityTypes";
import "../Organisms.css";

export interface FriendLookupProps {
  query: string;
  results: MemberSearchResult[];
  isSearching?: boolean;
  onQueryChange: (query: string) => void;
  onAdd: (member: MemberSearchResult) => void;
}

export function FriendLookup({ isSearching = false, onAdd, onQueryChange, query, results }: FriendLookupProps) {
  return (
    <section aria-label="Find an artist" className="friend-lookup">
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
            {results.map((member) => (
              <li key={member.id}>
                <Avatar
                  className="friend-lookup__avatar"
                  name={member.displayName}
                  size="small"
                  src={member.avatarUrl}
                />
                <span className="friend-lookup__result-copy">
                  <strong>{member.displayName}</strong>
                  <small>@{member.username} · ID: {member.id}{member.artistId ? ` · Artist: ${member.artistId}` : ""}</small>
                </span>
                <Button
                  aria-label={`Add ${member.displayName}`}
                  leadingIcon={<UserPlus />}
                  onClick={() => onAdd(member)}
                  size="small"
                  variant="secondary"
                >Add friend</Button>
              </li>
            ))}
          </ul>
        ) : <p className="friend-lookup__empty" role="status">No artists found. Check the username or ID.</p>
      )}
    </section>
  );
}
