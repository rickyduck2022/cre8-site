import type { NotificationMessage } from "../notificationTypes";
import "./NotificationToast.css";

export interface NotificationToastProps {
  notification: NotificationMessage;
  onDismiss: (id: string) => void;
  dismissible?: boolean;
  announce?: boolean;
}

export function NotificationToast({
  notification,
  onDismiss,
  dismissible = true,
  announce = true,
}: NotificationToastProps) {
  return (
    <div
      className={`notification-toast notification-toast--${notification.type}`}
      role={announce ? notification.type === "error" ? "alert" : "status" : undefined}
    >
      <span aria-hidden="true" className="notification-toast__marker" />
      <p className="notification-toast__message">{notification.message}</p>
      {dismissible && <button
        aria-label="Dismiss notification"
        className="notification-toast__dismiss"
        onClick={() => onDismiss(notification.id)}
        type="button"
      >
        ×
      </button>}
    </div>
  );
}
