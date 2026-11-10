import webPush from "web-push";

const allowedHosts = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

export function validPushSubscription(subscription) {
  if (!subscription || typeof subscription.endpoint !== "string" || subscription.endpoint.length > 2048) return false;
  let endpoint;
  try {
    endpoint = new URL(subscription.endpoint);
  } catch {
    return false;
  }
  if (endpoint.protocol !== "https:" || endpoint.port || endpoint.username || endpoint.password ||
    !allowedHosts.some((host) => endpoint.hostname === host || endpoint.hostname.endsWith(`.${host}`))) return false;
  const { p256dh, auth } = subscription.keys ?? {};
  return typeof p256dh === "string" && /^[A-Za-z0-9_-]{87}$/.test(p256dh) &&
    Buffer.from(p256dh, "base64url").length === 65 && Buffer.from(p256dh, "base64url")[0] === 4 &&
    typeof auth === "string" && /^[A-Za-z0-9_-]{22}$/.test(auth) && Buffer.from(auth, "base64url").length === 16;
}

export function createPushService({ publicKey, privateKey, subject, send = webPush.sendNotification } = {}) {
  if (!publicKey && !privateKey && !subject) return null;
  if (!publicKey || !privateKey || !subject) throw new Error("Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT together.");
  webPush.setVapidDetails(subject, publicKey, privateKey);
  return {
    publicKey,
    send(subscription, payload) {
      return send(subscription, JSON.stringify(payload), { TTL: 86400, timeout: 10000 });
    },
  };
}
