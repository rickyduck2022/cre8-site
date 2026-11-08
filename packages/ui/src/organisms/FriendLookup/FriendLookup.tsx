import { UserPlus } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { ArtistCard } from "../../molecules/ArtistCard/ArtistCard";
import { SearchField } from "../../molecules/SearchField/SearchField";
import type { MemberSearchResult } from "../../templates/communityTypes";
import "../Organisms.css";

export interface FriendLookupProps {
  query: string;
  results: MemberSearchResult[];
  isSearching?: boolean;
  onQueryChange: (query: string) => void;
  onAdd: (member: MemberSearchResult) => void;
  onOpenProfile?: (username: string) => void;
}

export function FriendLookup({ isSearching = false, onAdd, onOpenProfile, onQueryChange, query, results }: FriendLookupProps) {
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
                <ArtistCard name={member.displayName} username={member.username} avatarUrl={member.avatarUrl} aListApproved={member.aListApproved} detail={`ID: ${member.id}${member.artistId ? ` · Artist: ${member.artistId}` : ""}`} onOpenProfile={onOpenProfile} action={<Button
                  aria-label={`Add ${member.displayName}`}
                  leadingIcon={<UserPlus />}
                  onClick={() => onAdd(member)}
                  size="small"
                  variant="secondary"
                >Add friend</Button>} />
              </li>
            ))}
          </ul>
        ) : <p className="friend-lookup__empty" role="status">No artists found. Check the username or ID.</p>
      )}
    </section>
  );
}
