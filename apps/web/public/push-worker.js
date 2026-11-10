self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    console.error("Invalid push notification payload:", error);
    return;
  }
  if (typeof payload.title !== "string" || typeof payload.body !== "string" || typeof payload.buddyId !== "string") {
    console.error("Invalid push notification payload.");
    return;
  }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/pwa-192.png",
    data: { buddyId: payload.buddyId },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const buddyId = event.notification.data?.buddyId;
  if (typeof buddyId !== "string" || !buddyId) return;
  const url = new URL("/", self.location.origin);
  url.hash = `messenger?buddy=${encodeURIComponent(buddyId)}`;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => {
      const current = new URL(client.url);
      return current.origin === self.location.origin && current.pathname === "/";
    });
    if (existing) {
      existing.postMessage({ type: "push.openConversation", buddyId });
      return existing.focus();
    }
    return self.clients.openWindow(url.href);
  })());
});
