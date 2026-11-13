import { useEffect, useRef, useState } from "react";
import type { NotificationMessage, NotificationType } from "@craft/ui";

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [activeNotificationIds, setActiveNotificationIds] = useState<string[]>([]);
  const notificationTimers = useRef(new Map<string, number>());
  useEffect(() => () => {
    for (const timeout of notificationTimers.current.values()) window.clearTimeout(timeout);
    notificationTimers.current.clear();
  }, []);
  function notify(message: string, type: NotificationType = "success", conversationId?: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications((current) => [{ id, message, type, createdAt: new Date().toISOString(), read: false, conversationId }, ...current]);
    setActiveNotificationIds((current) => [id, ...current]);
    const timeout = window.setTimeout(() => {
      setActiveNotificationIds((current) => current.filter((item) => item !== id));
      notificationTimers.current.delete(id);
    }, 5000);
    notificationTimers.current.set(id, timeout);
  }
  function dismissNotification(id: string) {
    const timeout = notificationTimers.current.get(id);
    if (timeout !== undefined) window.clearTimeout(timeout);
    notificationTimers.current.delete(id);
    setNotifications((current) => current.filter((item) => item.id !== id));
    setActiveNotificationIds((current) => current.filter((item) => item !== id));
  }
  function clearNotifications() {
    for (const timeout of notificationTimers.current.values()) window.clearTimeout(timeout);
    notificationTimers.current.clear();
    setNotifications([]);
    setActiveNotificationIds([]);
  }
  function markNotificationsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }
  return {
    notifications,
    activeNotifications: notifications.filter((item) => activeNotificationIds.includes(item.id)),
    unreadNotificationCount: notifications.filter((item) => !item.read).length,
    notify,
    dismissNotification,
    clearNotifications,
    markNotificationsRead,
  };
}
