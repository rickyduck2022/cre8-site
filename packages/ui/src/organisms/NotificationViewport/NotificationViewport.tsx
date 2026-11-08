import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { NotificationMessage } from "../../molecules/notificationTypes";
import { NotificationToast } from "../../molecules/NotificationToast/NotificationToast";
import "./NotificationViewport.css";

export interface NotificationViewportProps {
  notifications: NotificationMessage[];
  onDismiss: (id: string) => void;
}

export function NotificationViewport({
  notifications,
  onDismiss,
}: NotificationViewportProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined" || !document.body) return;

    function syncPortalTarget() {
      const openDialogs = document.querySelectorAll<HTMLElement>("dialog.modal[open]");
      const nextTarget = openDialogs.item(openDialogs.length - 1) ?? document.body;
      setPortalTarget((current) => current === nextTarget ? current : nextTarget);
    }

    syncPortalTarget();
    const observer = new MutationObserver(syncPortalTarget);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  if (notifications.length === 0) return null;
  if (!portalTarget) return null;

  return createPortal((
    <div aria-label="Recent notifications" className="notification-viewport">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  ), portalTarget);
}
