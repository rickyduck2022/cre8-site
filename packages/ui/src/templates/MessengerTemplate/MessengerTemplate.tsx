import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Disc3,
  Download,
  Link,
  MessageCircle,
  MoreActions,
  Plus,
} from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { ChatComposer } from "../../molecules/ChatComposer/ChatComposer";
import { DubManagementActions } from "../../molecules/DubManagementActions/DubManagementActions";
import { InfiniteScroll } from "../../molecules/InfiniteScroll/InfiniteScroll";
import { AudioPlayer } from "../../organisms/AudioPlayer/AudioPlayer";
import { TrackArtwork } from "../shared/TrackArtwork";
import { PresenceIndicator } from "../shared/PresenceIndicator";
import { formatTime } from "../templateFormatters";
import type { Buddy, ChatConnectionStatus, Conversation, Dub } from "../communityTypes";
import "../CommunityPageTemplates.css";
import "./MessengerTemplate.css";

export interface MessengerTemplateProps {
  buddies: Buddy[];
  conversations: Conversation[];
  dubs: Dub[];
  shareableDubs?: Dub[];
  initialBuddyId: string;
  chatConnectionStatus: ChatConnectionStatus;
  nowPlayingId: string | null;
  isPlaying: boolean;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  onSeek?: (timeSeconds: number) => void;
  onOpenProfile: (username: string) => void;
  onPlay: (dub: Dub) => void;
  onDownload?: (dub: Dub) => void;
  onStartConversation: () => void;
  onCreateAndShareDub?: (buddyId: string) => void;
  currentUsername?: string;
  onEditDub?: (dub: Dub) => void;
  onDeleteDub?: (dub: Dub) => void;
  onSelectConversation: (buddyId: string) => void;
  onLoadOlderMessages: (buddyId: string, beforeId: string) => Promise<unknown>;
  onSendMessage: (
    buddyId: string,
    text: string,
    dubId?: string,
  ) => boolean | Promise<boolean>;
}

export function MessengerTemplate({
  buddies,
  conversations,
  chatConnectionStatus,
  dubs,
  shareableDubs = [],
  initialBuddyId,
  nowPlayingId,
  isPlaying,
  currentTimeSeconds = 0,
  durationSeconds,
  onSeek,
  onOpenProfile,
  onPlay,
  onDownload = () => undefined,
  onStartConversation,
  onCreateAndShareDub,
  currentUsername,
  onEditDub,
  onDeleteDub,
  onSelectConversation,
  onLoadOlderMessages,
  onSendMessage,
}: MessengerTemplateProps) {
  const [selectedBuddyId, setSelectedBuddyId] = useState(initialBuddyId);
  const [message, setMessage] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [visibleBuddyCount, setVisibleBuddyCount] = useState(20);
  const [visibleDubCount, setVisibleDubCount] = useState(20);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSelectedBuddyId(initialBuddyId);
  }, [initialBuddyId]);

  const selectedBuddy =
    buddies.find((buddy) => buddy.id === selectedBuddyId) ?? buddies[0];
  const selectedConversation = conversations.find(
    (conversation) => conversation.buddyId === selectedBuddy?.id,
  );
  const visibleBuddies = buddies.slice(0, visibleBuddyCount);
  const visibleDubs = shareableDubs.slice(0, visibleDubCount);

  useEffect(() => {
    setLoadingOlder(false);
    setIsShareMenuOpen(false);
  }, [selectedBuddy?.id]);

  useEffect(() => {
    if (!isShareMenuOpen) return;
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
  }, [isShareMenuOpen]);

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
    onSelectConversation(buddyId);
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!selectedBuddy || !text) return;
    if (await onSendMessage(selectedBuddy.id, text)) setMessage("");
  }

  function shareDub(dub: Dub) {
    if (selectedBuddy) {
      onSendMessage(selectedBuddy.id, `Shared a dub: ${dub.title}`, dub.id);
      setIsShareMenuOpen(false);
    }
  }

  return (
    <div className="messenger-template">
      <section className="page-intro">
        <div>
          <span className="eyebrow">PRIVATE CONVERSATIONS</span>
          <h1>Messenger</h1>
          <p>Talk tunes, share finds, keep the good stuff moving.</p>
        </div>
        <Badge
          dot
          variant={chatConnectionStatus === "connected" ? "audio" : "default"}
        >
          {chatConnectionStatus === "connected"
            ? "Live"
            : chatConnectionStatus === "connecting"
              ? "Connecting"
              : chatConnectionStatus === "reconnecting"
                ? "Reconnecting"
                : "Offline"}
        </Badge>
      </section>

      <section className="messenger">
        <aside className="messenger__sidebar" aria-label="Conversations">
          <div className="messenger__sidebar-head">
            <h2>Messages</h2>
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
                  className={`conversation-link${selectedBuddy?.id === buddy.id ? " is-selected" : ""}`}
                  key={buddy.id}
                  onClick={() => selectConversation(buddy.id)}
                  type="button"
                >
                  <span className={`buddy-row__avatar buddy-row__avatar--${buddy.presence}`}>
                    <Avatar
                      name={buddy.displayName}
                      size="medium"
                      status={buddy.presence === "offline" ? "inactive" : "active"}
                    />
                    <PresenceIndicator presence={buddy.presence} />
                  </span>
                  <span className="conversation-link__copy">
                    <strong>{buddy.displayName}</strong>
                    <span>{latest?.text ?? "Start a conversation"}</span>
                  </span>
                  {buddy.unread && <Badge>{buddy.unread}</Badge>}
                </button>
              );
            })}
          </InfiniteScroll>
        </aside>

        {selectedBuddy ? (
          <div className="chat-panel">
            <header className="chat-panel__header">
              <Avatar name={selectedBuddy.displayName} size="small" />
              <div>
                <strong>{selectedBuddy.displayName}</strong>
                <span>
                  <PresenceIndicator presence={selectedBuddy.presence} />
                  {selectedBuddy.presence}
                </span>
              </div>
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
              key={selectedBuddy.id}
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
                    {sharedDub ? (
                      <AudioPlayer
                        className="shared-dub shared-dub__player"
                        currentTimeSeconds={nowPlayingId === sharedDub.id ? currentTimeSeconds : 0}
                        durationSeconds={nowPlayingId === sharedDub.id ? durationSeconds : undefined}
                        endAction={(
                          <div className="shared-dub__actions">
                            <Button
                              aria-label={`Download ${sharedDub.title}`}
                              className="app-icon-button shared-dub__download"
                              leadingIcon={<Download aria-hidden="true" />}
                              onClick={() => onDownload(sharedDub)}
                              size="small"
                              variant="tertiary"
                            />
                            {sharedDub.uploader === currentUsername && onEditDub && onDeleteDub && (
                              <DubManagementActions
                                onDelete={() => onDeleteDub(sharedDub)}
                                onEdit={() => onEditDub(sharedDub)}
                                title={sharedDub.title}
                              />
                            )}
                          </div>
                        )}
                        onPlayChange={() => onPlay(sharedDub)}
                        onSeek={nowPlayingId === sharedDub.id ? onSeek : undefined}
                        playing={nowPlayingId === sharedDub.id && isPlaying}
                        track={{
                          artist: sharedDub.artist,
                          artworkContent: <TrackArtwork dub={sharedDub} />,
                          duration: sharedDub.duration,
                          title: sharedDub.title,
                        }}
                        variant="inline"
                      />
                    ) : (
                      <p>{chatMessage.text}</p>
                    )}
                    <time dateTime={chatMessage.sentAt}>
                      {formatTime(chatMessage.sentAt)}
                    </time>
                  </div>
                );
              })}
            </InfiniteScroll>

            <div className="share-a-dub" ref={shareMenuRef}>
              <button
                aria-controls="share-a-dub-menu"
                aria-expanded={isShareMenuOpen}
                className="share-a-dub__trigger"
                onClick={() => setIsShareMenuOpen((open) => !open)}
                ref={shareMenuTriggerRef}
                type="button"
              >
                <Disc3 aria-hidden="true" />
                Share one of My Dubs
              </button>
              {isShareMenuOpen && (
                <div
                  aria-label="My Dubs available to share"
                  className="share-a-dub__popover"
                  id="share-a-dub-menu"
                  role="region"
                >
                  <InfiniteScroll
                    className="share-a-dub__list"
                    contentClassName="share-a-dub__results"
                    hasMore={visibleDubs.length < shareableDubs.length}
                    itemCount={visibleDubs.length}
                    label="Dubs"
                    loadDirection="end"
                    loading={false}
                    onLoadMore={() => setVisibleDubCount((count) => Math.min(count + 20, shareableDubs.length))}
                  >
                    {onCreateAndShareDub && (
                      <div className="share-a-dub__create">
                        <span>Have a new dub?</span>
                        <Button
                          onClick={() => {
                            setIsShareMenuOpen(false);
                            onCreateAndShareDub(selectedBuddy.id);
                          }}
                          size="small"
                          variant="secondary"
                        >
                          Upload &amp; share
                        </Button>
                      </div>
                    )}
                    {visibleDubs.map((dub) => (
                      <div className="share-a-dub__entry" key={dub.id}>
                        <div>
                          <strong>{dub.title}</strong>
                          <span>{dub.artist}</span>
                        </div>
                        <Button
                          leadingIcon={<Link aria-hidden="true" />}
                          onClick={() => shareDub(dub)}
                          size="small"
                          variant="tertiary"
                        >
                          Share Dub
                        </Button>
                        {dub.uploader === currentUsername && onEditDub && onDeleteDub && (
                          <DubManagementActions
                            onDelete={() => onDeleteDub(dub)}
                            onEdit={() => onEditDub(dub)}
                            title={dub.title}
                          />
                        )}
                      </div>
                    ))}
                    {shareableDubs.length === 0 && (
                      <p className="share-a-dub__empty">You have not shared a dub yet. Upload one to send it here.</p>
                    )}
                  </InfiniteScroll>
                </div>
              )}
            </div>

            <ChatComposer
              onChange={setMessage}
              onSubmit={submitMessage}
              recipientName={selectedBuddy.displayName}
              value={message}
            />
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
