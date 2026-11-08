import { useId, useState, type FormEvent } from "react";
import { MessageCircle } from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Button } from "../../atoms/Button/Button";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { ModalFooter } from "../../molecules/ModalFooter/ModalFooter";
import { Modal } from "../Modal/Modal";
import type { Buddy, Dub } from "../../templates/communityTypes";
import "./ShareDubDialog.css";

export function canShareDub(dub: Dub, username: string): boolean {
  return dub.distribution !== "private" || dub.uploader === username;
}

export interface ShareDubDialogProps {
  dub: Dub;
  buddies: Buddy[];
  onClose: () => void;
  onFindFriends: () => void;
  onOpenChat: (buddyId: string) => void;
  onSendMessage: (buddyId: string, text: string, dubId: string) => boolean | Promise<boolean>;
}

export function ShareDubDialog({ dub, buddies, onClose, onFindFriends, onOpenChat, onSendMessage }: ShareDubDialogProps) {
  const formId = useId();
  const [query, setQuery] = useState("");
  const [buddyId, setBuddyId] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sentTo, setSentTo] = useState<Buddy | null>(null);
  const selectedBuddy = buddies.find((buddy) => buddy.id === buddyId);
  const needle = query.trim().toLocaleLowerCase();
  const filteredBuddies = buddies.filter((buddy) =>
    [buddy.displayName, buddy.username].some((value) => value.toLocaleLowerCase().includes(needle)),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBuddy || pending) return;
    setPending(true);
    setFailed(false);
    try {
      if (await onSendMessage(selectedBuddy.id, message.trim() || `Shared a dub: ${dub.title}`, dub.id)) {
        setSentTo(selectedBuddy);
      } else {
        setFailed(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal isOpen onClose={() => !pending && onClose()} title="Share with a friend">
      {sentTo ? (
        <div className="share-dub-dialog__success" role="status">
          <MessageCircle aria-hidden="true" />
          <strong>Sent to {sentTo.displayName}</strong>
          <p>{dub.title} is in your conversation.</p>
          <ModalFooter>
            <Button onClick={onClose} variant="secondary">Done</Button>
            <Button onClick={() => onOpenChat(sentTo.id)}>Open conversation</Button>
          </ModalFooter>
        </div>
      ) : (
        <form className="share-dub-dialog" id={formId} onSubmit={(event) => void submit(event)}>
          <div className="share-dub-dialog__track">
            <span>SHARING</span>
            <strong>{dub.title}</strong>
            <span>{dub.artist}</span>
          </div>
          <p className="share-dub-dialog__hint">
            {dub.distribution === "private"
              ? "Sending grants your friend private access. Unsend does not revoke it; manage access in My Dubs. Downloaded files cannot be recalled."
              : dub.distribution === "alist"
                ? "Only approved A-List members can open this dub."
                : "Your friend will receive this dub in Messenger."}
          </p>
          {buddies.length ? (
            <>
              <SearchField aria-label="Search friends" onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search friends" value={query} />
              <fieldset className="share-dub-dialog__friends">
                <legend>Choose a friend</legend>
                {filteredBuddies.map((buddy) => (
                  <label className="share-dub-dialog__friend" key={buddy.id}>
                    <input checked={buddyId === buddy.id} name="friend" onChange={() => setBuddyId(buddy.id)} type="radio" value={buddy.id} />
                    <span aria-hidden="true"><Avatar name={buddy.displayName} size="small" src={buddy.avatarUrl} /></span>
                    <span><strong>{buddy.displayName}</strong><small>@{buddy.username}</small></span>
                  </label>
                ))}
                {!filteredBuddies.length && <p className="share-dub-dialog__hint">No friends match your search.</p>}
              </fieldset>
              {selectedBuddy && <p className="share-dub-dialog__hint">Sending to {selectedBuddy.displayName} (@{selectedBuddy.username})</p>}
              <label className="share-dub-dialog__message">
                <span>Add a message <small>(optional)</small></span>
                <textarea maxLength={2000} onChange={(event) => setMessage(event.currentTarget.value)} placeholder="Say something about this dub..." rows={2} value={message} />
              </label>
              {failed && <p className="share-dub-dialog__error" role="alert">Could not send this dub. Check the notification and try again.</p>}
              <ModalFooter>
                <Button disabled={pending} onClick={onClose} variant="secondary">Cancel</Button>
                <Button disabled={!selectedBuddy || pending} form={formId} loading={pending} type="submit">Send dub</Button>
              </ModalFooter>
            </>
          ) : (
            <div className="share-dub-dialog__empty">
              <strong>Start with a friend</strong>
              <p>Add someone to your Friend List, then send them this dub.</p>
              <Button onClick={onFindFriends} type="button">Find friends</Button>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
