import { useEffect, useRef, useState } from "react";
import type {
  ArtistOption,
  Buddy,
  ChatConnectionStatus,
  ChatMessage,
  ChatMessagePage,
  Conversation,
  Dub,
  DubUploadFormValues,
  MemberProfile,
  NotificationMessage,
  NotificationType,
  UploadProgressState,
  ArtistRegistrationValues,
} from "@craft/ui";
import { uploadFile } from "../services/uploadFile";

export interface Crate {
  id: string;
  name: string;
  dubIds: string[];
}

interface CommunitySnapshot {
  member: MemberProfile;
  artists: ArtistOption[];
  dubs: Dub[];
  buddies: Buddy[];
  conversations: Conversation[];
  likedDubIds: string[];
  suggestedMembers: Array<{ username: string; displayName: string; genre: string }>;
  crates: Crate[];
}

interface CommunityState {
  member: MemberProfile | null;
  artists: ArtistOption[];
  dubs: Dub[];
  buddies: Buddy[];
  conversations: Conversation[];
  likedDubIds: Set<string>;
  suggestedMembers: CommunitySnapshot["suggestedMembers"];
  crates: Crate[];
  nowPlayingId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  playbackError: string | null;
}

interface ApiError {
  error?: string;
}

const initialState: CommunityState = {
  member: null,
  artists: [],
  dubs: [],
  buddies: [],
  conversations: [],
  likedDubIds: new Set(),
  suggestedMembers: [],
  crates: [],
  nowPlayingId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  shuffle: false,
  repeat: false,
  playbackError: null,
};

async function requestApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function jsonBody(value: unknown) {
  return JSON.stringify(value);
}

function mergeMessages(...groups: ChatMessage[][]) {
  const byId = new Map<string, ChatMessage>();
  for (const message of groups.flat()) byId.set(message.id, message);
  return [...byId.values()].sort((left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt));
}

export function useCommunity() {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [activeNotificationIds, setActiveNotificationIds] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");
  const [chatConnectionStatus, setChatConnectionStatus] =
    useState<ChatConnectionStatus>("disconnected");
  const notificationTimers = useRef(new Map<string, number>());
  const seenMessageIds = useRef(new Set<string>());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function notify(
    message: string,
    type: NotificationType = "success",
    conversationId?: string,
  ) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications((current) => [
      {
        id,
        message,
        type,
        createdAt: new Date().toISOString(),
        read: false,
        conversationId,
      },
      ...current,
    ].slice(0, 20));
    setActiveNotificationIds((current) => [id, ...current].slice(0, 3));
    const timeout = window.setTimeout(() => {
      setActiveNotificationIds((current) => current.filter((item) => item !== id));
      notificationTimers.current.delete(id);
    }, type === "error" ? 7000 : 4500);
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
    for (const timeout of notificationTimers.current.values()) {
      window.clearTimeout(timeout);
    }
    notificationTimers.current.clear();
    setNotifications([]);
    setActiveNotificationIds([]);
  }

  function markNotificationsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }

  function applySnapshot(
    snapshot: CommunitySnapshot,
    announceIncomingMessages = false,
  ) {
    const newMessages: Array<{ conversationId: string; message: string }> = [];
    for (const conversation of snapshot.conversations) {
      for (const message of conversation.messages) {
        if (
          announceIncomingMessages &&
          message.sender === "them" &&
          !seenMessageIds.current.has(message.id)
        ) {
          newMessages.push({
            conversationId: conversation.buddyId,
            message: message.text,
          });
        }
        seenMessageIds.current.add(message.id);
      }
    }
    setState((current) => ({
      ...current,
      member: snapshot.member,
      artists: snapshot.artists,
      dubs: snapshot.dubs,
      buddies: snapshot.buddies,
      conversations: snapshot.conversations.map((conversation) => {
        const existing = current.conversations.find((item) => item.buddyId === conversation.buddyId);
        return {
          ...conversation,
          messages: mergeMessages(existing?.messages ?? [], conversation.messages),
        };
      }),
      likedDubIds: new Set(snapshot.likedDubIds),
      suggestedMembers: snapshot.suggestedMembers,
      crates: snapshot.crates,
    }));
    for (const incoming of newMessages) {
      const buddyName = snapshot.buddies.find(
        (buddy) => buddy.id === incoming.conversationId,
      )?.displayName ?? "A friend";
      const excerpt = incoming.message.length > 100
        ? `${incoming.message.slice(0, 100)}...`
        : incoming.message;
      notify(`${buddyName} sent you a message: ${excerpt}`, "info", incoming.conversationId);
    }
  }

  async function refreshCommunity() {
    const snapshot = await requestApi<CommunitySnapshot>("/api/community");
    applySnapshot(snapshot);
    return snapshot;
  }

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;
    const updatePosition = () =>
      setState((current) => ({
        ...current,
        currentTime: audio.currentTime || 0,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }));
    const updatePlaying = () =>
      setState((current) => ({ ...current, isPlaying: !audio.paused }));
    const reportPlaybackError = () =>
      setState((current) => ({
        ...current,
        playbackError: "This audio file could not be loaded.",
        isPlaying: false,
      }));

    audio.addEventListener("timeupdate", updatePosition);
    audio.addEventListener("loadedmetadata", updatePosition);
    audio.addEventListener("play", updatePlaying);
    audio.addEventListener("pause", updatePlaying);
    audio.addEventListener("ended", updatePlaying);
    audio.addEventListener("error", reportPlaybackError);
    void refreshCommunity()
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && !loadError.message.includes("Sign in")) {
          setError(loadError.message);
        }
      })
      .finally(() => setLoading(false));

    return () => {
      audio.removeEventListener("timeupdate", updatePosition);
      audio.removeEventListener("loadedmetadata", updatePosition);
      audio.removeEventListener("play", updatePlaying);
      audio.removeEventListener("pause", updatePlaying);
      audio.removeEventListener("ended", updatePlaying);
      audio.removeEventListener("error", reportPlaybackError);
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
      for (const timeout of notificationTimers.current.values()) {
        window.clearTimeout(timeout);
      }
      notificationTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = state.volume;
    audio.loop = state.repeat;
  }, [state.repeat, state.volume]);

  useEffect(() => {
    if (!state.member) {
      setChatConnectionStatus("disconnected");
      return;
    }

    let active = true;
    let retryTimer: number | undefined;
    let retryAttempt = 0;
    let socket: WebSocket | undefined;
    const connect = () => {
      if (!active) return;
      setChatConnectionStatus(retryAttempt === 0 ? "connecting" : "reconnecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/chat`);
      socket.onopen = () => {
        retryAttempt = 0;
        setChatConnectionStatus("connected");
        void requestApi<CommunitySnapshot>("/api/community")
          .then((snapshot) => applySnapshot(snapshot, true))
          .catch((connectionError: unknown) => {
            if (active && connectionError instanceof Error && !connectionError.message.includes("Sign in")) {
              setError(connectionError.message);
            }
          });
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        let payload: { type?: string; snapshot?: CommunitySnapshot };
        try {
          payload = JSON.parse(event.data) as typeof payload;
        } catch {
          socket?.close(1002, "Invalid chat event");
          return;
        }
        if (payload.type === "community.snapshot" && payload.snapshot) {
          applySnapshot(payload.snapshot, true);
        }
      };
      socket.onerror = () => {
        setChatConnectionStatus("reconnecting");
      };
      socket.onclose = (event: CloseEvent) => {
        if (!active) return;
        if (event.reason === "Signed out" || event.code === 1008) {
          setState(initialState);
          setChatConnectionStatus("disconnected");
          return;
        }
        setChatConnectionStatus("reconnecting");
        retryAttempt += 1;
        const delay = Math.min(1000 * 2 ** (retryAttempt - 1), 15000);
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      socket?.close(1000, "Session ended");
    };
  }, [state.member?.id]);

  async function login(username: string, password: string) {
    setError("");
    await requestApi("/api/login", { method: "POST", body: jsonBody({ username, password }) });
    await refreshCommunity();
  }

  async function registerArtist(values: ArtistRegistrationValues) {
    setError("");
    await requestApi("/api/register", {
      method: "POST",
      body: jsonBody(values),
    });
    await refreshCommunity();
  }

  async function logout() {
    await requestApi("/api/logout", { method: "POST" });
    audioRef.current?.pause();
    seenMessageIds.current.clear();
    clearNotifications();
    setState(initialState);
  }

  async function downloadDub(dub: Dub) {
    try {
      const entitlement = await requestApi<{ audioUrl: string; audioFileName: string }>(
        `/api/dubs/${encodeURIComponent(dub.id)}/download`,
        { method: "POST" },
      );
      const link = document.createElement("a");
      link.href = entitlement.audioUrl;
      link.download = entitlement.audioFileName;
      document.body.append(link);
      link.click();
      link.remove();
      await refreshCommunity();
      notify(`Download recorded for ${dub.title}. Your like is counted once.`);
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "The download failed.", "error");
    }
  }

  function togglePlayback(dub: Dub) {
    const audio = audioRef.current;
    if (!audio) {
      notify("Audio playback is not ready yet. Please try again.", "error");
      return;
    }
    if (!dub.audioUrl) {
      const message = `The audio file for ${dub.title} is unavailable.`;
      setState((current) => ({ ...current, playbackError: message }));
      notify(message, "error");
      return;
    }
    const isCurrentTrack = audio.dataset.dubId === dub.id;
    if (isCurrentTrack && !audio.paused) {
      audio.pause();
      return;
    }
    if (!isCurrentTrack) {
      audio.pause();
      audio.dataset.dubId = dub.id;
      audio.src = dub.audioUrl;
      audio.currentTime = 0;
      setState((current) => ({
        ...current,
        nowPlayingId: dub.id,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackError: null,
      }));
    }
    void audio.play().catch(() => {
      const message = `Unable to play ${dub.title}. Check that the audio file is available.`;
      setState((current) => ({ ...current, playbackError: message, isPlaying: false }));
      notify(message, "error");
    });
  }

  function seekPlayback(timeSeconds: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(timeSeconds, audio.duration));
  }

  function setVolume(volume: number) {
    setState((current) => ({ ...current, volume: Math.max(0, Math.min(1, volume)) }));
  }

  function setShuffle(shuffle: boolean) {
    setState((current) => ({ ...current, shuffle }));
  }

  function setRepeat(repeat: boolean) {
    setState((current) => ({ ...current, repeat }));
  }

  function playAdjacentDub(direction: -1 | 1) {
    if (state.dubs.length === 0) return;
    const currentIndex = state.dubs.findIndex((dub) => dub.id === state.nowPlayingId);
    let nextIndex: number;
    if (state.shuffle && direction === 1 && state.dubs.length > 1) {
      const candidates = state.dubs.map((_, index) => index).filter((index) => index !== currentIndex);
      nextIndex = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      nextIndex = currentIndex === -1
        ? direction === 1 ? 0 : state.dubs.length - 1
        : (currentIndex + direction + state.dubs.length) % state.dubs.length;
    }
    togglePlayback(state.dubs[nextIndex]);
  }

  async function addDub(values: DubUploadFormValues): Promise<boolean> {
    let uploadId: string | undefined;
    let artworkUploadId: string | undefined;
    const totalBytes = values.audioFile.size + (values.artworkFile?.size ?? 0);
    let completedBytes = 0;
    setUploadError("");
    setUploadProgress({
      phase: "uploading",
      fileName: values.audioFile.name,
      progress: 0,
    });
    try {
      const onFileProgress = (file: File) => (loaded: number, total: number) => {
        const fileProgress = total > 0 ? Math.min(1, loaded / total) : 0;
        const progress = totalBytes > 0
          ? Math.floor(((completedBytes + file.size * fileProgress) / totalBytes) * 100)
          : 0;
        setUploadProgress({ phase: "uploading", fileName: file.name, progress });
      };
      const upload = await uploadFile(values.audioFile, "audio", onFileProgress(values.audioFile));
      uploadId = upload.uploadId;
      completedBytes += values.audioFile.size;
      if (values.artworkFile) {
        setUploadProgress({
          phase: "uploading",
          fileName: values.artworkFile.name,
          progress: totalBytes > 0
            ? Math.floor((completedBytes / totalBytes) * 100)
            : 0,
        });
        const artworkUpload = await uploadFile(
          values.artworkFile,
          "artwork",
          onFileProgress(values.artworkFile),
        );
        artworkUploadId = artworkUpload.uploadId;
      }
      setUploadProgress({ phase: "publishing", fileName: "", progress: 100 });
      await requestApi("/api/dubs", {
        method: "POST",
        body: jsonBody({
          title: values.title.trim(),
          artistId: values.artistId,
          genre: values.genre.trim(),
          bpm: values.bpm,
          message: values.message.trim(),
          uploadId,
          artworkUploadId,
        }),
      });
      await refreshCommunity();
      notify(`${values.title.trim()} was added to the Dub Feed.`);
      return true;
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : "The dub could not be uploaded.";
      setUploadError(message);
      if (uploadId) {
        await requestApi(`/api/uploads/${encodeURIComponent(uploadId)}`, { method: "DELETE" })
          .catch((cleanupError: unknown) => {
            notify(cleanupError instanceof Error ? cleanupError.message : "An unfinished upload could not be removed.", "error");
          });
      }
      if (artworkUploadId) {
        await requestApi(`/api/uploads/${encodeURIComponent(artworkUploadId)}`, { method: "DELETE" })
          .catch((cleanupError: unknown) => {
            notify(cleanupError instanceof Error ? cleanupError.message : "Unattached track artwork could not be removed.", "error");
          });
      }
      notify(message, "error");
      return false;
    } finally {
      setUploadProgress(null);
    }
  }

  async function addBuddy(username: string): Promise<string | null> {
    try {
      const snapshot = await requestApi<CommunitySnapshot>("/api/buddies", {
        method: "POST",
        body: jsonBody({ username }),
      });
      applySnapshot(snapshot);
      notify(`${username} added to your Friend List.`);
      return snapshot.buddies.find((buddy) => buddy.username === username)?.id ?? null;
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "The friend could not be added.", "error");
      return null;
    }
  }

  async function removeBuddy(buddyId: string) {
    try {
      const snapshot = await requestApi<CommunitySnapshot>(`/api/buddies/${encodeURIComponent(buddyId)}`, {
        method: "DELETE",
      });
      applySnapshot(snapshot);
      notify("Friend removed from your Friend List.");
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "The friend could not be removed.", "error");
    }
  }

  async function markConversationRead(buddyId: string) {
    try {
      applySnapshot(await requestApi<CommunitySnapshot>(
        `/api/conversations/${encodeURIComponent(buddyId)}/read`,
        { method: "POST" },
      ));
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Conversation could not be marked read.", "error");
    }
  }

  async function loadOlderMessages(buddyId: string, beforeId: string): Promise<ChatMessagePage | null> {
    try {
      const page = await requestApi<ChatMessagePage>(
        `/api/conversations/${encodeURIComponent(buddyId)}/messages?before=${encodeURIComponent(beforeId)}`,
      );
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.buddyId === buddyId
            ? {
                ...conversation,
                messages: mergeMessages(page.messages, conversation.messages),
                hasMoreMessages: page.hasMoreMessages,
              }
            : conversation,
        ),
      }));
      return page;
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Earlier messages could not be loaded.", "error");
      return null;
    }
  }

  async function sendMessage(buddyId: string, text: string, dubId?: string): Promise<boolean> {
    try {
      applySnapshot(await requestApi<CommunitySnapshot>(
        `/api/conversations/${encodeURIComponent(buddyId)}/messages`,
        { method: "POST", body: jsonBody({ text, dubId }) },
      ));
      return true;
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Message could not be sent.", "error");
      return false;
    }
  }

  async function createCrate(name: string): Promise<boolean> {
    try {
      const crate = await requestApi<Crate>("/api/crates", {
        method: "POST",
        body: jsonBody({ name }),
      });
      setState((current) => ({ ...current, crates: [...current.crates, crate] }));
      notify(`${crate.name} crate created.`);
      return true;
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Crate could not be created.", "error");
      return false;
    }
  }

  async function renameCrate(crateId: string, name: string): Promise<boolean> {
    try {
      const crate = await requestApi<Crate>(`/api/crates/${encodeURIComponent(crateId)}`, {
        method: "PATCH",
        body: jsonBody({ name }),
      });
      setState((current) => ({
        ...current,
        crates: current.crates.map((item) => item.id === crate.id ? crate : item),
      }));
      notify(`${crate.name} crate updated.`);
      return true;
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Crate could not be renamed.", "error");
      return false;
    }
  }

  async function deleteCrate(crateId: string): Promise<boolean> {
    try {
      await requestApi<{ id: string }>(`/api/crates/${encodeURIComponent(crateId)}`, {
        method: "DELETE",
      });
      setState((current) => ({
        ...current,
        crates: current.crates.filter((item) => item.id !== crateId),
      }));
      notify("Crate deleted. Its tracks remain in the Dub Feed.");
      return true;
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Crate could not be deleted.", "error");
      return false;
    }
  }

  async function updateCrateDub(crateId: string, dubId: string, add: boolean): Promise<boolean> {
    try {
      const crate = await requestApi<Crate>(
        `/api/crates/${encodeURIComponent(crateId)}/dubs/${encodeURIComponent(dubId)}`,
        { method: add ? "PUT" : "DELETE" },
      );
      setState((current) => ({
        ...current,
        crates: current.crates.map((item) => item.id === crate.id ? crate : item),
      }));
      notify(add ? "Dub saved to crate." : "Dub removed from crate.");
      return true;
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Crate could not be updated.", "error");
      return false;
    }
  }

  async function updateProfile(profile: Partial<Pick<MemberProfile, "displayName" | "bio" | "genre" | "role">>) {
    try {
      applySnapshot(await requestApi<CommunitySnapshot>("/api/profile", {
        method: "PATCH",
        body: jsonBody(profile),
      }));
      notify("Profile updated.");
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Profile could not be updated.", "error");
    }
  }

  const unreadCount = state.buddies.reduce((total, buddy) => total + (buddy.unread ?? 0), 0);
  const unreadNotificationCount = notifications.filter((item) => !item.read).length;

  return {
    state,
    loading,
    error,
    notifications,
    activeNotifications: notifications.filter((item) => activeNotificationIds.includes(item.id)),
    unreadNotificationCount,
    uploadProgress,
    uploadError,
    notify,
    dismissNotification,
    clearNotifications,
    markNotificationsRead,
    login,
    registerArtist,
    logout,
    refreshCommunity,
    downloadDub,
    togglePlayback,
    seekPlayback,
    setVolume,
    setShuffle,
    setRepeat,
    playNextDub: () => playAdjacentDub(1),
    playPreviousDub: () => playAdjacentDub(-1),
    addDub,
    addBuddy,
    removeBuddy,
    markConversationRead,
    loadOlderMessages,
    sendMessage,
    createCrate,
    renameCrate,
    deleteCrate,
    updateCrateDub,
    updateProfile,
    unreadCount,
    chatConnectionStatus,
  };
}
