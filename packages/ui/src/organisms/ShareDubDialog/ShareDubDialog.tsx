import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, MessageCircle } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { FriendPicker } from "../../molecules/FriendPicker/FriendPicker";
import { ModalFooter } from "../../molecules/ModalFooter/ModalFooter";
import { Modal } from "../Modal/Modal";
import { AudioPlayer } from "../AudioPlayer/AudioPlayer";
import { TrackArtwork } from "../../templates/shared/TrackArtwork";
import type { Buddy, Dub } from "../../types/domain";
import { shareDubToFriends } from "./shareDubToFriends";
import { useAsyncSubmission } from "../../utils/useAsyncSubmission";
import "./ShareDubDialog.css";

export function canShareDub(dub: Dub, username: string): boolean {
  return dub.distribution !== "private" || dub.uploader === username;
}

export function canShareDubExternally(dub: Dub): boolean {
  return dub.distribution === "worldwide" || (dub.distribution === "alist" && dub.aListPublic === true);
}

export interface ShareDubDialogProps {
  dub: Dub;
  buddies: Buddy[];
  friends?: Buddy[];
  onClose: () => void;
  onFindFriends: () => void;
  onOpenChat: (buddyId: string) => void;
  onOpenProfile?: (username: string) => void;
  onPlay: (dub: Dub) => void;
  onSeekProgress?: (progress: number, dub: Dub) => void;
  isCurrentTrack?: boolean;
  isPlaying?: boolean;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  playbackError?: string | null;
  onSendMessage: (buddyId: string, text: string, dubId: string) => boolean | Promise<boolean>;
  initialBuddyIds?: string[];
  initiallySentIds?: string[];
  initialFailure?: boolean;
  externalShareUrl?: string;
  onUpdatePreview?: (seconds: number) => Promise<void>;
}

export function ShareDubDialog({ dub, buddies, friends = buddies, onClose, onFindFriends, onOpenChat, onOpenProfile, onPlay, onSeekProgress, isCurrentTrack = false, isPlaying = false, currentTimeSeconds = 0, durationSeconds, playbackError, onSendMessage, initialBuddyIds = [], initiallySentIds = [], initialFailure = false, externalShareUrl, onUpdatePreview }: ShareDubDialogProps) {
  const formId = useId();
  const [recipients] = useState(buddies);
  const restrictedAList = dub.distribution === "alist" && dub.aListPublic !== true;
  const [buddyIds, setBuddyIds] = useState<string[]>(initialBuddyIds);
  const [message, setMessage] = useState("");
  const submission = useAsyncSubmission("The dub could not be sent. Please try again.");
  const previewSubmission = useAsyncSubmission("The preview length could not be saved. Please try again.");
  const pending = submission.pending || previewSubmission.pending;
  const close = () => previewSubmission.requestClose(() => submission.requestClose(onClose));
  const [previewSeconds, setPreviewSeconds] = useState(dub.previewSeconds ?? 30);
  const [savedPreviewSeconds, setSavedPreviewSeconds] = useState(dub.previewSeconds ?? 30);
  const [previewSaved, setPreviewSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<"friends" | "external">("friends");
  const friendsTabId = useId();
  const friendsPanelId = useId();
  const externalTabId = useId();
  const externalPanelId = useId();
  useEffect(() => {
    setPreviewSeconds(dub.previewSeconds ?? 30);
    setSavedPreviewSeconds(dub.previewSeconds ?? 30);
  }, [dub.previewSeconds]);
  const [failed, setFailed] = useState(initialFailure);
  const [failedIds, setFailedIds] = useState<string[]>(initialFailure ? initialBuddyIds : []);
  const [sentIds, setSentIds] = useState<string[]>(initiallySentIds);
  const [complete, setComplete] = useState(false);
  const selectedIds = buddyIds.filter((id) => recipients.some((buddy) => buddy.id === id) && !sentIds.includes(id));
  const sentTo = recipients.filter((buddy) => sentIds.includes(buddy.id));
  const [copied, setCopied] = useState(false);
  const copySubmission = useAsyncSubmission("We couldn't copy the link. Select it above and copy it manually.");

  async function savePreview() {
    if (!onUpdatePreview) return;
    setPreviewSaved(false);
    setCopied(false);
    if (await previewSubmission.run(() => onUpdatePreview(previewSeconds))) {
      setSavedPreviewSeconds(previewSeconds);
      setPreviewSaved(true);
    }
  }

  async function copyExternalLink() {
    if (!externalShareUrl || !canShareDubExternally(dub)) return;
    setCopied(false);
    if (await copySubmission.run(async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error();
        await navigator.clipboard.writeText(externalShareUrl);
      } catch {
        throw new Error("We couldn't copy the link. Select it above and copy it manually.");
      }
    })) setCopied(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIds.length || pending) return;
    setFailed(false);
    await submission.run(async () => {
      const result = await shareDubToFriends(selectedIds, dub.id, message.trim() || `Shared a dub: ${dub.title}`, onSendMessage);
      const outstanding = [...new Set([...failedIds.filter((id) => !result.sent.includes(id)), ...result.failed])];
      setSentIds((current) => [...current, ...result.sent]);
      setBuddyIds(outstanding);
      setFailed(outstanding.length > 0);
      setFailedIds(outstanding);
      setComplete(outstanding.length === 0);
    });
  }

  const friendContent = complete ? (
    <div className="share-dub-dialog__success" role="status">
      <MessageCircle aria-hidden="true" />
      <strong>Sent to {sentTo.map((buddy) => buddy.displayName).join(", ")}</strong>
      <p>{dub.title} is in {sentTo.length === 1 ? "your conversation" : "your conversations"}.</p>
      <ModalFooter>
        <Button disabled={pending} onClick={close} variant="secondary">Done</Button>
        {sentTo.length === 1 && <Button disabled={pending} onClick={() => onOpenChat(sentTo[0].id)}>Open conversation</Button>}
      </ModalFooter>
    </div>
  ) : (
    <form aria-busy={pending} className="share-dub-dialog" id={formId} onSubmit={(event) => void submit(event)}>
      <h2 className="share-dub-dialog__section-title">{restrictedAList ? "Share with A-List members" : "Share with friends"}</h2>
      <div className="share-dub-dialog__track">
        <span>SHARING</span>
        <AudioPlayer
          variant="inline"
          distribution={dub.distribution ?? "worldwide"}
          track={{
            title: dub.title,
            artist: dub.artist,
            artistAListApproved: dub.artistAListApproved,
            artworkContent: <TrackArtwork dub={dub} />,
            duration: dub.duration,
            onArtistClick: onOpenProfile && !pending ? () => onOpenProfile(dub.uploader) : undefined,
          }}
          playing={isCurrentTrack && isPlaying}
          currentTimeSeconds={isCurrentTrack ? currentTimeSeconds : 0}
          durationSeconds={isCurrentTrack ? durationSeconds : undefined}
          playbackError={isCurrentTrack ? playbackError : undefined}
          onPlayChange={() => onPlay(dub)}
          onSeekProgress={onSeekProgress ? (progress) => onSeekProgress(progress, dub) : undefined}
        />
      </div>
      <p className="share-dub-dialog__hint">
        {dub.distribution === "private"
          ? "Sending grants your friends private access. Unsend does not revoke it; manage access in My Dubs. Downloaded files cannot be recalled."
          : restrictedAList
            ? "Only approved A-List members can open this dub. Sending to a non-friend adds them to your Friend List."
            : "Your friends will receive this dub in Messenger."}
      </p>
      {recipients.length ? (
        <>
          <FriendPicker buddies={recipients} label={restrictedAList ? "A-List members" : "friends"} disabled={pending} disabledIds={sentIds} sharedIds={restrictedAList ? friends.filter((buddy) => buddy.userId && dub.sharedBuddyIds?.includes(buddy.id)).map((buddy) => `member:${buddy.userId}`) : dub.sharedBuddyIds} allowSharedIds={failedIds} selectedIds={buddyIds} onChange={setBuddyIds} />
          <label className="share-dub-dialog__message">
            <span>Add a message <small>(optional)</small></span>
            <textarea disabled={pending} maxLength={2000} onChange={(event) => setMessage(event.currentTarget.value)} placeholder="Say something about this dub..." rows={2} value={message} />
          </label>
          {sentTo.length > 0 && <p className="share-dub-dialog__hint" role="status">Already sent to {sentTo.map((buddy) => buddy.displayName).join(", ")}.</p>}
          {failed && <p className="share-dub-dialog__error" role="alert">Could not send to {recipients.filter((buddy) => failedIds.includes(buddy.id)).map((buddy) => buddy.displayName).join(", ") || "some recipients"}. Check the notification and retry selected recipients.</p>}
          {submission.error && <p className="share-dub-dialog__error" role="alert">{submission.error}</p>}
          <ModalFooter>
            <Button disabled={pending} onClick={close} variant="secondary">Cancel</Button>
            <Button disabled={!selectedIds.length || pending} form={formId} loading={pending} type="submit">{failed ? "Retry selected" : "Send dub"}</Button>
          </ModalFooter>
        </>
      ) : (
        <div className="share-dub-dialog__empty">
          <strong>{restrictedAList ? "No approved A-List members available" : "Start with a friend"}</strong>
          <p>{restrictedAList ? "There are no eligible members to share with right now." : "Add someone to your Friend List, then send them this dub."}</p>
          <Button disabled={pending} onClick={onFindFriends} type="button">Find friends</Button>
        </div>
      )}
    </form>
  );

  const externalContent = (
    <section className="share-dub-dialog__external" aria-label="External link">
      <h2 className="share-dub-dialog__section-title">Share externally</h2>
      {canShareDubExternally(dub) ? (
        <>
          <p className="share-dub-dialog__hint">Logged-out listeners hear a {savedPreviewSeconds}-second preview. Sign in for the full dub and downloads.</p>
          {onUpdatePreview ? (
            <>
              <label className="share-dub-dialog__preview">
                <span>Logged-out preview length</span>
                <select value={previewSeconds} disabled={pending} onChange={(event) => {
                  setPreviewSeconds(Number(event.currentTarget.value));
                  setPreviewSaved(false);
                  setCopied(false);
                }}>
                  {[30, 60, 90].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
                </select>
              </label>
              <p className="share-dub-dialog__hint">Your setting applies to every external link for this dub. Previews start at the beginning.</p>
              <Button variant="secondary" disabled={pending || previewSeconds === savedPreviewSeconds} loading={previewSubmission.pending} onClick={() => void savePreview()}>Save preview length</Button>
              {previewSubmission.error && <p className="share-dub-dialog__error" role="alert">{previewSubmission.error}</p>}
              {previewSaved && <p role="status">Preview length saved for all external links.</p>}
            </>
          ) : <p className="share-dub-dialog__hint">The uploader controls the preview length.</p>}
          <label>
            <span className="sr-only">External share link</span>
            <input readOnly value={externalShareUrl} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <Button disabled={pending || copySubmission.pending || previewSeconds !== savedPreviewSeconds} loading={copySubmission.pending} leadingIcon={<Link aria-hidden="true" />} onClick={() => void copyExternalLink()} variant="secondary">Copy link</Button>
          {copied && <p role="status">Link copied.</p>}
          {copySubmission.error && <p className="share-dub-dialog__error" role="alert">{copySubmission.error}</p>}
        </>
      ) : <p className="share-dub-dialog__hint">External links are only available for worldwide and public A-List dubs. This dub stays protected.</p>}
    </section>
  );

  function navigateSections(event: KeyboardEvent<HTMLButtonElement>) {
    if (pending) return;
    const sections = ["friends", "external"] as const;
    const currentIndex = sections.indexOf(activeSection);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % sections.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex + sections.length - 1) % sections.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = sections.length - 1;
    else return;
    event.preventDefault();
    const next = sections[nextIndex];
    setActiveSection(next);
    document.getElementById(next === "friends" ? friendsTabId : externalTabId)?.focus();
  }

  return (
    <Modal isOpen onClose={close} closeDisabled={pending} title={`Share ${dub.title}`}>
      {externalShareUrl && (
        <div aria-label="Sharing options" className="share-dub-dialog__tabs" role="tablist">
          <Button aria-controls={friendsPanelId} aria-selected={activeSection === "friends"} disabled={pending} id={friendsTabId} onClick={() => setActiveSection("friends")} onKeyDown={navigateSections} role="tab" tabIndex={activeSection === "friends" ? 0 : -1} type="button" variant={activeSection === "friends" ? "primary" : "secondary"}>
            {restrictedAList ? "A-List members" : "Friends"}
          </Button>
          <Button aria-controls={externalPanelId} aria-selected={activeSection === "external"} disabled={pending} id={externalTabId} onClick={() => setActiveSection("external")} onKeyDown={navigateSections} role="tab" tabIndex={activeSection === "external" ? 0 : -1} type="button" variant={activeSection === "external" ? "primary" : "secondary"}>
            External link
          </Button>
        </div>
      )}
      {externalShareUrl ? (
        <>
          <div aria-labelledby={friendsTabId} className="share-dub-dialog__tabpanel" hidden={activeSection !== "friends"} id={friendsPanelId} role="tabpanel">
            {friendContent}
          </div>
          <div aria-labelledby={externalTabId} className="share-dub-dialog__tabpanel" hidden={activeSection !== "external"} id={externalPanelId} role="tabpanel">
            {externalContent}
          </div>
        </>
      ) : friendContent}
    </Modal>
  );
}
