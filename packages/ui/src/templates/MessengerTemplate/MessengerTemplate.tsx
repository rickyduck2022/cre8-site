import { useEffect, useState, type FormEvent } from "react";
import {
  Disc3,
  Link,
  MessageCircle,
  MoreActions,
  Plus,
} from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { ChatComposer } from "../../molecules/ChatComposer/ChatComposer";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
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
  initialBuddyId: string;
  chatConnectionStatus: ChatConnectionStatus;
  onOpenProfile: (username: string) => void;
  onPlay: (dub: Dub) => void;
  onStartConversation: () => void;
  onSelectConversation: (buddyId: string) => void;
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
  initialBuddyId,
  onOpenProfile,
  onPlay,
  onStartConversation,
  onSelectConversation,
  onSendMessage,
}: MessengerTemplateProps) {
  const [selectedBuddyId, setSelectedBuddyId] = useState(initialBuddyId);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSelectedBuddyId(initialBuddyId);
  }, [initialBuddyId]);

  const selectedBuddy =
    buddies.find((buddy) => buddy.id === selectedBuddyId) ?? buddies[0];
  const selectedConversation = conversations.find(
    (conversation) => conversation.buddyId === selectedBuddy?.id,
  );
  const buddyPagination = usePagination(buddies);
  const messagePagination = usePagination(
    selectedConversation?.messages ?? [],
    selectedBuddy?.id,
  );
  const dubPagination = usePagination(dubs);

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
          {buddyPagination.items.map((buddy) => {
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
          <Pagination
            className="pagination--compact"
            itemCount={buddies.length}
            label="Conversations"
            onPageChange={buddyPagination.setPage}
            onPageSizeChange={buddyPagination.setPageSize}
            page={buddyPagination.page}
            pageSize={buddyPagination.pageSize}
            totalPages={buddyPagination.totalPages}
          />
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

            <div aria-live="polite" className="chat-messages">
              {messagePagination.items.map((chatMessage) => {
                const sharedDub = chatMessage.dubId
                  ? dubs.find((dub) => dub.id === chatMessage.dubId)
                  : undefined;
                return (
                  <div
                    className={`chat-message chat-message--${chatMessage.sender}`}
                    key={chatMessage.id}
                  >
                    {sharedDub ? (
                      <button
                        aria-label={`Play ${sharedDub.title}`}
                        className="shared-dub"
                        onClick={() => onPlay(sharedDub)}
                        type="button"
                      >
                        <TrackArtwork dub={sharedDub} />
                        <div>
                          <strong>{sharedDub.title}</strong>
                          <span>{sharedDub.artist} · {sharedDub.genre}</span>
                          <small>{chatMessage.text}</small>
                        </div>
                      </button>
                    ) : (
                      <p>{chatMessage.text}</p>
                    )}
                    <time dateTime={chatMessage.sentAt}>
                      {formatTime(chatMessage.sentAt)}
                    </time>
                  </div>
                );
              })}
            </div>
            <Pagination
              itemCount={selectedConversation?.messages.length ?? 0}
              label="Messages"
              onPageChange={messagePagination.setPage}
              onPageSizeChange={messagePagination.setPageSize}
              page={messagePagination.page}
              pageSize={messagePagination.pageSize}
              totalPages={messagePagination.totalPages}
            />

            <details className="share-a-dub">
              <summary>
                <Disc3 aria-hidden="true" />
                Share a dub
              </summary>
              <div className="share-a-dub__list">
                {dubPagination.items.map((dub) => (
                  <button
                    key={dub.id}
                    onClick={() => shareDub(dub)}
                    type="button"
                  >
                    <span>{dub.title}</span>
                    <span>{dub.artist}</span>
                    <Link aria-hidden="true" />
                  </button>
                ))}
                <Pagination
                  itemCount={dubs.length}
                  label="Share a dub"
                  onPageChange={dubPagination.setPage}
                  onPageSizeChange={dubPagination.setPageSize}
                  page={dubPagination.page}
                  pageSize={dubPagination.pageSize}
                  totalPages={dubPagination.totalPages}
                />
              </div>
            </details>

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
            <span>Add a buddy to start a conversation.</span>
          </div>
        )}
      </section>
    </div>
  );
}
