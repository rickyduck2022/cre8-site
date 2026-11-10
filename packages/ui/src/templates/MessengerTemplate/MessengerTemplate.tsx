import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Disc3,
  Download,
  Link,
  MessageCircle,
  MoreActions,
  Plus,
  Undo,
  Upload,
} from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { AListBadge } from "../../atoms/AListBadge/AListBadge";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { ChatComposer } from "../../molecules/ChatComposer/ChatComposer";
import { TrackMetadata } from "../../molecules/TrackMetadata/TrackMetadata";
import { TrackFileMetadata } from "../../molecules/TrackFileMetadata/TrackFileMetadata";
import { InfiniteScroll } from "../../molecules/InfiniteScroll/InfiniteScroll";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { AudioPlayer } from "../../organisms/AudioPlayer/AudioPlayer";
import { CompactDubCard } from "../../organisms/DubCard/DubCard";
import { Modal } from "../../organisms/Modal/Modal";
import { useMobileLayout } from "../../utils/useMobileLayout";
import { TrackArtwork } from "../shared/TrackArtwork";
import { PresenceIndicator } from "../shared/PresenceIndicator";
import { formatTime } from "../templateFormatters";
import type { Buddy, ChatConnectionStatus, Conversation, Dub } from "../communityTypes";
import "../CommunityPageTemplates.css";
import "./MessengerTemplate.css";

function SharePickerContainer({ mobile, onClose, children }: { mobile: boolean; onClose: () => void; children: ReactNode }) {
  if (mobile) {
    return <Modal isOpen onClose={onClose} title="Share one of My Dubs" className="share-a-dub__modal"><div id="share-a-dub-menu">{children}</div></Modal>;
  }
  return <div aria-label="My Dubs available to share" className="share-a-dub__popover" id="share-a-dub-menu" role="region">{children}</div>;
}

export interface MessengerTemplateProps {
  buddies: Buddy[];
  conversations: Conversation[];
  dubs: Dub[];
  shareableDubs?: Dub[];
  initialBuddyId: string;
  navigationKey?: number;
  chatConnectionStatus: ChatConnectionStatus;
  nowPlayingId: string | null;
  isPlaying: boolean;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  onSeek?: (timeSeconds: number, dub: Dub) => void;
  onSeekProgress?: (progress: number, dub: Dub) => void;
  volume?: number;
  shuffle?: boolean;
  repeat?: boolean;
  playbackError?: string | null;
  onVolumeChange?: (volume: number) => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onOpenProfile: (username: string) => void;
  onPlay: (dub: Dub) => void;
  onDownload?: (dub: Dub) => void;
  onStartConversation: () => void;
  onCreateAndShareDub?: (buddyId: string) => void;
  onSelectConversation: (buddyId: string) => void;
  onShowConversations?: () => void;
  onLoadOlderMessages: (buddyId: string, beforeId: string) => Promise<unknown>;
  onSendMessage: (
    buddyId: string,
    text: string,
    dubId?: string,
  ) => boolean | Promise<boolean>;
  onUnsendMessage?: (buddyId: string, messageId: string) => boolean | Promise<boolean>;
}

export function MessengerTemplate({
  buddies,
  conversations,
  chatConnectionStatus,
  dubs,
  shareableDubs = [],
  initialBuddyId,
  navigationKey = 0,
  nowPlayingId,
  isPlaying,
  currentTimeSeconds = 0,
  durationSeconds,
  onSeek,
  onSeekProgress,
  volume,
  shuffle,
  repeat,
  playbackError,
  onVolumeChange,
  onShuffleChange,
  onRepeatChange,
  onPrevious,
  onNext,
  onOpenProfile,
  onPlay,
  onDownload = () => undefined,
  onStartConversation,
  onCreateAndShareDub,
  onSelectConversation,
  onShowConversations,
  onLoadOlderMessages,
  onSendMessage,
  onUnsendMessage,
}: MessengerTemplateProps) {
  const [selectedBuddyId, setSelectedBuddyId] = useState(initialBuddyId);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(Boolean(initialBuddyId));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [visibleBuddyCount, setVisibleBuddyCount] = useState(20);
  const [visibleDubCount, setVisibleDubCount] = useState(20);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [shareQuery, setShareQuery] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const mobile = useMobileLayout();
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const conversationButtonsRef = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    setSelectedBuddyId(initialBuddyId);
    setMobileThreadOpen(Boolean(initialBuddyId));
  }, [initialBuddyId, navigationKey]);

  const selectedBuddy =
    buddies.find((buddy) => buddy.id === selectedBuddyId) ?? buddies[0];
  const selectedConversation = conversations.find(
    (conversation) => conversation.buddyId === selectedBuddy?.id,
  );
  const message = selectedBuddy ? drafts[selectedBuddy.id] ?? "" : "";
  const visibleBuddies = buddies.slice(0, visibleBuddyCount);
  const filteredDubs = shareableDubs.filter((dub) =>
    (dub.distribution !== "alist" || dub.aListPublic === true || selectedBuddy?.aListApproved === true)
    && [dub.title, dub.artist].some((value) => value.toLocaleLowerCase().includes(shareQuery.trim().toLocaleLowerCase())),
  );
  const visibleDubs = filteredDubs.slice(0, visibleDubCount);

  useEffect(() => {
    setLoadingOlder(false);
    setIsShareMenuOpen(false);
    setShareFailed(false);
    setShareQuery("");
  }, [selectedBuddy?.id]);

  useEffect(() => {
    if (!isShareMenuOpen || mobile) return;
    function handleOutsidePointer(event: PointerEvent) {
      if (!shareMenuRef.current?.contains(event.target as Node)) setIsShareMenuOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsShareMenuOpen(false);
      shareMenuTriggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isShareMenuOpen, mobile]);

  async function loadOlderMessages(): Promise<boolean> {
    const firstMessage = selectedConversation?.messages[0];
    if (!selectedBuddy || !firstMessage || loadingOlder) return false;
    setLoadingOlder(true);
    try {
      const result = await onLoadOlderMessages(selectedBuddy.id, firstMessage.id);
      return result !== null && result !== false;
    } finally {
      setLoadingOlder(false);
    }
  }

  function selectConversation(buddyId: string) {
    setSelectedBuddyId(buddyId);
    setMobileThreadOpen(true);
    onSelectConversation(buddyId);
    if (mobile) {
      requestAnimationFrame(() => backButtonRef.current?.focus({ preventScroll: true }));
    }
  }

  function showConversations() {
    setMobileThreadOpen(false);
    setIsShareMenuOpen(false);
    onShowConversations?.();
    if (selectedBuddy) {
      requestAnimationFrame(() => conversationButtonsRef.current.get(selectedBuddy.id)?.focus({ preventScroll: true }));
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!selectedBuddy || !text) return;
    const buddyId = selectedBuddy.id;
    if (await onSendMessage(buddyId, text)) {
      setDrafts((current) => current[buddyId] === message ? { ...current, [buddyId]: "" } : current);
    }
  }

  async function shareDub(dub: Dub) {
    if (!selectedBuddy || sharing) return;
    setSharing(true);
    setShareFailed(false);
    try {
      if (await onSendMessage(selectedBuddy.id, `Shared a dub: ${dub.title}`, dub.id)) {
        setIsShareMenuOpen(false);
      } else {
        setShareFailed(true);
      }
    } finally {
      setSharing(false);
    }
  }

  const connectionBadge = (
    <Badge dot variant={chatConnectionStatus === "connected" ? "audio" : "default"}>
      {chatConnectionStatus === "connected"
        ? "Live"
        : chatConnectionStatus === "connecting"
          ? "Connecting"
          : chatConnectionStatus === "reconnecting"
            ? "Reconnecting"
            : "Offline"}
    </Badge>
  );

  return (
    <div className="messenger-template">
      <section className={`messenger${mobileThreadOpen && selectedBuddy ? " messenger--thread-open" : ""}`} aria-label="Messenger">
        <aside className="messenger__sidebar" aria-label="Conversations">
          <div className="messenger__sidebar-head">
            <h1>Messages</h1>
            {connectionBadge}
            <Button
              aria-label="Start a conversation"
              className="app-icon-button"
              leadingIcon={<Plus />}
              onClick={onStartConversation}
              size="small"
              variant="tertiary"
            >
              <span className="sr-only">Start conversation</span>
            </Button>
          </div>
          <InfiniteScroll
            className="messenger__conversations"
            contentClassName="messenger__conversation-list"
            hasMore={visibleBuddies.length < buddies.length}
            itemCount={visibleBuddies.length}
            label="Conversations"
            loadDirection="end"
            loading={false}
            onLoadMore={() => setVisibleBuddyCount((count) => Math.min(count + 20, buddies.length))}
          >
            {visibleBuddies.map((buddy) => {
              const conversation = conversations.find(
                (item) => item.buddyId === buddy.id,
              );
              const latest = conversation?.messages.at(-1);
              return (
                <button
                  aria-current={selectedBuddy?.id === buddy.id ? "true" : undefined}
                  aria-label={`Open conversation with ${buddy.displayName}`}
                  className={`conversation-link${selectedBuddy?.id === buddy.id ? " is-selected" : ""}`}
                  key={buddy.id}
                  onClick={() => selectConversation(buddy.id)}
                  ref={(element) => {
                    if (element) conversationButtonsRef.current.set(buddy.id, element);
                    else conversationButtonsRef.current.delete(buddy.id);
                  }}
                  type="button"
                >
                  <span className={`buddy-row__avatar buddy-row__avatar--${buddy.presence}`}>
                    <Avatar
                      name={buddy.displayName}
                      size="medium"
                      src={buddy.avatarUrl}
                      status={buddy.presence === "offline" ? "inactive" : "active"}
                    />
                    <PresenceIndicator presence={buddy.presence} />
                  </span>
                  <span className="conversation-link__copy">
                    <strong>{buddy.displayName}{buddy.aListApproved && <AListBadge />}</strong>
                    <span>{latest?.unsent ? "This message was unsent." : latest?.text ?? "Start a conversation"}</span>
                  </span>
                  {buddy.unread && <Badge>{buddy.unread}</Badge>}
                </button>
              );
            })}
            {buddies.length === 0 && <p className="messenger__empty">No conversations yet. Start one with a friend.</p>}
          </InfiniteScroll>
        </aside>

        {selectedBuddy ? (
          <div className="chat-panel">
            <header className="chat-panel__header">
              <button className="text-button chat-panel__back" onClick={showConversations} ref={backButtonRef} type="button">
                Back
              </button>
              <button aria-label={`View ${selectedBuddy.displayName}'s profile`} className="buddy-row__avatar" onClick={() => onOpenProfile(selectedBuddy.username)} type="button"><Avatar name={selectedBuddy.displayName} size="small" src={selectedBuddy.avatarUrl} /></button>
              <div>
                <button className="text-button conversation-link__profile" onClick={() => onOpenProfile(selectedBuddy.username)} type="button"><strong>{selectedBuddy.displayName}{selectedBuddy.aListApproved && <AListBadge />}</strong></button>
                <span>
                  <PresenceIndicator presence={selectedBuddy.presence} />
                  {selectedBuddy.presence}
                </span>
              </div>
              <span className="chat-panel__connection">{connectionBadge}</span>
              <Button
                aria-label={`View ${selectedBuddy.displayName}'s profile`}
                className="app-icon-button"
                leadingIcon={<MoreActions />}
                onClick={() => onOpenProfile(selectedBuddy.username)}
                size="small"
                variant="tertiary"
              >
                <span className="sr-only">View profile</span>
              </Button>
            </header>

            <InfiniteScroll
              key={`${selectedBuddy.id}-${mobileThreadOpen}`}
              className="chat-messages"
              contentClassName="chat-messages__content"
              firstItemKey={selectedConversation?.messages[0]?.id}
              hasMore={selectedConversation?.hasMoreMessages ?? false}
              initialPosition="end"
              itemCount={selectedConversation?.messages.length ?? 0}
              label="Conversation messages"
              loading={loadingOlder}
              onLoadMore={loadOlderMessages}
              role="log"
              scrollToBottomKey={selectedConversation?.messages.at(-1)?.id}
            >
              {(selectedConversation?.messages ?? []).map((chatMessage) => {
                const sharedDub = chatMessage.dubId
                  ? dubs.find((dub) => dub.id === chatMessage.dubId)
                  : undefined;
                return (
                  <div
                    className={`chat-message chat-message--${chatMessage.sender}`}
                    key={chatMessage.id}
                  >
                    <div className="chat-message__row">
                      {chatMessage.sender === "you" && (
                        <div className="chat-message__meta">
                          {!chatMessage.unsent && onUnsendMessage && (
                            <Button
                              aria-label="Unsend message"
                              className="chat-message__unsend"
                              leadingIcon={<Undo aria-hidden="true" />}
                              onClick={() => void onUnsendMessage(selectedBuddy.id, chatMessage.id)}
                              size="small"
                              variant="tertiary"
                            >
                              <span className="sr-only">Unsend message</span>
                            </Button>
                          )}
                          <time dateTime={chatMessage.sentAt}>
                            {formatTime(chatMessage.sentAt)}
                          </time>
                        </div>
                      )}
                      <div className="chat-message__content">
                        {chatMessage.unsent ? (
                          <p className="chat-message__unsent">This message was unsent.</p>
                        ) : sharedDub ? (
                          <div className="shared-dub-message">
                            {chatMessage.text !== `Shared a dub: ${sharedDub.title}` && <p>{chatMessage.text}</p>}
                            <AudioPlayer
                              className="shared-dub__player"
                              currentTimeSeconds={nowPlayingId === sharedDub.id ? currentTimeSeconds : 0}
                              durationSeconds={nowPlayingId === sharedDub.id ? durationSeconds : undefined}
                              metadata={(
                                <div className="shared-dub__details">
                                  <TrackMetadata
                                    className="shared-dub__metadata"
                                    tags={sharedDub.tags?.length ? sharedDub.tags : [sharedDub.genre]}
                                    bpm={sharedDub.bpm > 0 ? String(sharedDub.bpm) : undefined}
                                    layout="inline"
                                    tagVariant="dark"
                                  >
                                    <TrackFileMetadata
                                      audioFileName={sharedDub.audioFileName}
                                      bitrateKbps={sharedDub.bitrateKbps}
                                      fileType={sharedDub.audioFormat}
                                      layout="inline"
                                      tagVariant="dark"
                                    />
                                  </TrackMetadata>
                                  <Button
                                    aria-label={`Download ${sharedDub.title}`}
                                    className="app-icon-button shared-dub__download"
                                    leadingIcon={<Download aria-hidden="true" />}
                                    onClick={() => onDownload(sharedDub)}
                                    size="small"
                                    variant="tertiary"
                                  />
                                </div>
                              )}
                              onPlayChange={() => onPlay(sharedDub)}
                              onSeek={onSeek ? (time) => onSeek(time, sharedDub) : undefined}
                              onSeekProgress={onSeekProgress ? (progress) => onSeekProgress(progress, sharedDub) : undefined}
                              volume={volume}
                              shuffle={shuffle}
                              repeat={repeat}
                              playbackError={nowPlayingId === sharedDub.id ? playbackError : undefined}
                              onVolumeChange={onVolumeChange}
                              onShuffleChange={onShuffleChange}
                              onRepeatChange={onRepeatChange}
                              onPrevious={onPrevious}
                              onNext={onNext}
                              playing={nowPlayingId === sharedDub.id && isPlaying}
                              track={{
                                artist: sharedDub.artist,
                                artistAListApproved: sharedDub.artistAListApproved,
                                onArtistClick: () => onOpenProfile(sharedDub.uploader),
                                artworkContent: <TrackArtwork dub={sharedDub} />,
                                duration: sharedDub.duration,
                                title: sharedDub.title,
                              }}
                              variant="inline"
                            />
                          </div>
                        ) : (
                          <p>{chatMessage.text}</p>
                        )}
                      </div>
                    </div>
                    {chatMessage.sender === "them" && (
                      <time dateTime={chatMessage.sentAt}>
                        {formatTime(chatMessage.sentAt)}
                      </time>
                    )}
                  </div>
                );
              })}
            </InfiniteScroll>

            <ChatComposer
              onChange={(value) => setDrafts((current) => ({ ...current, [selectedBuddy.id]: value }))}
              onSubmit={submitMessage}
              recipientName={selectedBuddy.displayName}
              value={message}
            />

            <div className="share-a-dub" ref={shareMenuRef}>
              <Button
                aria-label="Share one of My Dubs"
                aria-controls="share-a-dub-menu"
                aria-expanded={isShareMenuOpen}
                aria-haspopup={mobile ? "dialog" : undefined}
                className="share-a-dub__trigger"
                leadingIcon={<Disc3 />}
                onClick={() => setIsShareMenuOpen((open) => !open)}
                ref={shareMenuTriggerRef}
                size="small"
                variant="primary"
              >
                <span className="share-a-dub__label">Share one of My Dubs</span>
                <span aria-hidden="true" className="share-a-dub__label-compact">Share dub</span>
              </Button>
              {isShareMenuOpen && (
                <SharePickerContainer mobile={mobile} onClose={() => setIsShareMenuOpen(false)}>
                  <div className="share-a-dub__popover-header">
                    <SearchField
                      aria-label="Search My Dubs to share"
                      className="share-a-dub__search"
                      onChange={(event) => { setShareQuery(event.currentTarget.value); setVisibleDubCount(20); }}
                      placeholder="Search My Dubs"
                      value={shareQuery}
                    />
                  </div>
                  {shareFailed && <p className="share-a-dub__empty" role="alert">Could not send this dub. Check the notification and try again.</p>}
                  <InfiniteScroll
                    className="share-a-dub__list"
                    contentClassName="share-a-dub__results"
                    hasMore={visibleDubs.length < filteredDubs.length}
                    itemCount={visibleDubs.length}
                    label="Dubs"
                    loadDirection="end"
                    loading={false}
                    onLoadMore={() => setVisibleDubCount((count) => Math.min(count + 20, filteredDubs.length))}
                  >
                    {onCreateAndShareDub && (
                      <div className="share-a-dub__create">
                        <span>Have a new dub?</span>
                        <Button
                          aria-label="Upload and share a dub"
                          className="share-a-dub__upload"
                          leadingIcon={<Upload aria-hidden="true" />}
                          onClick={() => {
                            setIsShareMenuOpen(false);
                            onCreateAndShareDub(selectedBuddy.id);
                          }}
                          size="small"
                          variant="primary"
                        />
                      </div>
                    )}
                    {visibleDubs.map((dub) => {
                      const shared = dub.sharedBuddyIds?.includes(selectedBuddy.id) ?? false;
                      return (
                        <CompactDubCard
                          key={dub.id}
                          dub={dub}
                          onOpenProfile={onOpenProfile}
                          shared={shared}
                          action={<Button
                            aria-label={`Share ${dub.title}${shared ? " again" : ""} with ${selectedBuddy.displayName}`}
                            disabled={sharing}
                            leadingIcon={shared ? undefined : <Link />}
                            onClick={() => void shareDub(dub)}
                            size="small"
                            variant={shared ? "secondary" : "tertiary"}
                          >{shared ? "Share again" : "Share"}</Button>}
                        />
                      );
                    })}
                    {shareableDubs.length === 0 && (
                      <p className="share-a-dub__empty">You have not shared a dub yet. Upload one to send it here.</p>
                    )}
                    {shareableDubs.length > 0 && filteredDubs.length === 0 && (
                      <p className="share-a-dub__empty">No dubs match your search.</p>
                    )}
                  </InfiniteScroll>
                </SharePickerContainer>
              )}
            </div>

          </div>
        ) : (
          <div className="empty-state">
            <MessageCircle aria-hidden="true" />
            <strong>No conversations yet</strong>
            <span>Add a friend to start a conversation.</span>
          </div>
        )}
      </section>
    </div>
  );
}
