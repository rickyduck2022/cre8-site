import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Friends,
  FriendsFeed,
  Download,
  Disc3,
  MessageCircle,
  LockKeyhole,
  Users,
} from "@craft/icons";
import {
  AppHeader,
  ArtistCard,
  AudioPlayer,
  ArtistRegistrationForm,
  BuddyListTemplate,
  Button,
  DashboardTemplate,
  DubManagementDialogs,
  DubUploadForm,
  EditProfileForm,
  LatestDubsTemplate,
  LibraryTemplate,
  MyDubsTemplate,
  MessengerTemplate,
  MobileNavigation,
  Modal,
  Navigation,
  NotificationViewport,
  ProfileTemplate,
  ShareDubDialog,
  SharedWithMeTemplate,
  shareDubToFriends,
  TrackArtwork,
  createEmptyDubSearchFilters,
  getDubSearchFilterCount,
  type DubSearchFilters,
  type Dub,
  type NotificationMessage,
  type NavigationSection,
} from "@craft/ui";
import { DemoModeNotice } from "../components/DemoModeNotice";
import { AListApplication } from "../components/AListApplication";
import { useCommunity } from "../hooks/useCommunity";
import { useMemberSearch } from "../hooks/useMemberSearch";
import { useDubSearch } from "../hooks/useDubSearch";
import type { CommunitySection } from "../types/community";
import "./App.css";

const sectionLabels: Record<CommunitySection, string> = {
  dubs: "Dub Vault",
  alist: "A-List",
  "shared-with-me": "Shared With Me",
  "alist-application": "A-List Submission",
  buddies: "Friend List",
  messenger: "Messenger",
  profile: "My Profile",
  library: "My Library",
  "my-dubs": "My Dubs",
};

const sectionIcons: Record<CommunitySection, ReactNode> = {
  dubs: <FriendsFeed />,
  alist: <Disc3 />,
  "alist-application": <Users />,
  buddies: <Friends />,
  messenger: <MessageCircle />,
  profile: <Users />,
  library: <Download />,
  "shared-with-me": <LockKeyhole />,
  "my-dubs": <Disc3 />,
};

const sections = Object.keys(sectionLabels) as CommunitySection[];
const cre8LogoSrc = "/cre8-main-logo.png";

function isFeedDub(dub: Dub, aListFeed: boolean, approved: boolean, includePrivate = false): boolean {
  return aListFeed
    ? dub.distribution === "alist" && approved
    : dub.distribution === "worldwide" || (dub.distribution === "alist" && (approved || dub.aListPublic === true)) || (dub.distribution === "private" && includePrivate);
}

function getSectionFromHash(hash: string): CommunitySection {
  const section = hash.replace(/^#/, "") as CommunitySection;
  return sections.includes(section) ? section : "dubs";
}

function createNavigationSections(unreadCount: number, aListApproved: boolean, sharedCount: number, feedCount: number, aListCount: number): NavigationSection[] {
  return [
    {
      label: "Your space",
      items: sections.filter((section) => section !== "alist" || aListApproved).map((section) => ({
        label: sectionLabels[section],
        icon: sectionIcons[section],
        href: `#${section}`,
        variant: section === "alist" ? "alist" as const : section === "shared-with-me" ? "private" as const : undefined,
        badge:
          section === "dubs"
            ? String(feedCount)
            : section === "alist"
            ? String(aListCount)
            : section === "shared-with-me"
            ? String(sharedCount)
            : section === "messenger" && unreadCount > 0
            ? String(unreadCount)
            : undefined,
      })),
    },
  ];
}

export function App() {
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
    registerArtist,
    logout,
    downloadDub,
    togglePlayback,
    seekPlayback,
    seekPlaybackProgress,
    setVolume,
    setShuffle,
    setRepeat,
    playNextDub,
    playPreviousDub,
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
    shareDubWithAListMember,
    unsendMessage,
    updateProfile,
    unreadCount,
  } = useCommunity();
  const [activeSection, setActiveSection] = useState<CommunitySection>(() =>
    getSectionFromHash(window.location.hash),
  );
  const [profileUsername, setProfileUsername] = useState("");
  const [chatBuddyId, setChatBuddyId] = useState("");
  const [chatNavigationKey, setChatNavigationKey] = useState(0);
  const [playerMinimized, setPlayerMinimized] = useState<{ messenger?: boolean; other?: boolean }>({});
  const playerContext = activeSection === "messenger" ? "messenger" : "other";
  const isPlayerMinimized = playerMinimized[playerContext] ?? (playerContext === "messenger");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedFilters, setFeedFilters] = useState<DubSearchFilters>(createEmptyDubSearchFilters);
  const [aListFilters, setAListFilters] = useState<DubSearchFilters>(createEmptyDubSearchFilters);
  const dubSearchFilters = activeSection === "alist" ? aListFilters : feedFilters;
  const setDubSearchFilters = activeSection === "alist" ? setAListFilters : setFeedFilters;
  const dubSearch = useDubSearch(searchQuery, dubSearchFilters, activeSection === "dubs" || (activeSection === "alist" && state.member?.aListApproved === true), activeSection === "alist" ? "alist" : "feed");
  const isDubSearchActive = Boolean(searchQuery.trim() || getDubSearchFilterCount(dubSearchFilters));
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const { members: memberSearchResults, isSearching: isSearchingMembers } = useMemberSearch(memberSearchQuery);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploadSubmitting, setIsUploadSubmitting] = useState(false);
  const [editingDub, setEditingDub] = useState<Dub | null>(null);
  const [deletingDub, setDeletingDub] = useState<Dub | null>(null);
  const [shareDubTargetId, setShareDubTargetId] = useState<string | null>(null);
  const [sharingDub, setSharingDub] = useState<{ dub: Dub; failedIds?: string[]; sentIds?: string[] } | null>(null);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isStartConversationOpen, setIsStartConversationOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [registrationPending, setRegistrationPending] = useState(false);
  const memberBuddyIds = useRef(new Map<string, string>());

  const sharedDubs = state.dubs.filter((dub) => state.sharedDubIds.has(dub.id));
  const approved = state.member?.aListApproved === true;
  const feedCount = state.dubs.filter((dub) => isFeedDub(dub, false, approved)).length;
  const aListCount = state.dubs.filter((dub) => isFeedDub(dub, true, approved)).length;
  const navigationSections = useMemo(
    () => createNavigationSections(unreadCount, approved, sharedDubs.length, feedCount, aListCount),
    [unreadCount, approved, sharedDubs.length, feedCount, aListCount],
  );
  const interactiveNavigationSections = navigationSections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.href === "#profile") return { ...item, onClick: () => setProfileUsername("") };
      if (item.href === "#messenger") return { ...item, onClick: () => { setChatBuddyId(""); setChatNavigationKey((key) => key + 1); } };
      return item;
    }),
  }));
  const nowPlaying = state.dubs.find((dub) => dub.id === state.nowPlayingId) ?? null;
  const previewTrack = nowPlaying ?? state.dubs.find((dub) => dub.distribution === "worldwide");
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
    function syncSectionWithHash() {
      setActiveSection(getSectionFromHash(window.location.hash));
    }

    window.addEventListener("hashchange", syncSectionWithHash);
    window.addEventListener("popstate", syncSectionWithHash);
    return () => {
      window.removeEventListener("hashchange", syncSectionWithHash);
      window.removeEventListener("popstate", syncSectionWithHash);
    };
  }, []);

  function navigateTo(section: CommunitySection) {
    setActiveSection(section);
    const nextHash = `#${section}`;
    if (window.location.hash !== nextHash) window.history.pushState(null, "", nextHash);
  }

  function openProfile(username: string) {
    setProfileUsername(username);
    navigateTo("profile");
  }

  function openChat(buddyId: string) {
    setChatBuddyId(buddyId);
    setChatNavigationKey((key) => key + 1);
    void markConversationRead(buddyId);
    navigateTo("messenger");
  }

  function beginDubEdit(dub: Dub) {
    setEditingDub(dub);
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
    setChatBuddyId(buddyId);
    setChatNavigationKey((key) => key + 1);
    setIsStartConversationOpen(false);
    navigateTo("messenger");
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
      <main className="app-login">
        <section className="app-login__card">
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
  const track = previewTrack ? {
              title: previewTrack.title,
              artist: previewTrack.artist,
              artistAListApproved: previewTrack.artistAListApproved,
              onArtistClick: () => openProfile(previewTrack.uploader),
              artworkContent: <TrackArtwork dub={previewTrack} />,
              duration: previewTrack.duration,
            } : {
              title: "",
              artist: "",
              artistAListApproved: false,
              onArtistClick: () => {},
              artworkContent: null,
              duration: "00:00"
            }
  return (
    <DashboardTemplate
      className={`community-dashboard-template${previewTrack ? " community-dashboard-template--has-player" : ""}${isPlayerMinimized ? " community-dashboard-template--player-minimized" : ""}${activeSection === "messenger" ? " community-dashboard-template--messenger" : ""}`}
      scrollContent
      scrollResetKey={activeSection}
      header={
        <AppHeader
          className="app-topbar"
          logoSrc={cre8LogoSrc}
          onCreate={() => setIsUploadOpen(true)}
          onEditProfile={() => setIsProfileEditOpen(true)}
          onLogout={() => {
            void logout().catch((logoutError: unknown) => {
              notify(
                logoutError instanceof Error
                  ? logoutError.message
                  : "Sign out failed.",
                "error",
              );
            });
          }}
          notifications={notifications}
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
      audioPlayer={
        previewTrack ? (
          <AudioPlayer
            className="app-player"
            minimized={isPlayerMinimized}
            onMinimizedChange={(minimized) => setPlayerMinimized((current) => ({ ...current, [playerContext]: minimized }))}
            distribution={previewTrack.distribution ?? "worldwide"}
            onPlayChange={(playing) => {
              if (playing !== state.isPlaying) togglePlayback(previewTrack);
            }}
            playing={state.isPlaying}
            currentTimeSeconds={state.currentTime}
            durationSeconds={
              state.nowPlayingId === previewTrack.id ? state.duration : undefined
            }
            volume={state.volume}
            shuffle={state.shuffle}
            repeat={state.repeat}
            playbackError={state.playbackError}
            onSeek={(time) => seekPlayback(time, previewTrack)}
            onSeekProgress={(progress) => seekPlaybackProgress(progress, previewTrack)}
            onVolumeChange={setVolume}
            onShuffleChange={setShuffle}
            onRepeatChange={setRepeat}
            onPrevious={playPreviousDub}
            onNext={playNextDub}
            track={track}
            variant="full"
          />
        ) : <AudioPlayer
            track={{ title: "", artist: "", duration: "00:00" }}
            variant="full"
            minimized={isPlayerMinimized}
            onMinimizedChange={(minimized) => setPlayerMinimized((current) => ({ ...current, [playerContext]: minimized }))}
          />
      }
    >
      <div className={`app-content${activeSection === "messenger" ? " app-content--messenger" : ""}`}>
        {activeSection !== "messenger" && <DemoModeNotice />}
        {(activeSection === "dubs" || (activeSection === "alist" && state.member.aListApproved)) && (
          <>
            <LatestDubsTemplate
              key={activeSection}
              dubs={isDubSearchActive ? (dubSearch.results ?? []).map((dub) => {
                const current = dubsById.get(dub.id);
                return current && isFeedDub(current, activeSection === "alist", state.member?.aListApproved === true, dubSearchFilters.distributions.includes("private")) ? current : null;
              }).filter((dub): dub is Dub => dub !== null) : state.dubs.filter((dub) => isFeedDub(dub, activeSection === "alist", state.member?.aListApproved === true))}
              prioritizeAList={activeSection === "dubs"}
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
              showDistributionFilter={activeSection === "dubs"}
              feedName={activeSection === "alist" ? "A-List" : "Dub Vault"}
              onOpenProfile={openProfile}
              onPlay={togglePlayback}
              onQueryChange={setSearchQuery}
              query={searchQuery}
              filters={dubSearchFilters}
              onFiltersChange={setDubSearchFilters}
              fileTypes={[...new Set(state.dubs.filter((dub) => isFeedDub(dub, activeSection === "alist", state.member?.aListApproved === true, activeSection === "dubs")).map((dub) => dub.audioFormat ?? dub.audioFileName?.split(".").pop()?.toUpperCase()).filter((value): value is string => Boolean(value)))].sort()}
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
        {activeSection === "shared-with-me" && (
          <SharedWithMeTemplate
            dubs={sharedDubs}
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
        {activeSection === "my-dubs" && (
          <MyDubsTemplate
            dubs={myDubs}
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
            onShareDub={() => setIsUploadOpen(true)}
            onEditDub={beginDubEdit}
            onDeleteDub={beginDubDelete}
            onRevokeGrant={revokeDubGrant}
            onOpenProfile={openProfile}
            onShareWithFriend={beginSharingDub}
          />
        )}
        {activeSection === "messenger" && (
          <MessengerTemplate
            buddies={state.buddies}
            conversations={state.conversations}
            dubs={state.dubs}
            shareableDubs={myDubs}
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
            onSelectConversation={markConversationRead}
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
      <MobileNavigation activeItem={sectionLabels[activeSection]}
        primaryHrefs={["#dubs", "#library", "#profile", "#messenger"]}
        sections={interactiveNavigationSections} />

      <NotificationViewport
        notifications={activeNotifications}
        onDismiss={dismissNotification}
      />
      {sharingDub && (
        <ShareDubDialog
          buddies={(dubsById.get(sharingDub.dub.id) ?? sharingDub.dub).distribution === "alist" && !(dubsById.get(sharingDub.dub.id) ?? sharingDub.dub).aListPublic ? aListMembers : state.buddies}
          friends={state.buddies}
          dub={dubsById.get(sharingDub.dub.id) ?? sharingDub.dub}
          key={`${sharingDub.dub.id}-${(dubsById.get(sharingDub.dub.id) ?? sharingDub.dub).aListPublic === true}`}
          initialBuddyIds={sharingDub.failedIds?.map((id) => shareDialogId(id, dubsById.get(sharingDub.dub.id) ?? sharingDub.dub))}
          initiallySentIds={sharingDub.sentIds?.map((id) => shareDialogId(id, dubsById.get(sharingDub.dub.id) ?? sharingDub.dub))}
          initialFailure={Boolean(sharingDub.failedIds?.length)}
          onClose={() => setSharingDub(null)}
          onOpenProfile={(username) => { setSharingDub(null); openProfile(username); }}
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
        onClose={() => {
          if (!uploadProgress && !isUploadSubmitting) {
            setIsUploadOpen(false);
            setShareDubTargetId(null);
          }
        }}
        title="Share a dub"
      >
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
      <Modal
        isOpen={isProfileEditOpen}
        onClose={() => setIsProfileEditOpen(false)}
        title="Edit your profile"
      >
        {state.member && (
          <EditProfileForm
            onCancel={() => setIsProfileEditOpen(false)}
            onSubmit={(values) => {
              void updateProfile(values).then((saved) => {
                if (saved) setIsProfileEditOpen(false);
              });
            }}
            profile={state.member}
          />
        )}
      </Modal>
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
