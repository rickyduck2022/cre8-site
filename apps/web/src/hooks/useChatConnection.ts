import { useEffect, useRef, useState } from "react";
import type { ChatConnectionStatus } from "@craft/ui";

interface ChatSnapshot {
  type?: string;
  snapshot?: unknown;
}

export function useChatConnection<T>(
  memberId: string | undefined,
  refreshSnapshot: () => Promise<T>,
  applySnapshot: (snapshot: T, announceIncomingMessages: boolean) => void,
  onError: (error: Error) => void,
  onSignedOut: () => void,
) {
  const [status, setStatus] = useState<ChatConnectionStatus>("disconnected");
  const callbacks = useRef({ refreshSnapshot, applySnapshot, onError, onSignedOut });
  callbacks.current = { refreshSnapshot, applySnapshot, onError, onSignedOut };
  useEffect(() => {
    if (!memberId) { setStatus("disconnected"); return; }
    let active = true;
    let retryTimer: number | undefined;
    let retryAttempt = 0;
    let socket: WebSocket | undefined;
    const connect = () => {
      if (!active) return;
      setStatus(retryAttempt === 0 ? "connecting" : "reconnecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/chat`);
      socket.onopen = () => {
        retryAttempt = 0;
        setStatus("connected");
        void callbacks.current.refreshSnapshot()
          .then((snapshot) => callbacks.current.applySnapshot(snapshot, true))
          .catch((error: unknown) => {
            if (active && error instanceof Error && !error.message.includes("Sign in")) callbacks.current.onError(error);
          });
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        let payload: ChatSnapshot;
        try { payload = JSON.parse(event.data) as ChatSnapshot; }
        catch { socket?.close(1002, "Invalid chat event"); return; }
        if (payload.type === "community.snapshot" && payload.snapshot) {
          callbacks.current.applySnapshot(payload.snapshot as T, true);
        }
      };
      socket.onerror = () => setStatus("reconnecting");
      socket.onclose = (event: CloseEvent) => {
        if (!active) return;
        if (event.reason === "Signed out" || event.code === 1008) {
          callbacks.current.onSignedOut();
          setStatus("disconnected");
          return;
        }
        setStatus("reconnecting");
        retryAttempt += 1;
        retryTimer = window.setTimeout(connect, Math.min(1000 * 2 ** (retryAttempt - 1), 15000));
      };
    };
    connect();
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      socket?.close(1000, "Session ended");
    };
  }, [memberId]);
  return status;
}
