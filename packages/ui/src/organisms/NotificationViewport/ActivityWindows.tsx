import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNotificationPortalTarget } from "./NotificationViewport";
import { Bell, WindowMinimize, WindowRestore, X } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import type { NotificationMessage, UploadProgressState, UploadResult } from "../../molecules/notificationTypes";
import { UploadProgress } from "../../molecules/UploadProgress/UploadProgress";
import { NotificationToast } from "../../molecules/NotificationToast/NotificationToast";
import "../Window/Window.css";
import "./ActivityWindows.css";

function ActivityWindow({ title, children, onClose, closeDisabled = false, onReturnFocus }: {
  title: string; children: ReactNode; onClose?: () => void; closeDisabled?: boolean; onReturnFocus?: () => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    return () => {
      if (element?.contains(document.activeElement)) queueMicrotask(() => onReturnFocus?.());
    };
  }, [onReturnFocus]);
  return <section ref={ref} role="dialog" aria-label={title} className="activity-window"
    onKeyDown={(event) => {
      if (event.key === "Escape" && onClose && !closeDisabled) { event.preventDefault(); event.stopPropagation(); onClose(); }
    }}>
    <header className="floating-window__header">
      <h2>{title}</h2>
      <Button size="small" variant="tertiary" aria-label={`${minimized ? "Restore" : "Minimize"} ${title}`}
        aria-expanded={!minimized} onClick={() => setMinimized(!minimized)}
        leadingIcon={minimized ? <WindowRestore aria-hidden="true" /> : <WindowMinimize aria-hidden="true" />} />
      {onClose && <Button size="small" variant="tertiary" aria-label={`Close ${title}`} disabled={closeDisabled}
        onClick={onClose} leadingIcon={<X aria-hidden="true" />} />}
    </header>
    <div className="activity-window__content" hidden={minimized}>{children}</div>
  </section>;
}

export function ActivityWindows({ notifications, activeNotifications, unreadCount, onRead, onDismiss, onClear, onActivate,
  uploadProgress, uploadResults = [], onDismissUpload }: {
  notifications: NotificationMessage[]; activeNotifications: NotificationMessage[]; unreadCount: number;
  onRead: () => void; onDismiss: (id: string) => void; onClear: () => void;
  onActivate?: (notification: NotificationMessage) => void;
  uploadProgress?: UploadProgressState | null; uploadResults?: UploadResult[]; onDismissUpload: (id: string) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useCallback(() => trigger.current?.focus({ preventScroll: true }), []);
  const portalTarget = useNotificationPortalTarget(true);
  const overlay = portalTarget && portalTarget !== document.body;
  const content = <div className={`activity-windows${overlay ? " activity-windows--overlay" : ""}`} data-window-system data-workspace-navigator>
    {activeNotifications.map((notification) => <ActivityWindow key={notification.id} title="Notification" onClose={() => onDismiss(notification.id)} onReturnFocus={returnFocus}>
      <NotificationToast notification={notification} onDismiss={onDismiss} dismissible={false} />
    </ActivityWindow>)}
    {(uploadProgress || uploadResults.length > 0) && <ActivityWindow title="Uploads" closeDisabled={Boolean(uploadProgress)} onReturnFocus={returnFocus}
      onClose={() => uploadResults.forEach((result) => onDismissUpload(result.id))}>
      {uploadProgress && <UploadProgress progress={uploadProgress} />}
      {uploadResults.map((result) => <div key={result.id} role={result.type === "error" ? "alert" : "status"} className="activity-window__result">
        <p>{result.message}</p>
        <Button size="small" variant="tertiary" aria-label={`Close upload result: ${result.message}`} onClick={() => onDismissUpload(result.id)}
          leadingIcon={<X aria-hidden="true" />} />
      </div>)}
    </ActivityWindow>}
    {notifications.length > 0 && <Button ref={trigger} size="small" variant="secondary" className="activity-windows__trigger"
      aria-label={`Notifications, ${unreadCount} unread`} aria-expanded={historyOpen}
      leadingIcon={<Bell aria-hidden="true" />} onClick={() => { setHistoryOpen(!historyOpen); onRead(); }}>
      [{unreadCount}] notifications
    </Button>}
    {historyOpen && <ActivityWindow title="Notification history" onClose={() => setHistoryOpen(false)} onReturnFocus={returnFocus}>
      {notifications.length > 0 ? <>
        <Button size="small" variant="tertiary" onClick={onClear}>Clear all notifications</Button>
        {notifications.map((notification) => <div key={notification.id}>
          <NotificationToast notification={notification} onDismiss={onDismiss} announce={false} />
          {notification.conversationId && onActivate && <Button size="small" variant="secondary"
            onClick={() => { onActivate(notification); setHistoryOpen(false); }}>Open conversation</Button>}
        </div>)}
      </> : <p>No notifications.</p>}
    </ActivityWindow>}
  </div>;
  return overlay ? createPortal(content, portalTarget) : content;
}
