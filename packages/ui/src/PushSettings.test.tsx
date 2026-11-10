import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PushSettings, removeDevicePushSubscription } from "../../../apps/web/src/components/PushSettings";

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalServiceWorker) Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  else Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("push settings", () => {
  it("requests permission only on opt-in, registers, and disables the device", async () => {
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/example",
      options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
      toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/example", keys: {} }),
      unsubscribe: vi.fn().mockResolvedValue(true),
    };
    const getSubscription = vi.fn().mockResolvedValue(null);
    const subscribe = vi.fn().mockResolvedValue(subscription);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true, value: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription, subscribe } }) },
    });
    const permission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("Notification", { requestPermission: permission });
    const fetchMock = vi.fn().mockImplementation(async (path: string) => ({
      ok: true, json: async () => path === "/api/push/config" ? { publicKey: "AQID" } : { status: "ok" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PushSettings />);
    const enable = await screen.findByRole("button", { name: "Enable push notifications" });
    expect(permission).not.toHaveBeenCalled();
    fireEvent.click(enable);
    await screen.findByRole("button", { name: "Disable push notifications" });
    expect(permission).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/push/subscription", expect.objectContaining({ method: "POST" }));
    getSubscription.mockResolvedValue(subscription);
    fireEvent.click(screen.getByRole("button", { name: "Disable push notifications" }));
    await screen.findByRole("button", { name: "Enable push notifications" });
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/push/subscription", expect.objectContaining({ method: "DELETE" }));
  });

  it("surfaces denied permission without subscribing", async () => {
    const subscribe = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true, value: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe } }) },
    });
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("denied") });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ publicKey: "AQID" }) }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PushSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "Enable push notifications" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("permission was not granted");
    expect(subscribe).not.toHaveBeenCalled();
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    consoleError.mockRestore();
  });

  it("does not unsubscribe the browser when the server cannot remove its subscription", async () => {
    const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/example", unsubscribe: vi.fn() };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true, value: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } }) },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Server unavailable" }) }));
    await expect(removeDevicePushSubscription()).rejects.toThrow("Server unavailable");
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });
});
