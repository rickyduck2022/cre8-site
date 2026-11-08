import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Friends,
  FriendsFeed,
  Download,
  Disc3,
  MessageCircle,
  Users,
} from "@craft/icons";
import {
  AppHeader,
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
  Modal,
  Navigation,
  NotificationViewport,
  ProfileTemplate,
  ShareDubDialog,
  TrackArtwork,
  createEmptyDubSearchFilters,
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
  dubs: "Dub Feed",
  alist: "A-List",
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
  "my-dubs": <Disc3 />,
};

const sections = Object.keys(sectionLabels) as CommunitySection[];
const cre8LogoSrc = "/cre8-main-logo.png";

function getSectionFromHash(hash: string): CommunitySection {
  const section = hash.replace(/^#/, "") as CommunitySection;
  return sections.includes(section) ? section : "dubs";
}

function createNavigationSections(unreadCount: number, aListApproved: boolean): NavigationSection[] {
  return [
    {
      label: "Your space",
      items: sections.filter((section) => section !== "alist" || aListApproved).map((section) => ({
        label: sectionLabels[section],
        icon: sectionIcons[section],
        href: `#${section}`,
        badge:
          section === "messenger" && unreadCount > 0
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
    unsendMessage,
    updateProfile,
    unreadCount,
  } = useCommunity();
  const [activeSection, setActiveSection] = useState<CommunitySection>(() =>
    getSectionFromHash(window.location.hash),
  );
  const [profileUsername, setProfileUsername] = useState("");
  const [chatBuddyId, setChatBuddyId] = useState("evan");
  const [searchQuery, setSearchQuery] = useState("");
  const [dubSearchFilters, setDubSearchFilters] = useState<DubSearchFilters>(createEmptyDubSearchFilters);
  const dubSearch = useDubSearch(searchQuery, dubSearchFilters, activeSection === "dubs" || (activeSection === "alist" && state.member?.aListApproved === true), activeSection === "alist" ? "alist" : "worldwide");
  const isDubSearchActive = Boolean(searchQuery.trim() || dubSearchFilters.tags.length || dubSearchFilters.fileType || dubSearchFilters.minBpm || dubSearchFilters.maxBpm || dubSearchFilters.minBitrate || dubSearchFilters.maxBitrate);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const { members: memberSearchResults, isSearching: isSearchingMembers } = useMemberSearch(memberSearchQuery);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editingDub, setEditingDub] = useState<Dub | null>(null);
  const [deletingDub, setDeletingDub] = useState<Dub | null>(null);
  const [shareDubTargetId, setShareDubTargetId] = useState<string | null>(null);
  const [sharingDub, setSharingDub] = useState<Dub | null>(null);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isStartConversationOpen, setIsStartConversationOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [registrationPending, setRegistrationPending] = useState(false);

  const navigationSections = useMemo(
    () => createNavigationSections(unreadCount, state.member?.aListApproved === true),
    [unreadCount, state.member?.aListApproved],
  );
  const nowPlaying = state.dubs.find((dub) => dub.id === state.nowPlayingId) ?? null;
  const previewTrack = nowPlaying ?? state.dubs.find((dub) => dub.distribution === "worldwide");
  const dubsById = new Map(state.dubs.map((dub) => [dub.id, dub]));
  const suggestedByUsername = new Map(state.suggestedMembers.map((member) => [member.username, member]));
  const profile =
    profileUsername === state.member?.username || !profileUsername
      ? state.member
      : state.buddies.find((buddy) => buddy.username === profileUsername) ??
        state.member;
  const isOwnProfile = profile?.username === state.member?.username;
  const profileUploads = state.dubs.filter((dub) => dub.uploader === profile?.username && dub.distribution === "worldwide");
  const myDubs = state.member
    ? state.dubs.filter((dub) => dub.uploader === state.member?.username)
    : [];
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
    setIsStartConversationOpen(false);
    navigateTo("messenger");
  }

  async function handleShareDub(values: Parameters<typeof addDub>[0]) {
    const dub = await addDub(values);
    if (!dub) return false;
    setIsUploadOpen(false);
    const targetId = shareDubTargetId;
    setShareDubTargetId(null);
    if (targetId) {
      setChatBuddyId(targetId);
      navigateTo("messenger");
      await sendMessage(targetId, `Shared a dub: ${dub.title}`, dub.id);
    } else {
      navigateTo(dub.distribution === "private" ? "my-dubs" : dub.distribution === "alist" ? "alist" : "dubs");
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

  return (
    <DashboardTemplate
      className="community-dashboard-template"
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
          onNotifications={markNotificationsRead}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search tracks or members"
          searchValue={searchQuery}
          unreadNotificationCount={unreadNotificationCount}
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
          sections={navigationSections}
          userDetail={state.member.role}
          userName={state.member.displayName}
          userAvatarUrl={state.member.avatarUrl}
        />
      }
      audioPlayer={
        previewTrack ? (
          <AudioPlayer
            className="app-player"
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
            track={{
              title: previewTrack.title,
              artist: previewTrack.artist,
              artworkContent: <TrackArtwork dub={previewTrack} />,
              duration: previewTrack.duration,
            }}
            variant="full"
          />
        ) : null
      }
    >
      <div className="app-content">
        <DemoModeNotice />
        {(activeSection === "dubs" || (activeSection === "alist" && state.member.aListApproved)) && (
          <>
            <LatestDubsTemplate
              dubs={isDubSearchActive ? (dubSearch.results ?? []).map((dub) => {
                const current = dubsById.get(dub.id);
                return current && current.distribution === (activeSection === "alist" ? "alist" : "worldwide") ? current : null;
              }).filter((dub): dub is Dub => dub !== null) : state.dubs.filter((dub) => dub.distribution === (activeSection === "alist" ? "alist" : "worldwide"))}
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
              onShareWithFriend={setSharingDub}
              showIntro={false}
              feedName={activeSection === "alist" ? "A-List" : "Dub Feed"}
              onOpenProfile={openProfile}
              onPlay={togglePlayback}
              onQueryChange={setSearchQuery}
              query={searchQuery}
              filters={dubSearchFilters}
              onFiltersChange={setDubSearchFilters}
              fileTypes={[...new Set(state.dubs.filter((dub) => dub.distribution === (activeSection === "alist" ? "alist" : "worldwide")).map((dub) => dub.audioFormat ?? dub.audioFileName?.split(".").pop()?.toUpperCase()).filter((value): value is string => Boolean(value)))].sort()}
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
            currentUsername={state.member.username}
            onEditDub={beginDubEdit}
            onDeleteDub={beginDubDelete}
            onShareWithFriend={setSharingDub}
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
            onShareWithFriend={setSharingDub}
          />
        )}
        {activeSection === "messenger" && (
          <MessengerTemplate
            buddies={state.buddies}
            conversations={state.conversations}
            dubs={state.dubs}
            shareableDubs={myDubs}
            initialBuddyId={chatBuddyId}
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
            onMessage={() => profileBuddy && openChat(profileBuddy.id)}
            onPlay={togglePlayback}
            playingDubId={state.nowPlayingId}
            onDownload={downloadDub}
            onOpenProfile={openProfile}
            onEditDub={beginDubEdit}
            onDeleteDub={beginDubDelete}
            currentUsername={state.member.username}
            onShareWithFriend={setSharingDub}
          />
        )}
      </div>
      <nav className="mobile-tabs" aria-label="Main sections">
        {sections.filter((section) => section !== "alist" || state.member?.aListApproved).map((section) => (
          <button
            aria-current={activeSection === section ? "page" : undefined}
            className={activeSection === section ? "is-active" : ""}
            key={section}
            onClick={() => navigateTo(section)}
            type="button"
          >
            {sectionIcons[section]}
            <span>{sectionLabels[section]}</span>
          </button>
        ))}
      </nav>

      <NotificationViewport
        notifications={activeNotifications}
        onDismiss={dismissNotification}
      />
      {sharingDub && (
        <ShareDubDialog
          buddies={state.buddies}
          dub={sharingDub}
          key={sharingDub.id}
          onClose={() => setSharingDub(null)}
          onFindFriends={() => {
            setSharingDub(null);
            navigateTo("buddies");
          }}
          onOpenChat={(buddyId) => {
            setSharingDub(null);
            openChat(buddyId);
          }}
          onSendMessage={sendMessage}
        />
      )}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => {
          if (!uploadProgress) {
            setIsUploadOpen(false);
            setShareDubTargetId(null);
          }
        }}
        title="Share a dub"
      >
        <DubUploadForm
          artists={state.artists}
          aListApproved={state.member.aListApproved}
          onSubmit={handleShareDub}
          submissionError={uploadError}
          uploadProgress={uploadProgress}
          onCancel={() => {
            setIsUploadOpen(false);
            setShareDubTargetId(null);
          }}
        />
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
              <Button
                key={member.username}
                onClick={() => void startConversation(member.username)}
                type="button"
                variant="tertiary"
              >
                {member.displayName} · {member.genre}
              </Button>
            ))
          ) : (
            <p className="empty-state">You’re already connected with everyone.</p>
          )}
        </div>
      </Modal>
      <DubManagementDialogs
        artists={state.artists}
        deletingDub={deletingDub}
        editingDub={editingDub}
        onCloseDelete={() => setDeletingDub(null)}
        onCloseEdit={() => setEditingDub(null)}
        onDeleteDub={deleteDub}
        onUpdateDub={updateDub}
        uploadError={uploadError}
        uploadProgress={uploadProgress}
      />
    </DashboardTemplate>
  );
}
