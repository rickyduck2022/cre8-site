import { useState } from "react";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { AListBadge } from "../../atoms/AListBadge/AListBadge";
import { Button } from "../../atoms/Button/Button";
import { SearchField } from "../SearchField/SearchField";
import type { Buddy } from "../../templates/communityTypes";
import "./FriendPicker.css";

export interface FriendPickerProps {
  buddies: Buddy[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  disabledIds?: string[];
  sharedIds?: string[];
  allowSharedIds?: string[];
}

export function FriendPicker({ buddies, selectedIds, onChange, disabled = false, disabledIds = [], sharedIds = [], allowSharedIds = [] }: FriendPickerProps) {
  const [query, setQuery] = useState("");
  const [reshareIds, setReshareIds] = useState<string[]>([]);
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
            {filtered.map((buddy) => {
              const alreadyShared = sharedIds.includes(buddy.id) && !reshareIds.includes(buddy.id) && !allowSharedIds.includes(buddy.id);
              const sent = disabledIds.includes(buddy.id);
              return (
                <div className="friend-picker__friend" key={buddy.id}>
                  <label className="friend-picker__identity">
                    <input
                      checked={selectedIds.includes(buddy.id)}
                      disabled={sent || alreadyShared}
                      onChange={(event) => onChange(event.currentTarget.checked
                        ? [...selectedIds, buddy.id]
                        : selectedIds.filter((id) => id !== buddy.id))}
                      type="checkbox"
                    />
                    <span aria-hidden="true"><Avatar name={buddy.displayName} size="small" src={buddy.avatarUrl} /></span>
                    <span><strong>{buddy.displayName}{buddy.aListApproved && <AListBadge />}</strong><small>@{buddy.username}{sent ? " · Sent" : alreadyShared ? " · Shared" : ""}</small></span>
                  </label>
                  {alreadyShared && !sent && (
                    <Button
                      aria-label={`Share again with ${buddy.displayName}`}
                      disabled={disabled}
                      onClick={() => {
                        setReshareIds((current) => [...current, buddy.id]);
                        if (!selectedIds.includes(buddy.id)) onChange([...selectedIds, buddy.id]);
                      }}
                      size="small"
                      variant="secondary"
                    >
                      Share again
                    </Button>
                  )}
                </div>
              );
            })}
            {!filtered.length && <p className="friend-picker__hint">No friends match your search.</p>}
          </fieldset>
          <p className="friend-picker__hint">{selectedIds.length} {selectedIds.length === 1 ? "friend" : "friends"} selected</p>
        </>
      ) : <p className="friend-picker__hint">No friends yet. Add friends to share dubs in Messenger.</p>}
    </div>
  );
}
