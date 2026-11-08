import { useState } from "react";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { SearchField } from "../SearchField/SearchField";
import type { Buddy } from "../../templates/communityTypes";
import "./FriendPicker.css";

export interface FriendPickerProps {
  buddies: Buddy[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  disabledIds?: string[];
}

export function FriendPicker({ buddies, selectedIds, onChange, disabled = false, disabledIds = [] }: FriendPickerProps) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const filtered = buddies.filter((buddy) =>
    [buddy.displayName, buddy.username].some((value) => value.toLocaleLowerCase().includes(needle)),
  );
  return (
    <div className="friend-picker">
      {buddies.length ? (
        <>
          <SearchField aria-label="Search friends" disabled={disabled} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search friends" value={query} />
          <fieldset className="friend-picker__list" disabled={disabled}>
            <legend>Choose friends</legend>
            {filtered.map((buddy) => (
              <label className="friend-picker__friend" key={buddy.id}>
                <input
                  checked={selectedIds.includes(buddy.id)}
                  disabled={disabledIds.includes(buddy.id)}
                  onChange={(event) => onChange(event.currentTarget.checked
                    ? [...selectedIds, buddy.id]
                    : selectedIds.filter((id) => id !== buddy.id))}
                  type="checkbox"
                />
                <span aria-hidden="true"><Avatar name={buddy.displayName} size="small" src={buddy.avatarUrl} /></span>
                <span><strong>{buddy.displayName}</strong><small>@{buddy.username}{disabledIds.includes(buddy.id) ? " · Sent" : ""}</small></span>
              </label>
            ))}
            {!filtered.length && <p className="friend-picker__hint">No friends match your search.</p>}
          </fieldset>
          <p className="friend-picker__hint">{selectedIds.length} {selectedIds.length === 1 ? "friend" : "friends"} selected</p>
        </>
      ) : <p className="friend-picker__hint">No friends yet. You can upload privately and share later from My Dubs.</p>}
    </div>
  );
}
