import { useEffect, useState } from "react";
import { Button } from "@craft/ui";

async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Push notification settings could not be updated.");
  return result;
}

export async function removeDevicePushSubscription() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await request("/api/push/subscription", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!await subscription.unsubscribe()) throw new Error("Could not disable push notifications on this device.");
}

function applicationKey(value: string) {
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function subscriptionUsesKey(subscription: PushSubscription, key: string) {
  const actual = subscription.options.applicationServerKey;
  if (!actual) return false;
  const expected = applicationKey(key);
  const bytes = new Uint8Array(actual);
  return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
}

export function PushSettings() {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(supported);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported) return;
    let active = true;
    void (async () => {
      try {
        const config = await request("/api/push/config");
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        const status = subscription ? await request("/api/push/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }) : { enabled: false };
        if (active) {
          setPublicKey(config.publicKey);
          setEnabled(status.enabled === true && subscription != null &&
            (config.publicKey === null || (typeof config.publicKey === "string" && subscriptionUsesKey(subscription, config.publicKey))));
        }
      } catch (loadError) {
        console.error("Could not load push notification settings:", loadError);
        if (active) setError("Could not load push notification settings.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supported]);

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      if (enabled) {
        await removeDevicePushSubscription();
        setEnabled(false);
      } else {
        if (!publicKey) throw new Error("Push notifications are not configured on this server.");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Notification permission was not granted. Check your browser settings.");
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) throw new Error("The app service worker is not available. Reload and try again.");
        let subscription = await registration.pushManager.getSubscription();
        if (subscription && !subscriptionUsesKey(subscription, publicKey)) {
          await removeDevicePushSubscription();
          subscription = null;
        }
        subscription ??= await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationKey(publicKey),
        });
        await request("/api/push/subscription", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
        setEnabled(true);
      }
    } catch (toggleError) {
      console.error("Push notification setting failed:", toggleError);
      setError(toggleError instanceof Error ? toggleError.message : "Push notification settings could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notification-center__push">
      {loading && supported ? <span>Loading push notification settings...</span> : supported && (publicKey || enabled) ? (
        <>
          <p>Message and shared dub details may appear on this device’s lock screen.</p>
          <Button disabled={busy} onClick={() => void toggle()} size="small" variant="secondary">
            {enabled ? "Disable push notifications" : "Enable push notifications"}
          </Button>
        </>
      ) : (
        !error && <span>{supported ? "Push notifications are not configured." : "Push notifications are unavailable in this browser."}</span>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
