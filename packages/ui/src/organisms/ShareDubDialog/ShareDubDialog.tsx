import { useId, useState, type FormEvent } from "react";
import { MessageCircle } from "@craft/icons";
import { AListBadge } from "../../atoms/AListBadge/AListBadge";
import { Button } from "../../atoms/Button/Button";
import { FriendPicker } from "../../molecules/FriendPicker/FriendPicker";
import { ModalFooter } from "../../molecules/ModalFooter/ModalFooter";
import { Modal } from "../Modal/Modal";
import type { Buddy, Dub } from "../../templates/communityTypes";
import { shareDubToFriends } from "./shareDubToFriends";
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
  initialBuddyIds?: string[];
  initiallySentIds?: string[];
  initialFailure?: boolean;
}

export function ShareDubDialog({ dub, buddies, onClose, onFindFriends, onOpenChat, onSendMessage, initialBuddyIds = [], initiallySentIds = [], initialFailure = false }: ShareDubDialogProps) {
  const formId = useId();
  const [buddyIds, setBuddyIds] = useState<string[]>(initialBuddyIds);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(initialFailure);
  const [failedIds, setFailedIds] = useState<string[]>(initialFailure ? initialBuddyIds : []);
  const [sentIds, setSentIds] = useState<string[]>(initiallySentIds);
  const [complete, setComplete] = useState(false);
  const selectedIds = buddyIds.filter((id) => buddies.some((buddy) => buddy.id === id) && !sentIds.includes(id));
  const sentTo = buddies.filter((buddy) => sentIds.includes(buddy.id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIds.length || pending) return;
    setPending(true);
    setFailed(false);
    try {
      const result = await shareDubToFriends(selectedIds, dub.id, message.trim() || `Shared a dub: ${dub.title}`, onSendMessage);
      const outstanding = [...new Set([...failedIds.filter((id) => !result.sent.includes(id)), ...result.failed])];
      setSentIds((current) => [...current, ...result.sent]);
      setBuddyIds(outstanding);
      setFailed(outstanding.length > 0);
      setFailedIds(outstanding);
      setComplete(outstanding.length === 0);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal isOpen onClose={() => !pending && onClose()} title="Share with friends">
      {complete ? (
        <div className="share-dub-dialog__success" role="status">
          <MessageCircle aria-hidden="true" />
          <strong>Sent to {sentTo.map((buddy) => buddy.displayName).join(", ")}</strong>
          <p>{dub.title} is in {sentTo.length === 1 ? "your conversation" : "your conversations"}.</p>
          <ModalFooter>
            <Button onClick={onClose} variant="secondary">Done</Button>
            {sentTo.length === 1 && <Button onClick={() => onOpenChat(sentTo[0].id)}>Open conversation</Button>}
          </ModalFooter>
        </div>
      ) : (
        <form className="share-dub-dialog" id={formId} onSubmit={(event) => void submit(event)}>
          <div className="share-dub-dialog__track">
            <span>SHARING</span>
            <strong>{dub.title}</strong>
            <span>{dub.artist}{dub.artistAListApproved && <AListBadge />}</span>
          </div>
          <p className="share-dub-dialog__hint">
            {dub.distribution === "private"
              ? "Sending grants your friends private access. Unsend does not revoke it; manage access in My Dubs. Downloaded files cannot be recalled."
              : dub.distribution === "alist"
                ? "Only approved A-List members can open this dub."
                : "Your friends will receive this dub in Messenger."}
          </p>
          {buddies.length ? (
            <>
              <FriendPicker buddies={buddies} disabled={pending} disabledIds={sentIds} sharedIds={dub.sharedBuddyIds} allowSharedIds={failedIds} selectedIds={buddyIds} onChange={setBuddyIds} />
              <label className="share-dub-dialog__message">
                <span>Add a message <small>(optional)</small></span>
                <textarea disabled={pending} maxLength={2000} onChange={(event) => setMessage(event.currentTarget.value)} placeholder="Say something about this dub..." rows={2} value={message} />
              </label>
              {sentTo.length > 0 && <p className="share-dub-dialog__hint" role="status">Already sent to {sentTo.map((buddy) => buddy.displayName).join(", ")}.</p>}
              {failed && <p className="share-dub-dialog__error" role="alert">Could not send to {buddies.filter((buddy) => failedIds.includes(buddy.id)).map((buddy) => buddy.displayName).join(", ") || "some friends"}. Check the notification and retry selected friends.</p>}
              <ModalFooter>
                <Button disabled={pending} onClick={onClose} variant="secondary">Cancel</Button>
                <Button disabled={!selectedIds.length || pending} form={formId} loading={pending} type="submit">{failed ? "Retry selected" : "Send dub"}</Button>
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
