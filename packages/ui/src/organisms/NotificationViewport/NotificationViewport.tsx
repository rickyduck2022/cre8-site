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
  if (notifications.length === 0) return null;

  return (
    <div aria-label="Recent notifications" className="notification-viewport">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
