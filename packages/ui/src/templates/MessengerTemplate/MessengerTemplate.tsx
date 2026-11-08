import { useEffect, useRef, useState, type FormEvent } from "react";
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
  onLoadOlderMessages,
  onSendMessage,
  onUnsendMessage,
}: MessengerTemplateProps) {
  const [selectedBuddyId, setSelectedBuddyId] = useState(initialBuddyId);
  const [message, setMessage] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [visibleBuddyCount, setVisibleBuddyCount] = useState(20);
  const [visibleDubCount, setVisibleDubCount] = useState(20);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [shareQuery, setShareQuery] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
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
  const filteredDubs = shareableDubs.filter((dub) =>
    [dub.title, dub.artist].some((value) => value.toLocaleLowerCase().includes(shareQuery.trim().toLocaleLowerCase())),
  );
  const visibleDubs = filteredDubs.slice(0, visibleDubCount);

  useEffect(() => {
    setLoadingOlder(false);
    setIsShareMenuOpen(false);
    setShareFailed(false);
    setShareQuery("");
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
                <div
                  className={`conversation-link${selectedBuddy?.id === buddy.id ? " is-selected" : ""}`}
                  key={buddy.id}
                >
                  <button aria-label={`View ${buddy.displayName}'s profile`} className={`buddy-row__avatar buddy-row__avatar--${buddy.presence}`} onClick={() => onOpenProfile(buddy.username)} type="button">
                    <Avatar
                      name={buddy.displayName}
                      size="medium"
                      src={buddy.avatarUrl}
                      status={buddy.presence === "offline" ? "inactive" : "active"}
                    />
                    <PresenceIndicator presence={buddy.presence} />
                  </button>
                  <span className="conversation-link__copy">
                    <button className="text-button conversation-link__profile" onClick={() => onOpenProfile(buddy.username)} type="button"><strong>{buddy.displayName}{buddy.aListApproved && <AListBadge />}</strong></button>
                    <button aria-current={selectedBuddy?.id === buddy.id ? "true" : undefined} aria-label={`Open conversation with ${buddy.displayName}`} className="text-button conversation-link__preview" onClick={() => selectConversation(buddy.id)} type="button">{latest?.unsent ? "This message was unsent." : latest?.text ?? "Start a conversation"}</button>
                  </span>
                  {buddy.unread && <Badge>{buddy.unread}</Badge>}
                </div>
              );
            })}
          </InfiniteScroll>
        </aside>

        {selectedBuddy ? (
          <div className="chat-panel">
            <header className="chat-panel__header">
              <button aria-label={`View ${selectedBuddy.displayName}'s profile`} className="buddy-row__avatar" onClick={() => onOpenProfile(selectedBuddy.username)} type="button"><Avatar name={selectedBuddy.displayName} size="small" src={selectedBuddy.avatarUrl} /></button>
              <div>
                <button className="text-button conversation-link__profile" onClick={() => onOpenProfile(selectedBuddy.username)} type="button"><strong>{selectedBuddy.displayName}{selectedBuddy.aListApproved && <AListBadge />}</strong></button>
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
                              endAction={(
                                <Button
                                  aria-label={`Download ${sharedDub.title}`}
                                  className="app-icon-button shared-dub__download"
                                  leadingIcon={<Download aria-hidden="true" />}
                                  onClick={() => onDownload(sharedDub)}
                                  size="small"
                                  variant="tertiary"
                                />
                              )}
                              metadata={(
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
                  <SearchField
                    aria-label="Search My Dubs to share"
                    className="share-a-dub__search"
                    onChange={(event) => { setShareQuery(event.currentTarget.value); setVisibleDubCount(20); }}
                    placeholder="Search My Dubs"
                    value={shareQuery}
                  />
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
                    {visibleDubs.map((dub) => dub.sharedBuddyIds?.includes(selectedBuddy.id) ? (
                      <div className="share-a-dub__entry share-a-dub__entry--shared" key={dub.id}>
                        <div>
                          <strong>{dub.title}</strong>
                          <button className="text-button now-playing__artist" onClick={() => onOpenProfile(dub.uploader)} type="button">{dub.artist}{dub.artistAListApproved && <AListBadge />} · Shared</button>
                        </div>
                        <Button
                          aria-label={`Share ${dub.title} again with ${selectedBuddy.displayName}`}
                          disabled={sharing}
                          onClick={() => void shareDub(dub)}
                          size="small"
                          variant="secondary"
                        >Share again</Button>
                      </div>
                    ) : (
                      <div
                        className="share-a-dub__entry"
                        key={dub.id}
                      >
                        <div>
                          <strong>{dub.title}</strong>
                          <button className="text-button now-playing__artist" onClick={() => onOpenProfile(dub.uploader)} type="button">{dub.artist}{dub.artistAListApproved && <AListBadge />}</button>
                        </div>
                        <Button aria-label={`Share ${dub.title} with ${selectedBuddy.displayName}`} disabled={sharing} leadingIcon={<Link />} onClick={() => void shareDub(dub)} size="small" variant="tertiary">Share</Button>
                      </div>
                    ))}
                    {shareableDubs.length === 0 && (
                      <p className="share-a-dub__empty">You have not shared a dub yet. Upload one to send it here.</p>
                    )}
                    {shareableDubs.length > 0 && filteredDubs.length === 0 && (
                      <p className="share-a-dub__empty">No dubs match your search.</p>
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
