import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { NotificationMessage } from "../../molecules/notificationTypes";
import { NotificationToast } from "../../molecules/NotificationToast/NotificationToast";
import "./NotificationViewport.css";

export interface NotificationViewportProps {
  notifications: NotificationMessage[];
  onDismiss: (id: string) => void;
}

export function useNotificationPortalTarget(includeWindows = false) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined" || !document.body) return;

    function syncPortalTarget() {
      const openDialogs = [...document.querySelectorAll<HTMLDialogElement>(includeWindows ? "dialog[open]" : "dialog.modal[open]")];
      const focusedDialog = document.activeElement?.closest<HTMLDialogElement>("dialog[open]");
      const nextTarget = includeWindows
        ? (focusedDialog?.matches(":modal") ? focusedDialog : openDialogs.filter((dialog) => dialog.matches(":modal")).at(-1)) ?? document.body
        : openDialogs.at(-1) ?? document.body;
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
    if (includeWindows) document.addEventListener("focusin", syncPortalTarget);
    return () => { observer.disconnect(); document.removeEventListener("focusin", syncPortalTarget); };
  }, [includeWindows]);
  return portalTarget;
}

export function NotificationViewport({
  notifications,
  onDismiss,
}: NotificationViewportProps) {
  const portalTarget = useNotificationPortalTarget();

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
