import { useState } from "react";
import { MessageCircle } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { FriendPicker } from "../../molecules/FriendPicker/FriendPicker";
import { ModalFooter } from "../../molecules/ModalFooter/ModalFooter";
import { Modal } from "../Modal/Modal";
import { useAsyncSubmission } from "../../utils/useAsyncSubmission";
import { DubPackIdentity, packTypeLabel } from "./DubPackCard";
import type { Buddy, DubPack } from "../../types/domain";

export function canSharePack(pack: DubPack, username: string) {
  return pack.status === "published" && (pack.distribution !== "private" || pack.ownerUsername === username);
}

export interface SharePackDialogProps {
  pack: DubPack;
  buddies: Buddy[];
  onClose: () => void;
  onSend: (buddyId: string, pack: DubPack, confirmAccess: boolean) => Promise<boolean>;
  initialBuddyIds?: string[];
}

export function SharePackDialog({ pack, buddies, onClose, onSend, initialBuddyIds = [] }: SharePackDialogProps) {
  const [selected, setSelected] = useState<string[]>(initialBuddyIds);
  const [sent, setSent] = useState<string[]>([]);
  const [confirmAccess, setConfirmAccess] = useState(false);
  const submission = useAsyncSubmission("The pack could not be sent. Please try again.");
  const eligible = buddies.filter((buddy) => pack.distribution !== "alist" || pack.aListPublic || buddy.aListApproved);
  const privatePack = pack.distribution === "private";
  async function send() {
    await submission.run(async () => {
      const failed: string[] = [];
      for (const id of selected) {
        if (await onSend(id, pack, confirmAccess)) {
          setSent((current) => [...current, id]);
          setSelected((current) => current.filter((value) => value !== id));
        }
        else failed.push(id);
      }
      setSelected(failed);
      if (failed.length) throw new Error("Some friends did not receive the pack. Retry the remaining recipients.");
    });
  }
  return <Modal isOpen title={`Share ${packTypeLabel(pack.kind)}`} onClose={() => submission.requestClose(onClose)}>
    <DubPackIdentity pack={pack} compact />
    <p>Send this pack to a friend in Messenger.</p>
    <FriendPicker buddies={eligible} selectedIds={selected} onChange={setSelected} disabled={submission.pending} disabledIds={sent} />
    {privatePack && <label className="share-pack__confirmation"><input type="checkbox" checked={confirmAccess} disabled={submission.pending}
      onChange={(event) => setConfirmAccess(event.currentTarget.checked)} />Grant selected friends access to all current files in this private pack.</label>}
    {sent.length > 0 && <p role="status">Pack sent to {eligible.filter((buddy) => sent.includes(buddy.id)).map((buddy) => buddy.displayName).join(", ")}.</p>}
    {submission.error && <p role="alert">{submission.error}</p>}
    <ModalFooter>
      <Button variant="secondary" disabled={submission.pending} onClick={onClose}>Done</Button>
      <Button leadingIcon={<MessageCircle aria-hidden="true" />} loading={submission.pending}
        disabled={submission.pending || !selected.length || (privatePack && !confirmAccess)} onClick={() => void send()}>Send pack</Button>
    </ModalFooter>
  </Modal>;
}
