import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Friends,
  FriendsFeed,
  Folder,
  MessageCircle,
  Plus,
  Users,
} from "@craft/icons";
import {
  AppHeader,
  AudioPlayer,
  ArtistRegistrationForm,
  BuddyListTemplate,
  Button,
  CreateCrateForm,
  CratePicker,
  DashboardTemplate,
  DubUploadForm,
  EditProfileForm,
  LatestDubsTemplate,
  MessengerTemplate,
  Modal,
  Navigation,
  NotificationViewport,
  ProfileTemplate,
  TrackArtwork,
  type NotificationMessage,
  type NavigationSection,
} from "@craft/ui";
import { DemoModeNotice } from "../components/DemoModeNotice";
import { useCommunity } from "../hooks/useCommunity";
import type { CommunitySection } from "../types/community";
import "./App.css";

const sectionLabels: Record<CommunitySection, string> = {
  dubs: "Latest Dubs",
  buddies: "Buddy List",
  messenger: "Messenger",
  profile: "My Profile",
};

const sectionIcons: Record<CommunitySection, ReactNode> = {
  dubs: <FriendsFeed />,
  buddies: <Friends />,
  messenger: <MessageCircle />,
  profile: <Users />,
};

const sections = Object.keys(sectionLabels) as CommunitySection[];

function getSectionFromHash(hash: string): CommunitySection {
  const section = hash.replace(/^#/, "") as CommunitySection;
  return sections.includes(section) ? section : "dubs";
}

function getCrateIdFromHash(hash: string) {
  return hash.startsWith("#crate/") ? decodeURIComponent(hash.slice(7)) : null;
}

function createNavigationSections(
  unreadCount: number,
  crates: Array<{ id: string; name: string }>,
  onCreateCrate: () => void,
): NavigationSection[] {
  return [
    {
      label: "Your space",
      items: sections.map((section) => ({
        label: sectionLabels[section],
        icon: sectionIcons[section],
        href: `#${section}`,
        badge:
          section === "messenger" && unreadCount > 0
            ? String(unreadCount)
            : undefined,
      })),
    },
    {
      label: "Your crates",
      items: crates.map((crate) => ({
        label: crate.name,
        icon: <Folder />,
        href: `#crate/${encodeURIComponent(crate.id)}`,
      })),
      footer: (
        <button onClick={onCreateCrate} type="button">
          <Plus aria-hidden="true" />
          Add a crate
        </button>
      ),
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
    setVolume,
    setShuffle,
    setRepeat,
    playNextDub,
    playPreviousDub,
    addDub,
    addBuddy,
    removeBuddy,
    markConversationRead,
    sendMessage,
    createCrate,
    updateCrateDub,
    updateProfile,
    unreadCount,
  } = useCommunity();
  const [activeSection, setActiveSection] = useState<CommunitySection>(() =>
    getSectionFromHash(window.location.hash),
  );
  const [activeCrateId, setActiveCrateId] = useState(() =>
    getCrateIdFromHash(window.location.hash),
  );
  const [profileUsername, setProfileUsername] = useState("");
  const [chatBuddyId, setChatBuddyId] = useState("evan");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCrateCreateOpen, setIsCrateCreateOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isStartConversationOpen, setIsStartConversationOpen] = useState(false);
  const [cratePickerDubId, setCratePickerDubId] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [registrationPending, setRegistrationPending] = useState(false);

  const navigationSections = useMemo(
    () => createNavigationSections(
      unreadCount,
      state.crates,
      () => setIsCrateCreateOpen(true),
    ),
    [unreadCount, state.crates],
  );
  const nowPlaying = state.dubs.find((dub) => dub.id === state.nowPlayingId) ?? null;
  const previewTrack = nowPlaying ?? state.dubs[0];
  const profile =
    profileUsername === state.member?.username || !profileUsername
      ? state.member
      : state.buddies.find((buddy) => buddy.username === profileUsername) ??
        state.member;
  const isOwnProfile = profile?.username === state.member?.username;
  const profileUploads = state.dubs.filter((dub) => dub.uploader === profile?.username);
  const profileBuddy = state.buddies.find((buddy) => buddy.username === profile?.username);
  const selectedCrate = state.crates.find((crate) => crate.id === activeCrateId);
  const visibleDubs = selectedCrate
    ? state.dubs.filter((dub) => selectedCrate.dubIds.includes(dub.id))
    : state.dubs;

  useEffect(() => {
    function syncSectionWithHash() {
      const crateId = getCrateIdFromHash(window.location.hash);
      setActiveCrateId(crateId);
      setActiveSection(crateId ? "dubs" : getSectionFromHash(window.location.hash));
    }

    window.addEventListener("hashchange", syncSectionWithHash);
    window.addEventListener("popstate", syncSectionWithHash);
    return () => {
      window.removeEventListener("hashchange", syncSectionWithHash);
      window.removeEventListener("popstate", syncSectionWithHash);
    };
  }, []);

  function navigateTo(section: CommunitySection) {
    setActiveCrateId(null);
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

  function handleCreateCrate(name: string) {
    void createCrate(name);
    setIsCrateCreateOpen(false);
  }

  function handleAddDubToCrate(crateId: string) {
    if (!cratePickerDubId) return;
    void updateCrateDub(crateId, cratePickerDubId, true);
    setCratePickerDubId(null);
  }

  async function handleShareDub(values: Parameters<typeof addDub>[0]) {
    const succeeded = await addDub(values);
    if (succeeded) {
      setIsUploadOpen(false);
      navigateTo("dubs");
    }
    return succeeded;
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

  async function handleRegister(values: {
    username: string;
    displayName: string;
    genre: string;
    password: string;
  }) {
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
          variant="compact"
        />
      }
      navigation={
        <Navigation
          activeItem={selectedCrate?.name ?? sectionLabels[activeSection]}
          className="app-sidebar"
          hideOnMobile
          sections={navigationSections}
          userDetail={state.member.role}
          userName={state.member.displayName}
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
            onSeek={seekPlayback}
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
        {activeSection === "dubs" && (
          <>
            <LatestDubsTemplate
              dubs={visibleDubs}
              crateName={selectedCrate?.name}
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
              onVolumeChange={setVolume}
              onShuffleChange={setShuffle}
              onRepeatChange={setRepeat}
              onDownload={downloadDub}
              onOpenProfile={openProfile}
              onPlay={togglePlayback}
              onQueryChange={setSearchQuery}
              query={searchQuery}
              onAddToCrate={setCratePickerDubId}
              crateId={selectedCrate?.id}
              onRemoveFromCrate={(crateId, dubId) => void updateCrateDub(crateId, dubId, false)}
            />
          </>
        )}
        {activeSection === "buddies" && (
          <BuddyListTemplate
            buddies={state.buddies}
            suggestedMembers={state.suggestedMembers}
            onAddFriend={(buddy) => void addBuddy(buddy.username)}
            onOpenChat={openChat}
            onQueryChange={setSearchQuery}
            onRemoveFriend={(buddyId) => void removeBuddy(buddyId)}
            onSelectProfile={openProfile}
            query={searchQuery}
          />
        )}
        {activeSection === "messenger" && (
          <MessengerTemplate
            buddies={state.buddies}
            conversations={state.conversations}
            dubs={state.dubs}
            initialBuddyId={chatBuddyId}
            chatConnectionStatus={chatConnectionStatus}
            onOpenProfile={openProfile}
            onPlay={togglePlayback}
            onStartConversation={() => setIsStartConversationOpen(true)}
            onSelectConversation={markConversationRead}
            onSendMessage={sendMessage}
          />
        )}
        {activeSection === "profile" && profile && (
          <ProfileTemplate
            isOwnProfile={isOwnProfile}
            profile={profile}
            uploads={profileUploads}
            isPlaying={state.isPlaying}
            onEditProfile={() => setIsProfileEditOpen(true)}
            onMessage={() => profileBuddy && openChat(profileBuddy.id)}
            onPlay={togglePlayback}
            playingDubId={state.nowPlayingId}
          />
        )}
      </div>
      <nav className="mobile-tabs" aria-label="Main sections">
        {sections.map((section) => (
          <button
            aria-current={activeSection === section && !selectedCrate ? "page" : undefined}
            className={activeSection === section && !selectedCrate ? "is-active" : ""}
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
      <Modal
        isOpen={isUploadOpen}
        onClose={() => {
          if (!uploadProgress) setIsUploadOpen(false);
        }}
        title="Share a dub"
      >
        <DubUploadForm
          artists={state.artists}
          onSubmit={handleShareDub}
          submissionError={uploadError}
          uploadProgress={uploadProgress}
          onCancel={() => setIsUploadOpen(false)}
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
              void updateProfile(values);
              setIsProfileEditOpen(false);
            }}
            profile={state.member}
          />
        )}
      </Modal>
      <Modal
        isOpen={isCrateCreateOpen}
        onClose={() => setIsCrateCreateOpen(false)}
        title="Create a crate"
      >
        <CreateCrateForm
          onCancel={() => setIsCrateCreateOpen(false)}
          onSubmit={handleCreateCrate}
        />
      </Modal>
      <Modal
        isOpen={cratePickerDubId !== null}
        onClose={() => setCratePickerDubId(null)}
        title={`Add ${state.dubs.find((dub) => dub.id === cratePickerDubId)?.title ?? "dub"} to a crate`}
      >
        <CratePicker
          crates={state.crates}
          onCancel={() => setCratePickerDubId(null)}
          onSelect={handleAddDubToCrate}
        />
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
    </DashboardTemplate>
  );
}
