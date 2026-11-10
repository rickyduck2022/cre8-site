import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import {
  Friends,
  FriendsFeed,
  Download,
  Disc3,
  AudioLines,
  MessageCircle,
  LockKeyhole,
  Users,
} from "@craft/icons";
import {
  AppHeader,
  ArtistCard,
  ArtistRegistrationForm,
  BuddyListTemplate,
  Button,
  DashboardTemplate,
  DubManagementDialogs,
  DubUploadForm,
  EditProfileDialog,
  LatestDubsTemplate,
  HistoryNavigation,
  LibraryTemplate,
  MyDubsTemplate,
  MessengerTemplate,
  MobileNavigation,
  Modal,
  Navigation,
  NotificationViewport,
  ProfileTemplate,
  ShareDubDialog,
  SharePackDialog,
  canSharePack,
  canShareDub,
  SharedWithMeTemplate,
  shareDubToFriends,
  createEmptyDubSearchFilters,
  getDubSearchFilterCount,
  type DubSearchFilters,
  type Dub,
  type DubPack,
  type NotificationMessage,
  type NavigationSection,
  type MediaKind,
} from "@craft/ui";
import { DemoModeNotice } from "../components/DemoModeNotice";
import { AListApplication } from "../components/AListApplication";
import { AppPlayer } from "../components/AppPlayer";
import { PackWorkspace } from "../components/PackWorkspace";
import { PackWindows, type PackWindowState } from "../components/PackWindows";
import { downloadPack } from "../services/packs";
import { PushSettings, removeDevicePushSubscription } from "../components/PushSettings";
import { useCommunity } from "../hooks/useCommunity";
import { useMemberSearch } from "../hooks/useMemberSearch";
import { useDubSearch } from "../hooks/useDubSearch";
import { usePlayerLayout } from "../hooks/usePlayerLayout";
import { useAppHistory } from "../hooks/useAppHistory";
import { externalDubUrl, returnToSharedDub } from "../services/externalDubLinks";
import { downloadDubFile } from "../services/downloadDubFile";
import type { CommunitySection } from "../types/community";
import "./App.css";

const sectionLabels: Record<CommunitySection, string> = {
  dubs: "Dub Vault",
  samples: "Sample Vault",
  alist: "A-List",
  "shared-with-me": "Dubs shared with you",
  "shared-samples": "Samples shared with you",
  "alist-application": "A-List Submission",
  buddies: "Friend List",
  messenger: "Messenger",
  profile: "My Profile",
  library: "My Library",
  "my-dubs": "Your Dubs",
  "my-samples": "Your Samples",
};

const sectionIcons: Record<CommunitySection, ReactNode> = {
  dubs: <FriendsFeed />,
  samples: <AudioLines />,
  alist: <Disc3 />,
  "alist-application": <Users />,
  buddies: <Friends />,
  messenger: <MessageCircle />,
  profile: <Users />,
  library: <Download />,
  "shared-with-me": <LockKeyhole />,
  "shared-samples": <LockKeyhole />,
  "my-dubs": <Disc3 />,
  "my-samples": <AudioLines />,
};

const sections = Object.keys(sectionLabels) as CommunitySection[];
const cre8LogoSrc = "/cre8-main-logo.png";

function isFeedDub(dub: Dub, aListFeed: boolean, approved: boolean, includePrivate = false): boolean {
  return aListFeed
    ? dub.distribution === "alist" && approved
    : dub.distribution === "worldwide" || (dub.distribution === "alist" && (approved || dub.aListPublic === true)) || (dub.distribution === "private" && includePrivate);
}

function getSectionFromHash(hash: string): CommunitySection {
  const section = hash.replace(/^#/, "").split("?")[0] as CommunitySection;
  return sections.includes(section) ? section : "dubs";
}

function createNavigationSections(unreadCount: number, aListApproved: boolean, sharedCount: number, feedCount: number, aListCount: number, sampleCount: number, sharedSampleCount: number): NavigationSection[] {
  const groups: { label: string; mediaKind?: MediaKind; sections: CommunitySection[] }[] = [
    { label: "Dubs", mediaKind: "dub", sections: ["dubs", "my-dubs", "shared-with-me"] },
    { label: "Samples", mediaKind: "sample", sections: ["samples", "my-samples", "shared-samples"] },
    { label: "Your space", sections: sections.filter((section) => !["dubs", "my-dubs", "samples", "my-samples", "shared-with-me", "shared-samples"].includes(section)) },
  ];
  return groups.map((group) => ({
      label: group.label,
      items: group.sections.filter((section) => section !== "alist" || aListApproved).map((section) => ({
        label: sectionLabels[section],
        icon: sectionIcons[section],
        href: `#${section}`,
        mediaKind: group.mediaKind,
        variant: section === "alist" ? "alist" as const : section === "shared-with-me" || section === "shared-samples" ? "private" as const : undefined,
        badge:
          section === "dubs"
            ? String(feedCount)
            : section === "samples"
            ? String(sampleCount)
            : section === "alist"
            ? String(aListCount)
            : section === "shared-with-me"
            ? String(sharedCount)
            : section === "shared-samples"
            ? String(sharedSampleCount)
            : section === "messenger" && unreadCount > 0
            ? String(unreadCount)
            : undefined,
      })),
    }));
}

export function App({ appStatus }: { appStatus?: ReactNode } = {}) {
  const {
    state,
    chatConnectionStatus,
    loading,
    error,
    notifications,
    activeNotifications,
    unreadNotificationCount,
    uploadProgress,
    uploadError,
    notify,
    dismissNotification,
    clearNotifications,
    markNotificationsRead,
    login,
    retryConnection,
    registerArtist,
    logout,
    downloadDub,
    updateDubPreview,
    togglePlayback,
    closePlayer,
    seekPlayback,
    seekPlaybackProgress,
    setVolume,
    setShuffle,
    setRepeat,
    playNextDub,
    playPreviousDub,
    playPack,
    activatePackQueue,
    refreshCommunity,
    addDub,
    updateDub,
    deleteDub,
    revokeDubGrant,
    submitAListApplication,
    addBuddy,
    removeBuddy,
    markConversationRead,
    loadOlderMessages,
    sendMessage,
    sendPackMessage,
    shareDubWithAListMember,
    unsendMessage,
    updateProfile,
    unreadCount,
  } = useCommunity();
  const [activeSection, setActiveSection] = useState<CommunitySection>(() =>
    getSectionFromHash(window.location.hash),
  );
  const [profileUsername, setProfileUsername] = useState(() => new URLSearchParams(window.location.hash.split("?")[1]).get("user") ?? "");
  const [chatBuddyId, setChatBuddyId] = useState(() => new URLSearchParams(window.location.hash.split("?")[1]).get("buddy") ?? "");
  const [chatNavigationKey, setChatNavigationKey] = useState(0);
  const history = useAppHistory(() => {
    const section = getSectionFromHash(window.location.hash);
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    setActiveSection(section);
    setProfileUsername(section === "profile" ? params.get("user") ?? "" : "");
    setChatBuddyId(section === "messenger" ? params.get("buddy") ?? "" : "");
    setChatNavigationKey((key) => key + 1);
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [feedFilters, setFeedFilters] = useState<DubSearchFilters>(createEmptyDubSearchFilters);
  const [sampleFilters, setSampleFilters] = useState<DubSearchFilters>(createEmptyDubSearchFilters);
  const [aListFilters, setAListFilters] = useState<DubSearchFilters>(createEmptyDubSearchFilters);
  const vaultKind = activeSection === "samples" ? "sample" : activeSection === "dubs" ? "dub" : undefined;
  const dubSearchFilters = activeSection === "alist" ? aListFilters : activeSection === "samples" ? sampleFilters : feedFilters;
  const setDubSearchFilters = activeSection === "alist" ? setAListFilters : activeSection === "samples" ? setSampleFilters : setFeedFilters;
  const dubSearch = useDubSearch(searchQuery, dubSearchFilters, Boolean(vaultKind) || (activeSection === "alist" && state.member?.aListApproved === true), activeSection === "alist" ? "alist" : "feed", vaultKind);
  const isDubSearchActive = Boolean(searchQuery.trim() || getDubSearchFilterCount(dubSearchFilters));
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const { members: memberSearchResults, isSearching: isSearchingMembers } = useMemberSearch(memberSearchQuery);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [myDubsTab, setMyDubsTab] = useState<"dubs" | "packs">("dubs");
  const [mySamplesTab, setMySamplesTab] = useState<"dubs" | "packs">("dubs");
  const isMySamples = activeSection === "my-samples";
  const ownedMediaKind = isMySamples ? "sample" : "dub";
  const ownedMediaTitle = isMySamples ? "Your Samples" : "Your Dubs";
  const ownedMediaTab = isMySamples ? mySamplesTab : myDubsTab;
  const setOwnedMediaTab = isMySamples ? setMySamplesTab : setMyDubsTab;
  const [createPack, setCreatePack] = useState(false);
  const [pendingPackDub, setPendingPackDub] = useState<Dub | null>(null);
  const [pendingEditPack, setPendingEditPack] = useState<DubPack | null>(null);
  const [packWindows, setPackWindows] = useState<PackWindowState[]>([]);
  const [isUploadSubmitting, setIsUploadSubmitting] = useState(false);
  const [publishedDub, setPublishedDub] = useState<Dub | null>(null);
  const [editingDub, setEditingDub] = useState<Dub | null>(null);
  const [deletingDub, setDeletingDub] = useState<Dub | null>(null);
  const [shareDubTargetId, setShareDubTargetId] = useState<string | null>(null);
  const [sharingDub, setSharingDub] = useState<{ dub: Dub; failedIds?: string[]; sentIds?: string[] } | null>(null);
  const [sharingPack, setSharingPack] = useState<DubPack | null>(null);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isStartConversationOpen, setIsStartConversationOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [registrationPending, setRegistrationPending] = useState(false);
  const memberBuddyIds = useRef(new Map<string, string>());
  useEffect(() => { setPublishedDub(null); }, [state.member?.id]);
  useEffect(() => { setPackWindows([]); }, [state.member?.id]);

  const sharedDubs = state.dubs.filter((dub) => state.sharedDubIds.has(dub.id));
  const sharedDubCount = sharedDubs.filter((dub) => (dub.mediaKind ?? "dub") === "dub").length;
  const sharedSampleCount = sharedDubs.length - sharedDubCount;
  const sharedMediaKind = activeSection === "shared-samples" ? "sample" : "dub";
  const approved = state.member?.aListApproved === true;
  useEffect(() => {
    if (state.member) returnToSharedDub();
  }, [state.member?.id]);
  const vaultDubs = vaultKind ? state.dubs.filter((dub) => (dub.mediaKind ?? "dub") === vaultKind) : state.dubs;
  const feedCount = state.dubs.filter((dub) => (dub.mediaKind ?? "dub") === "dub" && isFeedDub(dub, false, approved)).length;
  const sampleCount = state.dubs.filter((dub) => dub.mediaKind === "sample" && isFeedDub(dub, false, approved)).length;
  const aListCount = state.dubs.filter((dub) => isFeedDub(dub, true, approved)).length;
  const navigationSections = useMemo(
    () => createNavigationSections(unreadCount, approved, sharedDubCount, feedCount, aListCount, sampleCount, sharedSampleCount),
    [unreadCount, approved, sharedDubCount, feedCount, aListCount, sampleCount, sharedSampleCount],
  );
  const interactiveNavigationSections = navigationSections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      return { ...item, onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        if (!item.href || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        history.navigate(item.href);
      } };
    }),
  }));
  const previewTrack = state.dubs.find((dub) => dub.id === state.nowPlayingId) ?? null;
  const playerLayout = usePlayerLayout({
    activeSection,
    hasTrack: Boolean(previewTrack),
    enabled: !loading && Boolean(state.member),
  });
  const openPackWindow = (pack: DubPack) => {
    setPackWindows((current) => [...current.filter((item) => item.pack.id !== pack.id),
      { pack, openRequest: (current.find((item) => item.pack.id === pack.id)?.openRequest ?? 0) + 1 }]);
  };
  const dubsById = new Map(state.dubs.map((dub) => [dub.id, dub]));
  const suggestedByUsername = new Map(state.suggestedMembers.map((member) => [member.username, member]));
  const profile =
    profileUsername === state.member?.username || !profileUsername
      ? state.member
      : state.buddies.find((buddy) => buddy.username === profileUsername) ??
        state.suggestedMembers.find((member) => member.username === profileUsername) ??
        null;
  const isOwnProfile = profile?.username === state.member?.username;
  const myDubs = state.member
    ? state.dubs.filter((dub) => dub.uploader === state.member?.username)
    : [];
  const ownedMedia = myDubs.filter((dub) => (dub.mediaKind ?? "dub") === ownedMediaKind);
  const ownedPacks = state.member ? state.packs.filter((pack) => pack.kind === ownedMediaKind && pack.ownerUsername === state.member?.username) : [];
  const packPlaybackControls = {
    activePackId: state.queuePackId,
    onActivateQueue: activatePackQueue, onPrevious: playPreviousDub, onNext: playNextDub,
    onShuffleChange: setShuffle, onRepeatChange: setRepeat, shuffle: state.shuffle, repeat: state.repeat,
  };
  const activePack = state.queuePackId ? state.packs.find((pack) => pack.id === state.queuePackId
    && pack.items.some(({ dub }) => dub.id === previewTrack?.id)) ?? null : null;
  const sharingUsername = state.member?.username;
  const sharePack = sharingUsername
    ? state.packs.find((pack) => pack.id === sharingPack?.id && canSharePack(pack, sharingUsername))
    : undefined;
  function beginSharingPack(pack: DubPack) {
    if (state.member && canSharePack(pack, state.member.username)) setSharingPack(pack);
    else notify("Only the uploader can share a private pack.", "error");
  }
  async function handleDownloadPack(pack: DubPack) {
    await downloadPack(pack.id);
    await refreshCommunity();
  }
  const profileUploads = isOwnProfile
    ? myDubs
    : state.dubs.filter((dub) => dub.uploader === profile?.username && (dub.distribution === "worldwide" || (dub.distribution === "alist" && dub.aListPublic === true)));
  const aListMembers = [
    ...state.buddies.filter((buddy) => buddy.aListApproved === true && buddy.userId).map((buddy) => ({ ...buddy, id: `member:${buddy.userId}` })),
    ...state.suggestedMembers.filter((member) => member.aListApproved === true).map((member) => ({ ...member, id: `member:${member.id}` })),
  ];
  function shareDialogId(id: string, dub: Dub) {
    if (dub.distribution !== "alist" || dub.aListPublic === true || id.startsWith("member:")) return id;
    const userId = state.buddies.find((buddy) => buddy.id === id)?.userId;
    return userId ? `member:${userId}` : id;
  }
  const profileBuddy = state.buddies.find((buddy) => buddy.username === profile?.username);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    function openPushConversation(event: MessageEvent) {
      if (event.data?.type !== "push.openConversation" || typeof event.data.buddyId !== "string" || !event.data.buddyId) return;
      history.navigate(`#messenger?${new URLSearchParams({ buddy: event.data.buddyId })}`);
    }
    navigator.serviceWorker.addEventListener("message", openPushConversation);
    return () => navigator.serviceWorker.removeEventListener("message", openPushConversation);
  }, []);

  function navigateTo(section: CommunitySection) {
    history.navigate(`#${section}`);
  }

  function openProfile(username: string) {
    history.navigate(`#profile?${new URLSearchParams({ user: username })}`);
  }

  function openChat(buddyId: string) {
    void markConversationRead(buddyId);
    history.navigate(`#messenger?${new URLSearchParams({ buddy: buddyId })}`);
  }

  function beginDubEdit(dub: Dub) {
    setEditingDub(dub);
  }

  function beginPackEdit(pack: DubPack) {
    if (pack.ownerUsername !== state.member?.username) return;
    setCreatePack(false);
    setPendingPackDub(null);
    setPendingEditPack(pack);
    if (pack.kind === "sample") setMySamplesTab("packs");
    else setMyDubsTab("packs");
    navigateTo(pack.kind === "sample" ? "my-samples" : "my-dubs");
  }

  function beginDubDelete(dub: Dub) {
    setDeletingDub(dub);
  }

  function openNotification(notification: NotificationMessage) {
    if (notification.conversationId) openChat(notification.conversationId);
  }

  async function startConversation(username: string) {
    const buddyId = await addBuddy(username);
    if (!buddyId) return;
    setIsStartConversationOpen(false);
    openChat(buddyId);
  }

  async function handleShareDub(values: Parameters<typeof addDub>[0]) {
    if (shareDubTargetId && values.distribution === "alist" && values.aListPublic !== true
      && !state.buddies.some((buddy) => buddy.id === shareDubTargetId && buddy.aListApproved === true)) {
      notify("This recipient must be an approved A-List member for a restricted A-List dub. Enable Public or choose another distribution.", "error");
      return false;
    }
    setIsUploadSubmitting(true);
    try {
      const dub = await addDub(values);
      if (!dub) return false;
      setPublishedDub(dub);
      const targetIds = dub.distribution === "private"
        ? values.buddyIds ?? []
        : shareDubTargetId ? [shareDubTargetId] : [];
      const result = await shareDubToFriends(targetIds, dub.id, `Shared a dub: ${dub.title}`, sendMessage);
      setIsUploadOpen(false);
      setShareDubTargetId(null);
      if (result.failed.length) {
        notify(`${dub.title} was uploaded, but could not be sent to every selected friend. Retry without uploading again.`, "error");
        setSharingDub({ dub, failedIds: result.failed, sentIds: result.sent });
        navigateTo("my-dubs");
      } else if (targetIds.length === 1) {
        openChat(targetIds[0]);
      } else {
        if (targetIds.length > 1) notify(`${dub.title} was sent to ${targetIds.length} friends in Messenger.`);
        navigateTo(dub.distribution === "private" ? "my-dubs" : dub.distribution === "alist" ? "alist" : "dubs");
      }
      return dub;
    } finally {
      setIsUploadSubmitting(false);
    }
  }

  function beginSharingDub(dub: Dub) {
    setSharingDub({ dub });
  }

  async function sendToRecipient(recipientId: string, text: string, dubId: string): Promise<boolean> {
    if (!recipientId.startsWith("member:")) return sendMessage(recipientId, text, dubId);
    const userId = recipientId.slice("member:".length);
    const buddyId = await shareDubWithAListMember(userId, text, dubId);
    if (!buddyId) return false;
    memberBuddyIds.current.set(userId, buddyId);
    return true;
  }

  async function handleUpdateDub(dubId: string, values: Parameters<typeof updateDub>[1]) {
    const dub = await updateDub(dubId, values);
    if (!dub) return null;
    const targetIds = values.buddyIds ?? [];
    const result = await shareDubToFriends(targetIds, dub.id, `Shared a dub: ${dub.title}`, sendToRecipient);
    if (result.failed.length) {
      notify(`${dub.title} was saved, but could not be sent to every selected friend. Retry without saving again.`, "error");
      setSharingDub({ dub, failedIds: result.failed, sentIds: result.sent });
    } else if (targetIds.length) {
      notify(`${dub.title} was sent to ${targetIds.length} ${targetIds.length === 1 ? "friend" : "friends"} in Messenger.`);
    }
    return dub;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    try {
      await login(loginUsername, loginPassword);
      returnToSharedDub();
    } catch (loginRequestError) {
      setLoginError(
        loginRequestError instanceof Error
          ? loginRequestError.message
          : "Sign-in failed.",
      );
    }
  }

  async function handleRegister(values: Parameters<typeof registerArtist>[0]) {
    setRegistrationError("");
    setRegistrationPending(true);
    try {
      await registerArtist(values);
      returnToSharedDub();
    } catch (registrationRequestError) {
      setRegistrationError(
        registrationRequestError instanceof Error
          ? registrationRequestError.message
          : "Account registration failed.",
      );
    } finally {
      setRegistrationPending(false);
    }
  }

  if (loading) {
    return <main className="app-login"><p>Connecting to cre8...</p></main>;
  }

  if (!state.member) {
    return (
      <main className="app-login app-login--auth">
        <section className="app-login__card">
          {appStatus}
          <img className="app-login__logo" src={cre8LogoSrc} alt="Cre8 Messenger · Wear Cre8 DnB" />
          <span className="eyebrow">{isRegistering ? "JOIN THE COMMUNITY" : "WELCOME BACK"}</span>
          <h1>{isRegistering ? "Create your artist account" : "Sign in to cre8"}</h1>
          <p>
            {isRegistering
              ? "Build your artist profile and share your dubs."
              : "Pick up where your community left off."}
          </p>
          {isRegistering ? (
            <ArtistRegistrationForm
              error={registrationError}
              isSubmitting={registrationPending}
              onSubmit={(values) => void handleRegister(values)}
              onSwitchToSignIn={() => {
                setIsRegistering(false);
                setRegistrationError("");
              }}
            />
          ) : (
            <>
              {(loginError || error) && (
                <p className="app-login__error" role="alert">{loginError || error}</p>
              )}
              {error && <Button onClick={() => void retryConnection()} type="button" variant="secondary">Retry connection</Button>}
              <form className="app-login__form" onSubmit={handleLogin}>
                <label>
                  <span>Username</span>
                  <input
                    autoComplete="username"
                    onChange={(event) => setLoginUsername(event.currentTarget.value)}
                    required
                    value={loginUsername}
                  />
                </label>
                <label>
                  <span>Password</span>
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setLoginPassword(event.currentTarget.value)}
                    required
                    type="password"
                    value={loginPassword}
                  />
                </label>
                <Button type="submit">Sign in</Button>
              </form>
              <div className="app-login__register">
                <span>New to cre8?</span>
                <Button
                  onClick={() => {
                    setIsRegistering(true);
                    setLoginError("");
                    setRegistrationError("");
                  }}
                  type="button"
                  variant="tertiary"
                >
                  Sign up as an artist
                </Button>
              </div>
              <small>Starter accounts: meladee / meladee · holik / holik</small>
            </>
          )}
        </section>
      </main>
    );
  }
  return (
    <DashboardTemplate
      className={`community-dashboard-template ${playerLayout.dashboardClassName}${activeSection === "messenger" ? " community-dashboard-template--messenger" : ""}`}
      scrollContent
      scrollResetKey={activeSection}
      header={
        <div className="app-header-region">
        <AppHeader
          className="app-topbar"
          leading={<HistoryNavigation canGoBack={history.canGoBack} onBack={history.goBack} />}
          logoSrc={cre8LogoSrc}
          onCreate={() => setIsUploadOpen(true)}
          onEditProfile={() => setIsProfileEditOpen(true)}
          onLogout={() => {
            void removeDevicePushSubscription().then(logout).catch((logoutError: unknown) => {
              notify(
                logoutError instanceof Error
                  ? logoutError.message
                  : "Sign out failed.",
                "error",
              );
            });
          }}
          notifications={notifications}
          pushSettings={<PushSettings />}
          onClearNotifications={clearNotifications}
          onDismissNotification={dismissNotification}
          onActivateNotification={openNotification}
          onMessages={() => {
            setChatBuddyId("");
            setChatNavigationKey((key) => key + 1);
            navigateTo("messenger");
          }}
          onNotifications={markNotificationsRead}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search tracks or members"
          searchValue={searchQuery}
          unreadNotificationCount={unreadNotificationCount}
          unreadMessageCount={unreadCount}
          userName={state.member.displayName}
          userAvatarUrl={state.member.avatarUrl}
          variant="compact"
        />
        {appStatus}
        {previewTrack && playerLayout.isHeader && <div aria-hidden="true" className="app-header-player-slot" />}
        </div>
      }
      navigation={
        <Navigation
          activeItem={sectionLabels[activeSection]}
          className="app-sidebar"
          hideOnMobile
          logoSrc={cre8LogoSrc}
          sections={interactiveNavigationSections}
          userDetail={state.member.role}
          userName={state.member.displayName}
          userAvatarUrl={state.member.avatarUrl}
          onUserProfile={() => { if (state.member) openProfile(state.member.username); }}
        />
      }
      footer={
        <footer className="app-sticky-footer" aria-label="Media and navigation">
        <AppPlayer
          track={previewTrack}
          pack={activePack}
          onShare={activePack
            ? canSharePack(activePack, state.member.username) ? () => beginSharingPack(activePack) : undefined
            : previewTrack && canShareDub(previewTrack, state.member.username) ? () => beginSharingDub(previewTrack) : undefined}
          onDownload={previewTrack ? () => activePack ? handleDownloadPack(activePack) : downloadDub(previewTrack) : undefined}
          playlist={activePack ? {
            ...packPlaybackControls, nowPlayingId: state.nowPlayingId, isPlaying: state.isPlaying,
            likedDubIds: state.likedDubIds, onPlay: togglePlayback, onPlayAll: playPack, onDownload: downloadDub,
            onSeek: seekPlayback, onSeekProgress: seekPlaybackProgress, currentTimeSeconds: state.currentTime,
            durationSeconds: state.duration, volume: state.volume, onVolumeChange: setVolume,
            playbackError: state.playbackError, onOpenProfile: openProfile,
          } : undefined}
          layout={playerLayout}
          onOpenProfile={openProfile}
          playback={{
            onClose: closePlayer,
            playing: state.isPlaying,
            currentTimeSeconds: state.currentTime,
            durationSeconds: state.nowPlayingId === previewTrack?.id ? state.duration : undefined,
            volume: state.volume,
            shuffle: state.shuffle,
            repeat: state.repeat,
            playbackError: state.playbackError,
            onPlayChange: (playing) => {
              if (previewTrack && playing !== state.isPlaying) togglePlayback(previewTrack);
            },
            onSeek: (time) => { if (previewTrack) seekPlayback(time, previewTrack); },
            onSeekProgress: (progress) => { if (previewTrack) seekPlaybackProgress(progress, previewTrack); },
            onVolumeChange: setVolume,
            onShuffleChange: setShuffle,
            onRepeatChange: setRepeat,
            onPrevious: playPreviousDub,
            onNext: playNextDub,
          }}
        />
        <MobileNavigation activeItem={sectionLabels[activeSection]}
          primaryHrefs={["#dubs", "#samples", "#profile", "#messenger"]}
          sections={interactiveNavigationSections} />
        </footer>
      }
    >
      <div className={`app-content${activeSection === "messenger" ? " app-content--messenger" : ""}`}>
        {activeSection !== "messenger" && <DemoModeNotice />}
        {publishedDub && activeSection !== "my-dubs" && activeSection !== "my-samples" && activeSection !== "messenger" && (
          <section className="app-published-dub" aria-label="Published dub">
            <p><strong>{publishedDub.title}</strong> is published. Manage its details and access in Your Dubs.</p>
            <Button onClick={() => { navigateTo("my-dubs"); setPublishedDub(null); }} size="small">View in Your Dubs</Button>
            <Button onClick={() => setPublishedDub(null)} size="small" variant="tertiary" aria-label="Dismiss published dub shortcut">Dismiss</Button>
          </section>
        )}
        {(vaultKind || (activeSection === "alist" && state.member.aListApproved)) && (
          <>
            <LatestDubsTemplate
              key={activeSection}
              packs={vaultKind ? state.packs.filter((pack) => pack.kind === vaultKind) : state.packs}
              mediaKind={vaultKind}
              activePackId={state.queuePackId} onActivateQueue={activatePackQueue}
              onPlayPack={playPack}
              onSharePack={beginSharingPack}
              onOpenPack={openPackWindow}
              onEditPack={beginPackEdit}
              onDownloadPack={async (pack) => { await downloadPack(pack.id); await refreshCommunity(); }}
              dubs={isDubSearchActive ? (dubSearch.results ?? []).map((dub) => {
                const current = dubsById.get(dub.id);
                return current && (!vaultKind || (current.mediaKind ?? "dub") === vaultKind) && isFeedDub(current, activeSection === "alist", state.member?.aListApproved === true, dubSearchFilters.distributions.includes("private")) ? current : null;
              }).filter((dub): dub is Dub => dub !== null) : vaultDubs.filter((dub) => isFeedDub(dub, activeSection === "alist", state.member?.aListApproved === true))}
              prioritizeAList={Boolean(vaultKind)}
              queryAlreadyFiltered={isDubSearchActive}
              likedDubIds={state.likedDubIds}
              nowPlayingId={state.nowPlayingId}
              isPlaying={state.isPlaying}
              currentTimeSeconds={state.currentTime}
              durationSeconds={state.duration}
              volume={state.volume}
              shuffle={state.shuffle}
              repeat={state.repeat}
              playbackError={state.playbackError}
              onSeek={seekPlayback}
              onSeekProgress={seekPlaybackProgress}
              onPrevious={playPreviousDub}
              onNext={playNextDub}
              onVolumeChange={setVolume}
              onShuffleChange={setShuffle}
              onRepeatChange={setRepeat}
              onDownload={downloadDub}
              currentUsername={state.member.username}
              onEditDub={beginDubEdit}
              onDeleteDub={beginDubDelete}
              onShareWithFriend={beginSharingDub}
              showIntro={false}
              compactHeader={Boolean(vaultKind)}
              showDistributionFilter={Boolean(vaultKind)}
              feedName={sectionLabels[activeSection]}
              onOpenProfile={openProfile}
              onPlay={togglePlayback}
              onQueryChange={setSearchQuery}
              query={searchQuery}
              filters={dubSearchFilters}
              onFiltersChange={setDubSearchFilters}
              fileTypes={[...new Set(vaultDubs.filter((dub) => isFeedDub(dub, activeSection === "alist", state.member?.aListApproved === true, Boolean(vaultKind))).map((dub) => dub.audioFormat ?? dub.audioFileName?.split(".").pop()?.toUpperCase()).filter((value): value is string => Boolean(value)))].sort()}
              isSearching={dubSearch.isSearching}
              searchError={dubSearch.error}
            />
          </>
        )}
        {activeSection === "alist" && !state.member.aListApproved && <p>A-List approval is required to view this feed.</p>}
        {activeSection === "alist-application" && <AListApplication
          key={`${state.member.id}-${state.aListApplication?.id ?? "new"}`}
          application={state.aListApplication}
          artistName={state.member.displayName}
          approved={state.member.aListApproved}
          onSubmit={submitAListApplication}
        />}
        {activeSection === "buddies" && (
          <BuddyListTemplate
            buddies={state.buddies}
            suggestedMembers={state.suggestedMembers}
            onAddFriend={(buddy) => void addBuddy(buddy.username)}
            memberSearchQuery={memberSearchQuery}
            memberSearchResults={memberSearchResults.map((member) => {
              const current = suggestedByUsername.get(member.username);
              return current ? { ...member, avatarUrl: current.avatarUrl } : member;
            })}
            isSearchingMembers={isSearchingMembers}
            onMemberSearchQueryChange={setMemberSearchQuery}
            onAddMatchedMember={(member) => void addBuddy(member.username)}
            onOpenChat={openChat}
            onQueryChange={setSearchQuery}
            onRemoveFriend={(buddyId) => void removeBuddy(buddyId)}
            onSelectProfile={openProfile}
            query={searchQuery}
          />
        )}
        {activeSection === "library" && (
          <LibraryTemplate
            downloads={state.library}
            onDownload={downloadDub}
            onPlay={togglePlayback}
            likedDubIds={state.likedDubIds}
            nowPlayingId={state.nowPlayingId}
            isPlaying={state.isPlaying}
            currentTimeSeconds={state.currentTime}
            durationSeconds={state.duration}
            volume={state.volume}
            shuffle={state.shuffle}
            repeat={state.repeat}
            playbackError={state.playbackError}
            onSeek={seekPlayback}
            onSeekProgress={seekPlaybackProgress}
            onPrevious={playPreviousDub}
            onNext={playNextDub}
            onVolumeChange={setVolume}
            onShuffleChange={setShuffle}
            onRepeatChange={setRepeat}
            onOpenProfile={openProfile}
            currentUsername={state.member.username}
            onEditDub={beginDubEdit}
            onDeleteDub={beginDubDelete}
            onShareWithFriend={beginSharingDub}
          />
        )}
        {(activeSection === "shared-with-me" || activeSection === "shared-samples") && (
          <SharedWithMeTemplate key={sharedMediaKind} mediaKind={sharedMediaKind}
            dubs={sharedDubs.filter((dub) => (dub.mediaKind ?? "dub") === sharedMediaKind)}
            packs={state.packs.filter((pack) => pack.kind === sharedMediaKind && state.sharedPackIds?.has(pack.id))}
            activePackId={state.queuePackId} onActivateQueue={activatePackQueue} onPlayPack={playPack}
            onOpenPack={openPackWindow}
            onDownloadPack={handleDownloadPack} onSharePack={beginSharingPack}
            currentUsername={state.member.username}
            likedDubIds={state.likedDubIds}
            nowPlayingId={state.nowPlayingId}
            isPlaying={state.isPlaying}
            currentTimeSeconds={state.currentTime}
            durationSeconds={state.duration}
            volume={state.volume}
            shuffle={state.shuffle}
            repeat={state.repeat}
            playbackError={state.playbackError}
            onSeek={seekPlayback}
            onSeekProgress={seekPlaybackProgress}
            onPrevious={playPreviousDub}
            onNext={playNextDub}
            onVolumeChange={setVolume}
            onShuffleChange={setShuffle}
            onRepeatChange={setRepeat}
            onDownload={downloadDub}
            onPlay={togglePlayback}
            onOpenProfile={openProfile}
            onShareWithFriend={beginSharingDub}
            onEdit={beginDubEdit}
            onDelete={beginDubDelete}
          />
        )}
        {(activeSection === "my-dubs" || isMySamples) && (
          <div>
          <div className="pack-tabs" role="group" aria-label={`${ownedMediaTitle} view`}>
            <Button variant={ownedMediaTab === "dubs" ? "primary" : "secondary"} aria-pressed={ownedMediaTab === "dubs"} onClick={() => setOwnedMediaTab("dubs")}>{isMySamples ? "Samples" : "Dubs"}</Button>
            <Button variant={ownedMediaTab === "packs" ? "primary" : "secondary"} aria-pressed={ownedMediaTab === "packs"} onClick={() => setOwnedMediaTab("packs")}>Packs</Button>
            {ownedMediaTab === "dubs" && <Button variant="secondary" onClick={() => { setOwnedMediaTab("packs"); setCreatePack(true); }}>Create pack</Button>}
          </div>
          {ownedMediaTab === "packs" ? <PackWorkspace key={`${state.member.id}-${ownedMediaKind}`} username={state.member.username} approved={approved} mediaKind={ownedMediaKind}
            {...packPlaybackControls}
            dubs={myDubs} artists={state.artists} buddies={state.buddies} playback={state}
            onPlay={togglePlayback} onPlayAll={playPack} onSeek={seekPlaybackProgress} onVolume={setVolume}
            onDownloadDub={async (dub) => { await downloadDubFile(dub.id); await refreshCommunity(); }} onCommunityChange={async () => { await refreshCommunity(); }}
            create={createPack} pendingDub={pendingPackDub} editPack={pendingEditPack}
            onOpenPack={openPackWindow}
            onOpened={() => { setCreatePack(false); setPendingPackDub(null); setPendingEditPack(null); }} />
            : <MyDubsTemplate key={ownedMediaKind} mediaKind={ownedMediaKind} title={ownedMediaTitle}
            dubs={ownedMedia}
            packs={ownedPacks} ownerUsername={state.member.username}
            activePackId={state.queuePackId} onActivateQueue={activatePackQueue} onPlayPack={playPack}
            onSharePack={beginSharingPack}
            onOpenPack={openPackWindow}
            onEditPack={beginPackEdit}
            onDownloadPack={async (pack) => { await downloadPack(pack.id); await refreshCommunity(); }}
            likedDubIds={state.likedDubIds}
            nowPlayingId={state.nowPlayingId}
            isPlaying={state.isPlaying}
            currentTimeSeconds={state.currentTime}
            durationSeconds={state.duration}
            volume={state.volume}
            shuffle={state.shuffle}
            repeat={state.repeat}
            playbackError={state.playbackError}
            onSeek={seekPlayback}
            onSeekProgress={seekPlaybackProgress}
            onPrevious={playPreviousDub}
            onNext={playNextDub}
            onVolumeChange={setVolume}
            onShuffleChange={setShuffle}
            onRepeatChange={setRepeat}
            onDownload={downloadDub}
            onPlay={togglePlayback}
            onShareDub={() => {
              if (isMySamples) { setOwnedMediaTab("packs"); setCreatePack(true); }
              else setIsUploadOpen(true);
            }}
            onEditDub={beginDubEdit}
            onDeleteDub={beginDubDelete}
            onRevokeGrant={revokeDubGrant}
            onOpenProfile={openProfile}
            onShareWithFriend={beginSharingDub}
            onAddToPack={(dub) => { setPendingPackDub(dub); setOwnedMediaTab("packs"); }}
          />
          }
          </div>
        )}
        {activeSection === "messenger" && (
          <MessengerTemplate
            buddies={state.buddies}
            conversations={state.conversations}
            dubs={state.dubs}
            shareableDubs={myDubs}
            packs={state.packs}
            shareablePacks={state.packs.filter((pack) => state.member !== null && canSharePack(pack, state.member.username))}
            likedDubIds={state.likedDubIds}
            onPlayPack={playPack} onOpenPack={openPackWindow}
            onDownloadPack={handleDownloadPack} onSendPack={sendPackMessage} activePackId={state.queuePackId} onActivateQueue={activatePackQueue}
            initialBuddyId={chatBuddyId}
            navigationKey={chatNavigationKey}
            chatConnectionStatus={chatConnectionStatus}
            nowPlayingId={state.nowPlayingId}
            isPlaying={state.isPlaying}
            currentTimeSeconds={state.currentTime}
            durationSeconds={state.duration}
            onSeek={seekPlayback}
            onSeekProgress={seekPlaybackProgress}
            volume={state.volume}
            shuffle={state.shuffle}
            repeat={state.repeat}
            playbackError={state.playbackError}
            onVolumeChange={setVolume}
            onShuffleChange={setShuffle}
            onRepeatChange={setRepeat}
            onPrevious={playPreviousDub}
            onNext={playNextDub}
            onOpenProfile={openProfile}
            onPlay={togglePlayback}
            onDownload={downloadDub}
            onStartConversation={() => setIsStartConversationOpen(true)}
            onCreateAndShareDub={(buddyId) => {
              setShareDubTargetId(buddyId);
              setIsUploadOpen(true);
            }}
            onSelectConversation={(buddyId) => openChat(buddyId)}
            onLoadOlderMessages={loadOlderMessages}
            onSendMessage={sendMessage}
            onUnsendMessage={unsendMessage}
          />
        )}
        {activeSection === "profile" && profile && (
          <ProfileTemplate
            isOwnProfile={isOwnProfile}
            profile={profile}
            uploads={profileUploads}
            packs={state.packs}
            likedDubIds={state.likedDubIds} activePackId={state.queuePackId} onActivateQueue={activatePackQueue} onPlayPack={playPack}
            onSharePack={beginSharingPack}
            onOpenPack={openPackWindow}
            onEditPack={beginPackEdit}
            onDownloadPack={async (pack) => { await downloadPack(pack.id); await refreshCommunity(); }}
            isPlaying={state.isPlaying}
            currentTimeSeconds={state.currentTime}
            durationSeconds={state.duration}
            volume={state.volume}
            shuffle={state.shuffle}
            repeat={state.repeat}
            playbackError={state.playbackError}
            onSeek={seekPlayback}
            onSeekProgress={seekPlaybackProgress}
            onVolumeChange={setVolume}
            onShuffleChange={setShuffle}
            onRepeatChange={setRepeat}
            onPrevious={playPreviousDub}
            onNext={playNextDub}
            onEditProfile={() => setIsProfileEditOpen(true)}
            onMessage={() => profileBuddy ? openChat(profileBuddy.id) : void startConversation(profile.username)}
            onPlay={togglePlayback}
            playingDubId={state.nowPlayingId}
            onDownload={downloadDub}
            onOpenProfile={openProfile}
            onEditDub={beginDubEdit}
            onDeleteDub={beginDubDelete}
            currentUsername={state.member.username}
            onShareWithFriend={beginSharingDub}
          />
        )}
        {activeSection === "profile" && !profile && <p role="status">This profile is no longer available.</p>}
      </div>
      <NotificationViewport
        notifications={activeNotifications}
        onDismiss={dismissNotification}
      />
      <PackWindows windows={packWindows.map((entry) => ({ ...entry, pack: state.packs.find((current) => current.id === entry.pack.id) ?? entry.pack }))}
        username={state.member.username} authenticated buddies={state.buddies} playback={state}
        {...packPlaybackControls} onPlay={togglePlayback} onPlayAll={playPack} onSeek={seekPlaybackProgress} onVolume={setVolume}
        onDownloadDub={async (dub) => { await downloadDubFile(dub.id); await refreshCommunity(); }}
        onCommunityChange={async () => { await refreshCommunity(); }}
        onActivate={(id) => setPackWindows((current) => [...current.filter(({ pack }) => pack.id !== id), ...current.filter(({ pack }) => pack.id === id)])}
        onClose={(id) => setPackWindows((current) => current.filter(({ pack }) => pack.id !== id))}
        onEdit={beginPackEdit} />
      {sharePack && <SharePackDialog key={sharePack.id} pack={sharePack}
        buddies={state.buddies} onClose={() => setSharingPack(null)} onSend={sendPackMessage} />}
      {sharingDub && (
        <ShareDubDialog
          buddies={(dubsById.get(sharingDub.dub.id) ?? sharingDub.dub).distribution === "alist" && !(dubsById.get(sharingDub.dub.id) ?? sharingDub.dub).aListPublic ? aListMembers : state.buddies}
          friends={state.buddies}
          dub={dubsById.get(sharingDub.dub.id) ?? sharingDub.dub}
          key={`${sharingDub.dub.id}-${(dubsById.get(sharingDub.dub.id) ?? sharingDub.dub).aListPublic === true}`}
          initialBuddyIds={sharingDub.failedIds?.map((id) => shareDialogId(id, dubsById.get(sharingDub.dub.id) ?? sharingDub.dub))}
          initiallySentIds={sharingDub.sentIds?.map((id) => shareDialogId(id, dubsById.get(sharingDub.dub.id) ?? sharingDub.dub))}
          initialFailure={Boolean(sharingDub.failedIds?.length)}
          externalShareUrl={externalDubUrl(sharingDub.dub.id)}
          onUpdatePreview={sharingDub.dub.uploader === state.member.username
            ? (seconds) => updateDubPreview(sharingDub.dub.id, seconds)
            : undefined}
          onClose={() => setSharingDub(null)}
          onOpenProfile={(username) => { setSharingDub(null); openProfile(username); }}
          onPlay={togglePlayback}
          onSeekProgress={(progress, dub) => seekPlaybackProgress(progress, dub)}
          isCurrentTrack={state.nowPlayingId === sharingDub.dub.id}
          isPlaying={state.isPlaying}
          currentTimeSeconds={state.currentTime}
          durationSeconds={state.duration}
          playbackError={state.playbackError}
          onFindFriends={() => {
            setSharingDub(null);
            navigateTo("buddies");
          }}
          onOpenChat={(buddyId) => {
            setSharingDub(null);
            if (buddyId.startsWith("member:")) {
              const userId = buddyId.slice("member:".length);
              const resolvedId = memberBuddyIds.current.get(userId) ?? state.buddies.find((buddy) => buddy.userId === userId)?.id;
              if (!resolvedId) {
                notify("The conversation could not be opened.", "error");
                return;
              }
              openChat(resolvedId);
            } else openChat(buddyId);
          }}
          onSendMessage={sendToRecipient}
        />
      )}
      <Modal
        isOpen={isUploadOpen}
        closeDisabled={Boolean(uploadProgress) || isUploadSubmitting}
        onClose={() => {
          if (!uploadProgress && !isUploadSubmitting) {
            setIsUploadOpen(false);
            setShareDubTargetId(null);
          }
        }}
        title="Share a dub"
      >
        {isUploadOpen && !shareDubTargetId && <div className="pack-tabs" role="group" aria-label="Upload type">
          <Button aria-pressed variant="primary">Single dub</Button>
          <Button variant="secondary" disabled={Boolean(uploadProgress) || isUploadSubmitting} onClick={() => {
            setIsUploadOpen(false); setMyDubsTab("packs"); setCreatePack(true); navigateTo("my-dubs");
          }}>Dub / Sample Pack</Button>
        </div>}
        {isUploadOpen && <DubUploadForm
          artists={state.artists}
          aListApproved={state.member.aListApproved}
          buddies={state.buddies}
          aListMembers={aListMembers}
          initialBuddyIds={shareDubTargetId ? [shareDubTargetId] : []}
          onSubmit={handleShareDub}
          submissionError={uploadError}
          uploadProgress={uploadProgress}
          onCancel={() => {
            setIsUploadOpen(false);
            setShareDubTargetId(null);
          }}
        />}
      </Modal>
      {isProfileEditOpen && state.member && <EditProfileDialog
        profile={state.member}
        onClose={() => setIsProfileEditOpen(false)}
        onSubmit={updateProfile}
      />}
      <Modal
        isOpen={isStartConversationOpen}
        onClose={() => setIsStartConversationOpen(false)}
        title="Start a conversation"
      >
        <div className="start-conversation-list">
          {state.suggestedMembers.length > 0 ? (
            state.suggestedMembers.map((member) => (
              <ArtistCard
                key={member.username}
                name={member.displayName}
                username={member.username}
                avatarUrl={member.avatarUrl}
                aListApproved={member.aListApproved}
                detail={member.genre}
                onOpenProfile={(username) => { setIsStartConversationOpen(false); openProfile(username); }}
                action={<Button onClick={() => void startConversation(member.username)} size="small" variant="secondary">Message</Button>}
              />
            ))
          ) : (
            <p className="empty-state">You’re already connected with everyone.</p>
          )}
        </div>
      </Modal>
      <DubManagementDialogs
        artists={state.artists}
        buddies={state.buddies}
        aListMembers={aListMembers}
        deletingDub={deletingDub}
        editingDub={editingDub}
        onCloseDelete={() => setDeletingDub(null)}
        onCloseEdit={() => setEditingDub(null)}
        onDeleteDub={deleteDub}
        onUpdateDub={handleUpdateDub}
        uploadError={uploadError}
        uploadProgress={uploadProgress}
      />
    </DashboardTemplate>
  );
}
