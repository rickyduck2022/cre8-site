import { useEffect, useRef, useState } from "react";
import type {
  ArtistOption,
  Buddy,
  ChatMessage,
  ChatMessagePage,
  Conversation,
  Dub,
  DubUploadFormValues,
  MemberProfile,
  UploadProgressState,
  ArtistRegistrationValues,
  LibraryDownload,
  AListApplication,
  AListApplicationFields,
  NotificationMessage,
} from "@craft/ui";
import { uploadFile } from "../services/uploadFile";
import { readAudioDurationSeconds } from "../services/readAudioDuration";
import { useAudioPlayback, type PlaybackPosition } from "./useAudioPlayback";
import { useChatConnection } from "./useChatConnection";
import { useNotifications } from "./useNotifications";

export interface Crate {
  id: string;
  name: string;
  dubIds: string[];
}

interface CommunitySnapshot {
  member: MemberProfile;
  lastPlayback: PlaybackPosition | null;
  artists: ArtistOption[];
  dubs: Dub[];
  buddies: Buddy[];
  conversations: Conversation[];
  likedDubIds: string[];
  suggestedMembers: Array<{ username: string; displayName: string; genre: string; avatarUrl?: string; aListApproved?: boolean }>;
  crates: Crate[];
  library: LibraryDownload[];
  aListApplication: AListApplication | null;
  notifications: NotificationMessage[];
}

interface CommunityState {
  member: MemberProfile | null;
  lastPlayback: PlaybackPosition | null;
  artists: ArtistOption[];
  dubs: Dub[];
  buddies: Buddy[];
  conversations: Conversation[];
  likedDubIds: Set<string>;
  suggestedMembers: CommunitySnapshot["suggestedMembers"];
  crates: Crate[];
  library: LibraryDownload[];
  aListApplication: AListApplication | null;
  serverNotifications: NotificationMessage[];
}

interface ApiError {
  error?: string;
}

const initialState: CommunityState = {
  member: null,
  lastPlayback: null,
  artists: [],
  dubs: [],
  buddies: [],
  conversations: [],
  likedDubIds: new Set(),
  suggestedMembers: [],
  crates: [],
  library: [],
  aListApplication: null,
  serverNotifications: [],
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
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");
  const seenMessageIds = useRef(new Set<string>());
  const notificationState = useNotifications();
  const { notify } = notificationState;
  const playback = useAudioPlayback(state.dubs, notify, state.member?.id, state.lastPlayback, async (position) => {
    await requestApi("/api/playback", { method: "PUT", body: jsonBody(position), keepalive: true });
  });

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
      lastPlayback: snapshot.lastPlayback,
      artists: snapshot.artists,
      dubs: snapshot.dubs,
      buddies: snapshot.buddies,
      conversations: snapshot.conversations.map((conversation) => {
        const existing = current.conversations.find((item) => item.buddyId === conversation.buddyId);
        return {
          ...conversation,
          messages: mergeMessages(
            (existing?.messages ?? []).map((message) =>
              message.dubId && !snapshot.dubs.some((dub) => dub.id === message.dubId)
                ? { ...message, dubId: undefined, text: "This dub is no longer available." }
                : message,
            ),
            conversation.messages,
          ),
        };
      }),
      likedDubIds: new Set(snapshot.likedDubIds),
      suggestedMembers: snapshot.suggestedMembers,
      crates: snapshot.crates,
      library: snapshot.library ?? [],
      aListApplication: snapshot.aListApplication,
      serverNotifications: snapshot.notifications,
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

  async function submitAListApplication(fields: AListApplicationFields) {
    try {
      await requestApi("/api/alist/application", { method: "POST", body: jsonBody(fields) });
      await refreshCommunity();
      notify("Your A-List application has been submitted.");
      return true;
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Application could not be submitted.", "error");
      return false;
    }
  }

  async function updateServerNotifications(path: string, method: "POST" | "DELETE") {
    try {
      applySnapshot(await requestApi<CommunitySnapshot>(path, { method }));
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Notifications could not be updated.", "error");
    }
  }

  const chatConnectionStatus = useChatConnection(
    state.member?.id,
    refreshCommunity,
    applySnapshot,
    (connectionError) => setError(connectionError.message),
    () => { playback.reset(); setState(initialState); },
  );

  useEffect(() => {
    void refreshCommunity()
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && !loadError.message.includes("Sign in")) {
          setError(loadError.message);
        }
      })
      .finally(() => setLoading(false));

  }, []);

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
    await playback.flushPosition();
    await requestApi("/api/logout", { method: "POST" });
    playback.reset();
    seenMessageIds.current.clear();
    notificationState.clearNotifications();
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

  async function addDub(values: DubUploadFormValues): Promise<Dub | null> {
    if (!values.audioFile) {
      setUploadError("Choose an audio file before sharing your dub.");
      return null;
    }
    let temporaryUploadIds: string[] = [];
    setUploadError("");
    try {
      const media = await uploadDubMedia(values.audioFile, values.artworkFile);
      temporaryUploadIds = media.uploadIds;
      setUploadProgress({ phase: "publishing", fileName: "", progress: 100 });
      const dub = await requestApi<Dub>("/api/dubs", {
        method: "POST",
        body: jsonBody({
          title: values.title.trim(),
          artistId: values.artistId,
          tags: values.tags,
          bpm: values.bpm,
          message: values.message.trim(),
          distribution: values.distribution ?? "worldwide",
          uploadId: media.audioUploadId,
          artworkUploadId: media.artworkUploadId,
          durationSeconds: media.durationSeconds,
        }),
      });
      temporaryUploadIds = [];
      await refreshCommunity();
      notify(`${values.title.trim()} was uploaded${dub.distribution === "private" ? " privately" : dub.distribution === "alist" ? " to A-List" : " to the Dub Feed"}.`);
      return dub;
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : "The dub could not be uploaded.";
      setUploadError(message);
      await cleanupDubUploads(temporaryUploadIds);
      notify(message, "error");
      return null;
    } finally {
      setUploadProgress(null);
    }
  }

  async function uploadDubMedia(audioFile?: File, artworkFile?: File) {
    const durationSeconds = audioFile
      ? await readAudioDurationSeconds(audioFile)
      : undefined;
    const files = [
      audioFile ? { file: audioFile, type: "audio" as const } : null,
      artworkFile ? { file: artworkFile, type: "artwork" as const } : null,
    ].filter((item): item is { file: File; type: "audio" | "artwork" } => Boolean(item));
    const totalBytes = files.reduce((total, item) => total + item.file.size, 0);
    let completedBytes = 0;
    const uploadIds: string[] = [];
    let audioUploadId: string | undefined;
    let artworkUploadId: string | undefined;

    try {
      for (const { file, type } of files) {
        setUploadProgress({ phase: "uploading", fileName: file.name, progress: 0 });
        const uploaded = await uploadFile(file, type, (loaded, total) => {
          const fileProgress = total > 0 ? Math.min(1, loaded / total) : 0;
          const progress = totalBytes > 0
            ? Math.floor(((completedBytes + file.size * fileProgress) / totalBytes) * 100)
            : 0;
          setUploadProgress({ phase: "uploading", fileName: file.name, progress });
        });
        uploadIds.push(uploaded.uploadId);
        if (type === "audio") audioUploadId = uploaded.uploadId;
        else artworkUploadId = uploaded.uploadId;
        completedBytes += file.size;
      }
    } catch (uploadError) {
      await cleanupDubUploads(uploadIds);
      throw uploadError;
    }
    return { audioUploadId, artworkUploadId, durationSeconds, uploadIds };
  }

  async function cleanupDubUploads(uploadIds: string[]) {
    await Promise.all(uploadIds.map((uploadId) =>
      requestApi(`/api/uploads/${encodeURIComponent(uploadId)}`, { method: "DELETE" })
        .catch((cleanupError: unknown) => {
          notify(cleanupError instanceof Error ? cleanupError.message : "An unfinished upload could not be removed.", "error");
        }),
    ));
  }

  async function updateDub(dubId: string, values: DubUploadFormValues): Promise<Dub | null> {
    let temporaryUploadIds: string[] = [];
    setUploadError("");
    try {
      const media = await uploadDubMedia(values.audioFile, values.artworkFile);
      temporaryUploadIds = media.uploadIds;
      setUploadProgress({ phase: "publishing", fileName: "", progress: 100 });
      const dub = await requestApi<Dub>(`/api/dubs/${encodeURIComponent(dubId)}`, {
        method: "PATCH",
        body: jsonBody({
          title: values.title.trim(),
          artistId: values.artistId,
          tags: values.tags,
          bpm: values.bpm,
          message: values.message.trim(),
          uploadId: media.audioUploadId,
          artworkUploadId: media.artworkUploadId,
          durationSeconds: media.durationSeconds,
        }),
      });
      temporaryUploadIds = [];
      if (values.audioFile && playback.state.nowPlayingId === dubId) playback.reset();
      await refreshCommunity();
      notify(`${dub.title} was updated.`);
      return dub;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "The dub could not be updated.";
      setUploadError(message);
      await cleanupDubUploads(temporaryUploadIds);
      notify(message, "error");
      return null;
    } finally {
      setUploadProgress(null);
    }
  }

  async function deleteDub(dubId: string): Promise<boolean> {
    try {
      await requestApi(`/api/dubs/${encodeURIComponent(dubId)}`, { method: "DELETE" });
      if (playback.state.nowPlayingId === dubId) playback.reset();
      await refreshCommunity();
      notify("Dub deleted.");
      return true;
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "The dub could not be deleted.", "error");
      return false;
    }
  }

  async function revokeDubGrant(dubId: string, userId: string) {
    try {
      const snapshot = await requestApi<CommunitySnapshot>(
        `/api/dubs/${encodeURIComponent(dubId)}/grants/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      applySnapshot(snapshot);
      notify("Private dub access revoked. Previously downloaded files cannot be recalled.");
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Access could not be revoked.", "error");
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
                messages: mergeMessages(
                  page.messages.map((message) =>
                    message.dubId && !current.dubs.some((dub) => dub.id === message.dubId)
                      ? { ...message, dubId: undefined, text: "This dub is no longer available." }
                      : message,
                  ),
                  conversation.messages,
                ),
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

  async function unsendMessage(buddyId: string, messageId: string): Promise<boolean> {
    try {
      applySnapshot(await requestApi<CommunitySnapshot>(
        `/api/conversations/${encodeURIComponent(buddyId)}/messages/${encodeURIComponent(messageId)}`,
        { method: "DELETE" },
      ));
      notify("Message unsent.");
      return true;
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Message could not be unsent.", "error");
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

  async function updateProfile(profile: Partial<Pick<MemberProfile, "displayName" | "bio" | "genre" | "role" | "links">> & { avatarFile?: File; bannerFile?: File }): Promise<boolean> {
    const uploadIds: string[] = [];
    try {
      const { avatarFile, bannerFile, ...profileFields } = profile;
      const uploadReferences: { avatarUploadId?: string; bannerUploadId?: string } = {};
      for (const [file, type, field] of [
        [avatarFile, "avatar", "avatarUploadId"],
        [bannerFile, "banner", "bannerUploadId"],
      ] as const) {
        if (!file) continue;
        const upload = await uploadFile(file, type, () => undefined);
        uploadReferences[field] = upload.uploadId;
        uploadIds.push(upload.uploadId);
      }
      applySnapshot(await requestApi<CommunitySnapshot>("/api/profile", {
        method: "PATCH",
        body: jsonBody({ ...profileFields, ...uploadReferences }),
      }));
      notify("Profile updated.");
      return true;
    } catch (requestError) {
      await Promise.all(uploadIds.map((uploadId) => requestApi(`/api/uploads/${encodeURIComponent(uploadId)}`, { method: "DELETE" }).catch(() => undefined)));
      notify(requestError instanceof Error ? requestError.message : "Profile could not be updated.", "error");
      return false;
    }
  }

  const unreadCount = state.buddies.reduce((total, buddy) => total + (buddy.unread ?? 0), 0);
  return {
    state: { ...state, ...playback.state },
    loading,
    error,
    ...notificationState,
    notifications: [...state.serverNotifications, ...notificationState.notifications].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    unreadNotificationCount: state.serverNotifications.filter((item) => !item.read).length + notificationState.unreadNotificationCount,
    dismissNotification: (id: string) => {
      if (state.serverNotifications.some((item) => item.id === id)) void updateServerNotifications(`/api/notifications/${encodeURIComponent(id)}`, "DELETE");
      else notificationState.dismissNotification(id);
    },
    clearNotifications: () => {
      notificationState.clearNotifications();
      if (state.serverNotifications.length) void updateServerNotifications("/api/notifications", "DELETE");
    },
    markNotificationsRead: () => {
      notificationState.markNotificationsRead();
      if (state.serverNotifications.some((item) => !item.read)) void updateServerNotifications("/api/notifications/read", "POST");
    },
    uploadProgress,
    uploadError,
    notify,
    submitAListApplication,
    login,
    registerArtist,
    logout,
    refreshCommunity,
    downloadDub,
    togglePlayback: playback.togglePlayback,
    seekPlayback: playback.seekPlayback,
    seekPlaybackProgress: playback.seekPlaybackProgress,
    setVolume: playback.setVolume,
    setShuffle: playback.setShuffle,
    setRepeat: playback.setRepeat,
    playNextDub: playback.playNextDub,
    playPreviousDub: playback.playPreviousDub,
    addDub,
    updateDub,
    deleteDub,
    revokeDubGrant,
    addBuddy,
    removeBuddy,
    markConversationRead,
    loadOlderMessages,
    sendMessage,
    unsendMessage,
    createCrate,
    renameCrate,
    deleteCrate,
    updateCrateDub,
    updateProfile,
    unreadCount,
    chatConnectionStatus,
  };
}
