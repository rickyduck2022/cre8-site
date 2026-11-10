import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import type { NotificationMessage } from "../../molecules/notificationTypes";
import { useMobileLayout } from "../../utils/useMobileLayout";
import { Modal } from "../Modal/Modal";
import "./NotificationCenter.css";

export interface NotificationCenterProps {
  notifications: NotificationMessage[];
  unreadCount: number;
  onOpen: () => void;
  onDismiss: (id: string) => void;
  onClear: () => void;
  onActivate?: (notification: NotificationMessage) => void;
  pushSettings?: ReactNode;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function NotificationCenter({
  notifications,
  unreadCount,
  onClear,
  onDismiss,
  onOpen,
  onActivate,
  pushSettings,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mobile = useMobileLayout();

  useEffect(() => {
    if (!isOpen || mobile) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, mobile]);

  function toggle() {
    const nextIsOpen = !isOpen;
    setIsOpen(nextIsOpen);
    if (nextIsOpen) onOpen();
  }

  const content = (
    <>
      {mobile && notifications.length > 0 && (
        <div className="notification-center__mobile-actions">
          <Button onClick={onClear} size="small" variant="tertiary">Clear all</Button>
        </div>
      )}
      {pushSettings}
      {notifications.length > 0 ? (
        <ul className="notification-center__list">
          {notifications.map((notification) => (
            <li
              className={[
                "notification-center__item",
                `notification-center__item--${notification.type}`,
                !notification.read && "is-unread",
              ].filter(Boolean).join(" ")}
              key={notification.id}
            >
              <span aria-hidden="true" className="notification-center__dot" />
              {notification.conversationId ? (
                <button
                  className="notification-center__content notification-center__open"
                  onClick={() => {
                    onActivate?.(notification);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  <p>{notification.message}</p>
                  <time dateTime={notification.createdAt}>
                    {formatTime(notification.createdAt)}
                  </time>
                </button>
              ) : (
                <div className="notification-center__content">
                  <p>{notification.message}</p>
                  <time dateTime={notification.createdAt}>
                    {formatTime(notification.createdAt)}
                  </time>
                </div>
              )}
              <button
                aria-label={`Dismiss notification: ${notification.message}`}
                className="notification-center__dismiss"
                onClick={() => onDismiss(notification.id)}
                type="button"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notification-center__empty">You’re all caught up.</p>
      )}
    </>
  );

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup={mobile ? "dialog" : "true"}
        aria-label={unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"}
        className="notification-center__trigger"
        onClick={toggle}
        type="button"
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="notification-center__badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (mobile ? (
        <Modal className="notification-center__dialog" isOpen onClose={() => setIsOpen(false)} title="Notifications">
          {content}
        </Modal>
      ) : (
        <section
          aria-label="Notifications"
          className="notification-center__panel"
        >
          <header className="notification-center__header">
            <h2>Notifications</h2>
            {notifications.length > 0 && (
              <button onClick={onClear} type="button">
                Clear all
              </button>
            )}
          </header>
          {content}
        </section>
      ))}
    </div>
  );
}
