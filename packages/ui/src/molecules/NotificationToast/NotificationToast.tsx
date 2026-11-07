import type { NotificationMessage } from "../notificationTypes";
import "./NotificationToast.css";

export interface NotificationToastProps {
  notification: NotificationMessage;
  onDismiss: (id: string) => void;
}

export function NotificationToast({
  notification,
  onDismiss,
}: NotificationToastProps) {
  return (
    <div
      className={`notification-toast notification-toast--${notification.type}`}
      role={notification.type === "error" ? "alert" : "status"}
    >
      <span aria-hidden="true" className="notification-toast__marker" />
      <p className="notification-toast__message">{notification.message}</p>
      <button
        aria-label="Dismiss notification"
        className="notification-toast__dismiss"
        onClick={() => onDismiss(notification.id)}
        type="button"
      >
        ×
      </button>
    </div>
  );
}
