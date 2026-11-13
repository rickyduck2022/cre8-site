import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import {
  Friends,
  FriendsFeed,
  Download,
  Disc3,
  AudioLines,
  Microphone,
  Upload,
  Folder,
  MessageCircle,
  LockKeyhole,
  Users,
} from "@craft/icons";
import {
  AppHeader,
  ThemeToggle,
  TutorialNavigationContext,
  TutorialActivityContext,
  useTutorialActivityChannel,
  type TutorialStep,
  type TutorialNavigationRequest,
  ArtistCard,
  ArtistRegistrationForm,
  BuddyListTemplate,
  Button,
  DashboardTemplate,
  DubManagementDialogs,
  DubUploadForm,
  EditProfileDialog,
  FloatingWindow,
  WindowLayer,
  Workspace,
  workspaceWindows,
  ModalFooterOutlet,
  LatestDubsTemplate,
  HistoryNavigation,
  LibraryTemplate,
  MyDubsTemplate,
  MessengerTemplate,
  MobileNavigation,
  Modal,
  Navigation,
  ActivityWindows,
  ProfileTemplate,
  ShareDubDialog,
  SharePackDialog,
  canSharePack,
  canShareDub,
  SharedWithMeTemplate,
  shareDubToFriends,
  createEmptyDubSearchFilters,
  getDubSearchFilterCount,
  DubSearch,
  DubSearchToolbar,
  matchesOwnedFile,
  trackFormat,
  type DubSearchFilters,
  type Dub,
  type DubPack,
  type NotificationMessage,
  type NavigationSection,
  type MediaKind,
  type ActiveWindowGroup,
} from "@craft/ui";
import { DemoModeNotice } from "../components/DemoModeNotice";
import { Tutorials } from "../features/onboarding/Tutorials";
import { AListApplication } from "../components/AListApplication";
import { AppPlayer } from "../components/AppPlayer";
import { PackWorkspace } from "../components/PackWorkspace";
import { PackWindows, type PackWindowState } from "../components/PackWindows";
import { TrackWindow, type TrackWindowState } from "../components/TrackWindow";
import { useWindowWorkspace } from "../hooks/useWindowWorkspace";
import { downloadPack, packRequest } from "../services/packs";
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
  vocals: "Vocal Vault",
  alist: "A-List",
  "shared-with-me": "Dubs shared with you",
  "shared-samples": "Samples shared with you",
  "shared-vocals": "Vocals shared with you",
  "alist-application": "A-List Submission",
  buddies: "Friend List",
  messenger: "Messenger",
  profile: "My Profile",
  library: "My Library",
  "my-dubs": "Your Dubs",
  "my-samples": "Your Samples",
  "my-vocals": "Your Vocals",
  "all-uploads": "My Uploads",
  "full-library": "Full Library",
};

const sectionIcons: Record<CommunitySection, ReactNode> = {
  dubs: <FriendsFeed />,
  samples: <AudioLines />,
  vocals: <Microphone />,
  alist: <Disc3 />,
  "alist-application": <Users />,
  buddies: <Friends />,
  messenger: <MessageCircle />,
  profile: <Users />,
  library: <Download />,
  "shared-with-me": <LockKeyhole />,
  "shared-samples": <LockKeyhole />,
  "shared-vocals": <LockKeyhole />,
  "my-dubs": <Disc3 />,
  "my-samples": <AudioLines />,
  "my-vocals": <Microphone />,
  "all-uploads": <Upload />,
  "full-library": <AudioLines />,
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

function createNavigationSections(unreadCount: number, aListApproved: boolean, sharedCount: number, feedCount: number, aListCount: number, sampleCount: number, sharedSampleCount: number, vocalCount: number, sharedVocalCount: number): NavigationSection[] {
  const groups: { label: string; mediaKind?: MediaKind; sections: CommunitySection[] }[] = [
    { label: "Dubs", mediaKind: "dub", sections: ["dubs", "my-dubs", "shared-with-me"] },
    { label: "Samples", mediaKind: "sample", sections: ["samples", "my-samples", "shared-samples"] },
    { label: "Vocals", mediaKind: "vocal", sections: ["vocals", "my-vocals", "shared-vocals"] },
    { label: "", sections: ["all-uploads"] },
    { label: "Your space", sections: sections.filter((section) => !["dubs", "my-dubs", "samples", "my-samples", "vocals", "my-vocals", "shared-with-me", "shared-samples", "shared-vocals", "all-uploads"].includes(section)) },
  ];
  return groups.map((group) => ({
      label: group.label || undefined,
      mediaKind: group.mediaKind,
      icon: group.mediaKind === "vocal" ? <Microphone /> : group.mediaKind === "sample" ? sectionIcons.samples : sectionIcons.dubs,
      items: group.sections.filter((section) => section !== "alist" || aListApproved).map((section) => ({
        label: sectionLabels[section],
        displayLabel: group.mediaKind ? section.startsWith("my-") ? "Your uploads" : section.startsWith("shared-") ? "Shared with you" : "Explore vault" : undefined,
        icon: sectionIcons[section],
        href: `#${section}`,
        mediaKind: group.mediaKind,
        variant: section === "alist" ? "alist" as const : section === "shared-with-me" || section === "shared-samples" || section === "shared-vocals" ? "private" as const : undefined,
        badge:
          section === "dubs"
            ? String(feedCount)
            : section === "vocals" ? String(vocalCount)
            : section === "shared-vocals" ? String(sharedVocalCount)
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
  const tutorialActivity = useTutorialActivityChannel();
  const tutorialOwner = useRef<string | undefined>(undefined);
  const persistedTutorialWorkspaces = useRef(new Map<string, string>());
  const pendingTutorialWorkspaceSave = useRef<{ ownerId: string; id: string; checkpoint: string } | null>(null);
  useEffect(() => tutorialActivity.subscribe((event) => {
    if (event.type === "workspace-save-requested" && event.subjectId && event.value && tutorialOwner.current) {
      if (persistedTutorialWorkspaces.current.get(event.subjectId) === event.value) {
        tutorialActivity.report({ type: "workspace-saved", subjectId: event.subjectId });
      } else {
        pendingTutorialWorkspaceSave.current = { ownerId: tutorialOwner.current, id: event.subjectId, checkpoint: event.value };
      }
    }
  }), [tutorialActivity]);
  const {
    state,
    chatConnectionStatus,
    loading,
    error,
    notifications,
    activeNotifications,
    unreadNotificationCount,
    uploadProgress,
    uploadResults,
    dismissUploadResult,
    uploadError,
    notify,
    saveWindowWorkspace,
    restoreWindowTrack,
    mainPlayer,
    selectPlayerContext,
    pausePlayback,
    windowPlayback,
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
    toggleSinglePlayback = togglePlayback,
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
    activateWindowQueue,
    setWindowSettings,
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
  } = useCommunity(tutorialActivity.report);
  tutorialOwner.current = state.member?.id;
  const [activeSection, setActiveSection] = useState<CommunitySection>(() =>
    getSectionFromHash(window.location.hash),
  );
  const accessibleTracks = useMemo(() => [...state.dubs, ...(state.draftDubs ?? [])], [state.dubs, state.draftDubs]);
  const [profileUsername, setProfileUsername] = useState(() => new URLSearchParams(window.location.hash.split("?")[1]).get("user") ?? "");
  const [chatBuddyId, setChatBuddyId] = useState(() => new URLSearchParams(window.location.hash.split("?")[1]).get("buddy") ?? "");
  const [chatNavigationKey, setChatNavigationKey] = useState(0);
  const [conversationWindows, setConversationWindows] = useState<{ buddyId: string; openRequest: number; groupWith?: { id: string; request: number } }[]>([]);
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
  const [vocalFilters, setVocalFilters] = useState<DubSearchFilters>(createEmptyDubSearchFilters);
  const [aListFilters, setAListFilters] = useState<DubSearchFilters>(createEmptyDubSearchFilters);
  const vaultKind = activeSection === "vocals" ? "vocal" : activeSection === "samples" ? "sample" : activeSection === "dubs" ? "dub" : undefined;
  const dubSearchFilters = activeSection === "alist" ? aListFilters : activeSection === "vocals" ? vocalFilters : activeSection === "samples" ? sampleFilters : feedFilters;
  const setDubSearchFilters = activeSection === "alist" ? setAListFilters : activeSection === "vocals" ? setVocalFilters : activeSection === "samples" ? setSampleFilters : setFeedFilters;
  const dubSearch = useDubSearch(searchQuery, dubSearchFilters, Boolean(vaultKind) || (activeSection === "alist" && state.member?.aListApproved === true), activeSection === "alist" ? "alist" : "feed", vaultKind);
  const isDubSearchActive = Boolean(searchQuery.trim() || getDubSearchFilterCount(dubSearchFilters));
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const { members: memberSearchResults, isSearching: isSearchingMembers } = useMemberSearch(memberSearchQuery);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadChooser, setUploadChooser] = useState(false);
  const [uploadChoiceKind, setUploadChoiceKind] = useState<MediaKind>("dub");
  const [uploadFormDirty, setUploadFormDirty] = useState(false);
  const [myDubsTab, setMyDubsTab] = useState<"dubs" | "packs">("dubs");
  const [mySamplesTab, setMySamplesTab] = useState<"dubs" | "packs">("dubs");
  const [myVocalsTab, setMyVocalsTab] = useState<"dubs" | "packs">("dubs");
  const [allUploadsTab, setAllUploadsTab] = useState<"dubs" | "packs">("dubs");
  const [allUploadsFilters, setAllUploadsFilters] = useState<DubSearchFilters>(() => ({
    ...createEmptyDubSearchFilters(), distributions: ["worldwide", "private", "alist"],
  }));
  const [allUploadsQuery, setAllUploadsQuery] = useState("");
  const [allUploadsPackCount, setAllUploadsPackCount] = useState(0);
  const [allUploadsPacksLoading, setAllUploadsPacksLoading] = useState(true);
  const allUploadsKind = allUploadsFilters.mediaKind ?? "all";
  const isAllUploads = activeSection === "all-uploads";
  const isMyVocals = activeSection === "my-vocals";
  const isMySamples = activeSection === "my-samples";
  const ownedMediaKind = isAllUploads ? allUploadsKind === "all" ? undefined : allUploadsKind : isMyVocals ? "vocal" : isMySamples ? "sample" : "dub";
  const ownedMediaTitle = isAllUploads ? "My Uploads" : isMyVocals ? "Your Vocals" : isMySamples ? "Your Samples" : "Your Dubs";
  const ownedMediaTab = isAllUploads ? allUploadsTab : isMyVocals ? myVocalsTab : isMySamples ? mySamplesTab : myDubsTab;
  const setOwnedMediaTab = isAllUploads ? setAllUploadsTab : isMyVocals ? setMyVocalsTab : isMySamples ? setMySamplesTab : setMyDubsTab;
  const [uploadMediaKind, setUploadMediaKind] = useState<"dub" | "vocal">("dub");
  const [createPack, setCreatePack] = useState(false);
  const [pendingPackDub, setPendingPackDub] = useState<Dub | null>(null);
  const [pendingEditPack, setPendingEditPack] = useState<DubPack | null>(null);
  const [uploadMode, setUploadMode] = useState<"dub" | "pack">("dub");
  const [packJourneyBusy, setPackJourneyBusy] = useState(false);
  const [packJourneyDirty, setPackJourneyDirty] = useState(false);
  const [uploadPackMounted, setUploadPackMounted] = useState(false);
  const [packJourneyRequest, setPackJourneyRequest] = useState(0);
  const [packJourneyKind, setPackJourneyKind] = useState<"dub" | "sample" | "vocal" | undefined>(undefined);
  const [profileWindows, setProfileWindows] = useState<{ username: string; openRequest: number; groupWith?: { id: string; request: number } }[]>([]);
  const [packWindows, setPackWindows] = useState<PackWindowState[]>([]);
  const [trackWindows, setTrackWindows] = useState<TrackWindowState[]>([]);
  const [windowStack, setWindowStack] = useState<string[]>([]);
  const [activeWindowGroup, setActiveWindowGroup] = useState<ActiveWindowGroup | null>(null);
  const [groupTracklists, setGroupTracklists] = useState<Record<string, string>>({});
  const raiseWindow = useCallback((id: string) => setWindowStack((current) =>
    current[current.length - 1] === id ? current : [...current.filter((entry) => entry !== id), id]), []);
  const dropWindow = useCallback((id: string) => setWindowStack((current) =>
    current.includes(id) ? current.filter((entry) => entry !== id) : current), []);
  const [isUploadSubmitting, setIsUploadSubmitting] = useState(false);
  const [publishedDub, setPublishedDub] = useState<Dub | null>(null);
  const [editingDub, setEditingDub] = useState<Dub | null>(null);
  const [deletingDub, setDeletingDub] = useState<Dub | null>(null);
  const [shareDubTargetId, setShareDubTargetId] = useState<string | null>(null);
  const [sharingDub, setSharingDub] = useState<{ dub: Dub; failedIds?: string[]; sentIds?: string[] } | null>(null);
  const [sharingPack, setSharingPack] = useState<DubPack | null>(null);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [tutorialsOwner, setTutorialsOwner] = useState<string | null>(null);
  const [tutorialNavigation, setTutorialNavigation] = useState<(Omit<TutorialNavigationRequest, "ready"> & { destination: CommunitySection }) | null>(null);
  const tutorialUpload = useRef(false);
  const [uploadOpenRequest, setUploadOpenRequest] = useState(0);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep | null>(null);
  const [isStartConversationOpen, setIsStartConversationOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [registrationPending, setRegistrationPending] = useState(false);
  const memberBuddyIds = useRef(new Map<string, string>());
  useEffect(() => { setPublishedDub(null); }, [state.member?.id]);
  useEffect(() => {
    setPackWindows([]); setTrackWindows([]); setConversationWindows([]); setProfileWindows([]); setWindowStack([]);
    setActiveWindowGroup(null); setGroupTracklists({});
    setIsUploadOpen(false); setUploadPackMounted(false); setPackJourneyDirty(false); setPackJourneyBusy(false);
    setUploadFormDirty(false); setUploadChooser(false);
    setCreatePack(false); setPendingPackDub(null); setPendingEditPack(null); setShareDubTargetId(null);
    setTutorialNavigation(null); setTutorialStep(null); tutorialUpload.current = false;
    pendingTutorialWorkspaceSave.current = null;
    persistedTutorialWorkspaces.current = new Map((state.windowWorkspace?.workspaces ?? []).filter((entry) => entry.saved)
      .map((entry) => [entry.id, JSON.stringify({ title: entry.title, layout: entry.savedLayout })]));
  }, [state.member?.id]);

  const sharedDubs = state.dubs.filter((dub) => state.sharedDubIds.has(dub.id));
  const sharedDubCount = sharedDubs.filter((dub) => (dub.mediaKind ?? "dub") === "dub").length;
  const sharedSampleCount = sharedDubs.filter((dub) => dub.mediaKind === "sample").length;
  const sharedVocalCount = sharedDubs.filter((dub) => dub.mediaKind === "vocal").length;
  const sharedMediaKind = activeSection === "shared-vocals" ? "vocal" : activeSection === "shared-samples" ? "sample" : "dub";
  const approved = state.member?.aListApproved === true;
  useEffect(() => {
    if (state.member) returnToSharedDub();
  }, [state.member?.id]);
  const vaultDubs = vaultKind ? state.dubs.filter((dub) => (dub.mediaKind ?? "dub") === vaultKind) : state.dubs;
  const feedCount = state.dubs.filter((dub) => (dub.mediaKind ?? "dub") === "dub" && isFeedDub(dub, false, approved)).length;
  const sampleCount = state.dubs.filter((dub) => dub.mediaKind === "sample" && isFeedDub(dub, false, approved)).length;
  const vocalCount = state.dubs.filter((dub) => dub.mediaKind === "vocal" && isFeedDub(dub, false, approved)).length;
  const aListCount = state.dubs.filter((dub) => isFeedDub(dub, true, approved)).length;
  const navigationSections = useMemo(
    () => createNavigationSections(unreadCount, approved, sharedDubCount, feedCount, aListCount, sampleCount, sharedSampleCount, vocalCount, sharedVocalCount),
    [unreadCount, approved, sharedDubCount, feedCount, aListCount, sampleCount, sharedSampleCount, vocalCount, sharedVocalCount],
  );
  const interactiveNavigationSections = navigationSections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      return { ...item, onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        if (!item.href || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        history.navigate(item.href);
        tutorialActivity.report({ type: "navigate", value: item.href.slice(1) });
      } };
    }),
  }));
  const groupSources = (activeWindowGroup?.windows ?? []).flatMap<{ id: string; label: string; tracks: Dub[]; packId?: string }>((entry) => {
    const pack = entry.id.startsWith("pack:") ? state.packs.find((pack) => `pack:${pack.id}` === entry.id) : undefined;
    if (pack && (pack.status === "published" || pack.ownerUsername === state.member?.username) && pack.items.length) return [{ id: pack.id, label: entry.title, tracks: pack.items.map(({ dub }) => dub), packId: pack.id }];
    const track = entry.id.startsWith("track:") ? accessibleTracks.find((dub) => `track:${dub.id}` === entry.id) : undefined;
    return track ? [{ id: entry.id, label: entry.title, tracks: [track], packId: undefined }] : [];
  });
  const selectedSource = groupSources.find((source) => source.id === (activeWindowGroup && groupTracklists[activeWindowGroup.id]))
    ?? groupSources.find((source) => activeWindowGroup?.activeWindowId === `pack:${source.id}` || activeWindowGroup?.activeWindowId === source.id)
    ?? groupSources[0];
  const selectedSourceId = selectedSource?.id ?? null;
  const groupTracklistControl = selectedSource && activeWindowGroup ? {
    selectedId: selectedSource.id, tracklists: groupSources,
    onSelect: (id: string) => {
      setGroupTracklists((current) => ({ ...current, [activeWindowGroup.id]: id }));
      raiseWindow(id);
    },
  } : undefined;
  const selectedSourceTracks = selectedSource?.tracks.map((dub) => dub.id).join("|") ?? "";
  useEffect(() => {
    selectPlayerContext?.(selectedSourceId, selectedSource?.tracks, selectedSource?.packId);
  }, [selectedSourceId, selectedSourceTracks, selectPlayerContext]);
  useEffect(() => {
    if (!activeWindowGroup || !selectedSourceId) return;
    setGroupTracklists((current) => current[activeWindowGroup.id] === selectedSourceId ? current
      : { ...current, [activeWindowGroup.id]: selectedSourceId });
  }, [activeWindowGroup?.id, selectedSourceId]);
  useEffect(() => {
    const contextId = state.audibleContextId;
    if (!activeWindowGroup || !contextId || !groupSources.some((source) => source.id === contextId)) return;
    setGroupTracklists((current) => current[activeWindowGroup.id] === contextId ? current : { ...current, [activeWindowGroup.id]: contextId });
  }, [activeWindowGroup?.id, state.audibleContextId, state.nowPlayingId, state.isPlaying]);
  const controller = mainPlayer ?? { state, togglePlayback, closePlayer, seekPlayback, seekPlaybackProgress,
    setShuffle, setRepeat, playNextDub, playPreviousDub, activateQueue: activatePackQueue, playQueue: playPack };
  const mainState = controller.state;
  const [playlistContainer, setPlaylistContainer] = useState<HTMLDivElement | null>(null);
  const windowControls = windowPlayback ?? { togglePlayback, seekPlayback, seekPlaybackProgress, playPack, playNextDub, playPreviousDub };
  const previewTrack = accessibleTracks.find((dub) => dub.id === mainState.nowPlayingId) ?? null;
  const playerLayout = usePlayerLayout({
    activeSection,
    hasTrack: Boolean(previewTrack),
    enabled: !loading && Boolean(state.member),
    packId: mainState.queuePackId?.startsWith("track:") ? null : mainState.queuePackId,
  });
  const openPackWindow = (pack: DubPack) => {
    setPackWindows((current) => [...current.filter((item) => item.pack.id !== pack.id),
      { pack, openRequest: (current.find((item) => item.pack.id === pack.id)?.openRequest ?? 0) + 1 }]);
    raiseWindow(pack.id);
    tutorialActivity.report({ type: "window-opened", subjectId: `pack:${pack.id}` });
  };
  const saveTutorialWorkspace = useCallback(async (ownerId: string, layout: Parameters<typeof saveWindowWorkspace>[1]) => {
    await saveWindowWorkspace(ownerId, layout);
    if (tutorialOwner.current !== ownerId) return;
    persistedTutorialWorkspaces.current = new Map((layout.workspaces ?? []).filter((entry) => entry.saved)
      .map((entry) => [entry.id, JSON.stringify({ title: entry.title, layout: entry.savedLayout })]));
    const pending = pendingTutorialWorkspaceSave.current;
    const record = layout.workspaces?.find((entry) => entry.id === pending?.id);
    if (pending?.ownerId === ownerId && record?.saved && persistedTutorialWorkspaces.current.get(record.id) === pending.checkpoint) {
      pendingTutorialWorkspaceSave.current = null;
      tutorialActivity.report({ type: "workspace-saved", subjectId: record.id });
    }
  }, [saveWindowWorkspace, tutorialActivity]);
  const workspace = useWindowWorkspace(state.member?.id, state.windowWorkspace, loading, typeof saveWindowWorkspace === "function" ? saveTutorialWorkspace : undefined, notify);
  const [workspaceOwner, setWorkspaceOwner] = useState<string | null>(null);
  useEffect(() => {
    if (!state.member) { setWorkspaceOwner(null); return; }
    if (!workspace.ready || workspaceOwner === state.member.id) return;
    const saved = workspace.initial;
    const restoredTrack = accessibleTracks.find((dub) => dub.id === saved?.playerTrackId);
    const windows = workspaceWindows(saved).filter((entry) => {
      if (entry.id === "player") return false;
      if (entry.id.startsWith("workspace:")) return saved?.workspaces?.some((context) => context.id === entry.id.slice(10));
      if (entry.id.startsWith("pack:")) return state.packs.some((pack) => `pack:${pack.id}` === entry.id);
      if (entry.id.startsWith("track:")) return state.dubs.some((dub) => `track:${dub.id}` === entry.id);
      if (entry.id.startsWith("profile:")) return [state.member, ...state.buddies, ...state.suggestedMembers]
        .some((member) => member && `profile:${member.username}` === entry.id);
      return state.buddies.some((buddy) => `conversation:${buddy.id}` === entry.id);
    });
    setPackWindows(windows.filter((entry) => entry.id.startsWith("pack:")).flatMap((entry) => {
      const pack = state.packs.find((pack) => pack.id === entry.id.slice(5));
      return pack ? [{ pack, openRequest: 0 }] : [];
    }));
    setConversationWindows(windows.filter((entry) => entry.id.startsWith("conversation:")
      && state.buddies.some((buddy) => `conversation:${buddy.id}` === entry.id))
      .map((entry) => ({ buddyId: entry.id.slice(13), openRequest: 0 })));
    setTrackWindows(windows.filter((entry) => entry.id.startsWith("track:")
      && state.dubs.some((dub) => `track:${dub.id}` === entry.id))
      .map((entry) => ({ dubId: entry.id.slice(6), openRequest: 0 })));
    setProfileWindows(windows.filter((entry) => entry.id.startsWith("profile:")).map((entry) => ({ username: entry.id.slice(8), openRequest: 0 })));
    setWindowStack([...windows].sort((a, b) => a.order - b.order).map((entry) => entry.id.startsWith("pack:") ? entry.id.slice(5) : entry.id));
    if (restoredTrack && workspaceWindows(saved).some((entry) => entry.id === "player")) {
      if (state.nowPlayingId !== restoredTrack.id) restoreWindowTrack(restoredTrack);
    }
    setWorkspaceOwner(state.member.id);
  }, [state.member, state.packs, state.buddies, state.dubs, state.nowPlayingId, workspace.ready, workspace.initial, workspaceOwner, restoreWindowTrack]);
  const openConversationWindow = (buddyId: string, username?: string) => {
    const buddy = state.buddies.find((entry) => entry.id === buddyId);
    const profileWindow = profileWindows.find((entry) => entry.username === (buddy?.username ?? username));
    const request = ++shareWindowSequence.current;
    setConversationWindows((current) => [...current.filter((entry) => entry.buddyId !== buddyId),
      { buddyId, openRequest: request, ...(profileWindow ? { groupWith: { id: `profile:${profileWindow.username}`, request } } : {}) }]);
    raiseWindow(`conversation:${buddyId}`);
  };
  const shareWindowSequence = useRef(0);
  const openDubWindow = (dub: Dub) => {
    setTrackWindows((current) => [...current.filter((entry) => entry.dubId !== dub.id),
      { dubId: dub.id, openRequest: ++shareWindowSequence.current }]);
    raiseWindow(`track:${dub.id}`);
    tutorialActivity.report({ type: "window-opened", subjectId: `track:${dub.id}` });
  };
  const openSharedPack = (buddyId: string, pack: DubPack) => {
    openConversationWindow(buddyId);
    const request = ++shareWindowSequence.current;
    setPackWindows((current) => [...current.filter((entry) => entry.pack.id !== pack.id),
      { pack, openRequest: request, groupWith: { id: `conversation:${buddyId}`, request } }]);
    raiseWindow(pack.id);
  };
  const openSharedDub = (buddyId: string, dub: Dub) => {
    openConversationWindow(buddyId);
    const request = ++shareWindowSequence.current;
    setTrackWindows((current) => [...current.filter((entry) => entry.dubId !== dub.id),
      { dubId: dub.id, openRequest: request, groupWith: { id: `conversation:${buddyId}`, request } }]);
    raiseWindow(`track:${dub.id}`);
  };
  const dubsById = new Map(accessibleTracks.map((dub) => [dub.id, dub]));
  const suggestedByUsername = new Map(state.suggestedMembers.map((member) => [member.username, member]));
  const profile =
    profileUsername === state.member?.username || !profileUsername
      ? state.member
      : state.buddies.find((buddy) => buddy.username === profileUsername) ??
        state.suggestedMembers.find((member) => member.username === profileUsername) ??
        null;
  const myDubs = state.member
    ? state.dubs.filter((dub) => dub.uploader === state.member?.username)
    : [];
  const ownedMedia = myDubs.filter((dub) => isAllUploads ? matchesOwnedFile(dub, allUploadsQuery, allUploadsFilters)
    : !ownedMediaKind || (dub.mediaKind ?? "dub") === ownedMediaKind);
  function clearAllUploadsFilters() {
    setAllUploadsQuery("");
    setAllUploadsFilters({ ...createEmptyDubSearchFilters(), distributions: ["worldwide", "private", "alist"] });
  }
  const packPlaybackControls = {
    activePackId: state.queuePackId,
    onActivateQueue: activatePackQueue, onPrevious: playPreviousDub, onNext: playNextDub,
    onShuffleChange: setShuffle, onRepeatChange: setRepeat, shuffle: state.shuffle, repeat: state.repeat,
  };
  const activePack = mainState.queuePackId ? state.packs.find((pack) => pack.id === mainState.queuePackId
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
  const aListMembers = [
    ...state.buddies.filter((buddy) => buddy.aListApproved === true && buddy.userId).map((buddy) => ({ ...buddy, id: `member:${buddy.userId}` })),
    ...state.suggestedMembers.filter((member) => member.aListApproved === true).map((member) => ({ ...member, id: `member:${member.id}` })),
  ];
  function shareDialogId(id: string, dub: Dub) {
    if (dub.distribution !== "alist" || dub.aListPublic === true || id.startsWith("member:")) return id;
    const userId = state.buddies.find((buddy) => buddy.id === id)?.userId;
    return userId ? `member:${userId}` : id;
  }
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
  function navigateTutorialStep(step: TutorialStep) {
    const journey = step.journey;
    const previousDestination = tutorialNavigation && journey?.destinations?.includes(tutorialNavigation.destination)
      ? tutorialNavigation.destination : journey?.destination;
    const requested = previousDestination === "alist" && !approved ? "alist-application" : previousDestination;
    const destination = journey?.destinations?.includes(activeSection) ? activeSection : sections.find((section) => section === requested);
    if (!journey || !destination) { notify("This tutorial destination is not available.", "error"); return; }
    if (journey.surface === "upload") {
      if (!isUploadOpen) { openSingleUpload("dub", true); tutorialUpload.current = true; }
      else if (uploadFormDirty || packJourneyDirty) notify("Your current upload has been kept. Continue with it, or close it yourself when ready.", "info");
      setUploadOpenRequest((request) => request + 1);
    } else if (tutorialUpload.current && isUploadOpen && !uploadFormDirty && !packJourneyDirty && !isUploadSubmitting && !packJourneyBusy && !uploadProgress) {
      setIsUploadOpen(false); setUploadChooser(false); setUploadPackMounted(false);
      tutorialUpload.current = false;
    }
    if (destination === "all-uploads") setAllUploadsTab("dubs");
    if (destination === "my-samples") setMySamplesTab("dubs");
    navigateTo(destination);
    setTutorialNavigation((current) => ({ id: (current?.id ?? 0) + 1, destination, surface: journey.surface }));
  }
  useEffect(() => {
    if (!tutorialStep?.journey?.destinations?.includes(activeSection)) return;
    setTutorialNavigation((current) => current && current.destination !== activeSection
      ? { ...current, id: current.id + 1, destination: activeSection }
      : current);
  }, [activeSection, tutorialStep?.journey]);

  function openProfile(username: string) {
    const person = [state.member, ...state.buddies, ...state.suggestedMembers].find((member) => member?.username === username);
    if (!person) { notify("This profile is no longer available.", "error"); return; }
    const buddy = state.buddies.find((buddy) => buddy.username === username);
    const conversation = conversationWindows.find((entry) => entry.buddyId === buddy?.id);
    const request = ++shareWindowSequence.current;
    setProfileWindows((current) => [...current.filter((entry) => entry.username !== username),
      { username, openRequest: request, ...(conversation ? { groupWith: { id: `conversation:${conversation.buddyId}`, request } } : {}) }]);
    raiseWindow(`profile:${username}`);
  }

  function openChat(buddyId: string) {
    void markConversationRead(buddyId);
    history.navigate(`#messenger?${new URLSearchParams({ buddy: buddyId })}`);
  }

  function canSwitchUpload() {
    if (packJourneyBusy || isUploadSubmitting || uploadProgress) return false;
    return !(packJourneyDirty || uploadFormDirty) || window.confirm("Change upload type? Unsaved edits and files not yet uploaded will be lost. Saved files remain in their pack.");
  }

  function openSingleUpload(kind: "dub" | "vocal", chooser = false, buddyId: string | null = null) {
    if (!canSwitchUpload()) return false;
    tutorialUpload.current = false;
    setUploadChooser(chooser); setUploadChoiceKind(kind); setUploadMediaKind(kind);
    setUploadMode("dub"); setUploadFormDirty(false); setIsUploadOpen(true); setShareDubTargetId(buddyId);
    setUploadPackMounted(false); setPackJourneyDirty(false); setCreatePack(false); setPendingPackDub(null); setPendingEditPack(null);
    return true;
  }

  function openPackJourney(kind?: "dub" | "sample" | "vocal", pendingDub: Dub | null = null, editPack: DubPack | null = null, chooser = false) {
    if (!canSwitchUpload()) return false;
    tutorialUpload.current = false;
    setUploadChooser(chooser); setUploadChoiceKind(kind ?? "dub"); setUploadFormDirty(false);
    setUploadPackMounted(true); setPackJourneyRequest((request) => request + 1); setPackJourneyDirty(false);
    setPackJourneyKind(kind); setUploadMode("pack"); setIsUploadOpen(true);
    setPendingPackDub(pendingDub); setPendingEditPack(editPack); setCreatePack(!editPack && !pendingDub);
    return true;
  }

  function beginDubEdit(dub: Dub) {
    setEditingDub(dub);
  }

  function beginPackEdit(pack: DubPack) {
    if (pack.ownerUsername !== state.member?.username) return;
    openPackJourney(pack.kind, null, pack);
  }

  async function handleDeletePack(pack: DubPack) {
    if (pack.ownerUsername !== state.member?.username) throw new Error("Only the pack owner can delete this release.");
    await packRequest(`/api/packs/${encodeURIComponent(pack.id)}`, "DELETE");
    setPackWindows((current) => current.filter((entry) => entry.pack.id !== pack.id));
    dropWindow(pack.id);
    await refreshCommunity();
  }

  function beginDubDelete(dub: Dub) {
    setDeletingDub(dub);
  }

  function openNotification(notification: NotificationMessage) {
    if (notification.conversationId) openChat(notification.conversationId);
  }

  async function startConversation(username: string, windowed = false) {
    const buddyId = await addBuddy(username);
    if (!buddyId) return;
    setIsStartConversationOpen(false);
    if (windowed) openConversationWindow(buddyId, username);
    else openChat(buddyId);
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
      const noun = dub.mediaKind === "vocal" ? "vocal" : "dub";
      const result = await shareDubToFriends(targetIds, dub.id, `Shared a ${noun}: ${dub.title}`, sendMessage);
      setIsUploadOpen(false);
      setUploadFormDirty(false);
      setShareDubTargetId(null);
      if (result.failed.length) {
        notify(`${dub.title} was uploaded, but could not be sent to every selected friend. Retry without uploading again.`, "error");
        setSharingDub({ dub, failedIds: result.failed, sentIds: result.sent });
        navigateTo(dub.mediaKind === "vocal" ? "my-vocals" : "my-dubs");
      } else if (targetIds.length === 1) {
        openChat(targetIds[0]);
      } else {
        if (targetIds.length > 1) notify(`${dub.title} was sent to ${targetIds.length} friends in Messenger.`);
        navigateTo(dub.distribution === "private" ? dub.mediaKind === "vocal" ? "my-vocals" : "my-dubs" : dub.distribution === "alist" ? "alist" : dub.mediaKind === "vocal" ? "vocals" : "dubs");
      }
      tutorialActivity.report({ type: "file-uploaded", subjectId: dub.id });
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
          <ThemeToggle />
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
  const renderProfile = (person: NonNullable<typeof profile>) => <ProfileTemplate
    isOwnProfile={person.username === state.member?.username} profile={person}
    uploads={person.username === state.member?.username ? myDubs : state.dubs.filter((dub) => dub.uploader === person.username
      && (dub.distribution === "worldwide" || (dub.distribution === "alist" && dub.aListPublic === true)))}
    packs={state.packs} likedDubIds={state.likedDubIds} {...packPlaybackControls} onPlayPack={playPack}
    onSharePack={beginSharingPack} onOpenPack={(pack) => {
      const buddy = state.buddies.find((buddy) => buddy.username === person.username);
      if (buddy) openSharedPack(buddy.id, pack);
      else {
        const request = ++shareWindowSequence.current;
        setPackWindows((current) => [...current.filter((entry) => entry.pack.id !== pack.id),
          { pack, openRequest: request, groupWith: { id: `profile:${person.username}`, request } }]);
        raiseWindow(pack.id);
      }
    }} onEditPack={beginPackEdit} onDeletePack={handleDeletePack} onDownloadPack={handleDownloadPack}
    isPlaying={state.isPlaying} currentTimeSeconds={state.currentTime} durationSeconds={state.duration}
    volume={state.volume} shuffle={state.shuffle} repeat={state.repeat} playbackError={state.playbackError}
    onSeek={seekPlayback} onSeekProgress={seekPlaybackProgress} onVolumeChange={setVolume}
    onShuffleChange={setShuffle} onRepeatChange={setRepeat} onPrevious={playPreviousDub} onNext={playNextDub}
    onEditProfile={() => setIsProfileEditOpen(true)} onMessage={() => {
      const buddy = state.buddies.find((buddy) => buddy.username === person.username);
      if (buddy) openConversationWindow(buddy.id);
      else void startConversation(person.username, true);
    }} onPlay={togglePlayback} onPlaySingle={toggleSinglePlayback} playingDubId={state.nowPlayingId} onDownload={downloadDub}
    onOpenProfile={openProfile} onOpenDub={openDubWindow} onEditDub={beginDubEdit} onDeleteDub={beginDubDelete}
    currentUsername={state.member?.username} onShareWithFriend={beginSharingDub}
  />;
  const renderMessenger = (buddyId: string, conversationOnly = false) => (
    <MessengerTemplate
      buddies={conversationOnly ? state.buddies.filter((buddy) => buddy.id === buddyId) : state.buddies}
      conversations={state.conversations} dubs={state.dubs} shareableDubs={myDubs}
      packs={state.packs}
      shareablePacks={state.packs.filter((pack) => state.member !== null && canSharePack(pack, state.member.username))}
      likedDubIds={state.likedDubIds} onPlayPack={playPack} onOpenPack={openPackWindow}
      onDownloadPack={handleDownloadPack} onSendPack={sendPackMessage}
      activePackId={state.queuePackId} onActivateQueue={activatePackQueue}
      initialBuddyId={buddyId} navigationKey={conversationOnly ? 0 : chatNavigationKey}
      conversationOnly={conversationOnly} onOpenConversationWindow={conversationOnly ? undefined : openConversationWindow}
      onOpenSharedPack={openSharedPack} onOpenSharedDub={openSharedDub}
      chatConnectionStatus={chatConnectionStatus} nowPlayingId={state.nowPlayingId}
      isPlaying={state.isPlaying} currentTimeSeconds={state.currentTime} durationSeconds={state.duration}
      onSeek={seekPlayback} onSeekProgress={seekPlaybackProgress} volume={state.volume}
      shuffle={state.shuffle} repeat={state.repeat} playbackError={state.playbackError}
      onVolumeChange={setVolume} onShuffleChange={setShuffle} onRepeatChange={setRepeat}
      onPrevious={playPreviousDub} onNext={playNextDub} onOpenProfile={openProfile}
      onPlay={togglePlayback} onPlaySingle={toggleSinglePlayback} onDownload={downloadDub}
      onStartConversation={() => setIsStartConversationOpen(true)}
      onCreateAndShareDub={(id) => openSingleUpload("dub", false, id)}
      onSelectConversation={openChat} onLoadOlderMessages={loadOlderMessages}
      onSendMessage={sendMessage} onUnsendMessage={unsendMessage}
    />
  );
  const appPlayer = (
        <AppPlayer
          track={previewTrack}
          pack={activePack}
          playlistContainer={playlistContainer}
          onShare={activePack
            ? canSharePack(activePack, state.member.username) ? () => beginSharingPack(activePack) : undefined
            : previewTrack && canShareDub(previewTrack, state.member.username) ? () => beginSharingDub(previewTrack) : undefined}
          onDownload={previewTrack ? () => activePack ? handleDownloadPack(activePack) : downloadDub(previewTrack) : undefined}
          playlist={activePack ? {
            activePackId: mainState.queuePackId, onActivateQueue: controller.activateQueue,
            shuffle: mainState.shuffle, repeat: mainState.repeat, onShuffleChange: controller.setShuffle, onRepeatChange: controller.setRepeat,
            onPrevious: controller.playPreviousDub, onNext: controller.playNextDub,
            nowPlayingId: mainState.nowPlayingId, isPlaying: mainState.isPlaying,
            likedDubIds: state.likedDubIds, onPlay: controller.togglePlayback, onPlayAll: controller.playQueue, onDownload: downloadDub,
            onSeek: controller.seekPlayback, onSeekProgress: controller.seekPlaybackProgress, currentTimeSeconds: mainState.currentTime,
            durationSeconds: mainState.duration, volume: mainState.volume, onVolumeChange: setVolume,
            playbackError: mainState.playbackError, onOpenProfile: openProfile,
          } : undefined}
          layout={playerLayout}
          onOpenProfile={openProfile}
          playback={{
            playing: mainState.isPlaying,
            currentTimeSeconds: mainState.currentTime,
            durationSeconds: mainState.nowPlayingId === previewTrack?.id ? mainState.duration : undefined,
            volume: mainState.volume,
            shuffle: mainState.shuffle,
            repeat: mainState.repeat,
            playbackError: mainState.playbackError,
            onPlayChange: (playing) => {
              if (previewTrack && playing !== mainState.isPlaying) controller.togglePlayback(previewTrack);
            },
            onSeek: (time) => { if (previewTrack) controller.seekPlayback(time, previewTrack); },
            onSeekProgress: (progress) => { if (previewTrack) controller.seekPlaybackProgress(progress, previewTrack); },
            onVolumeChange: setVolume,
            onShuffleChange: controller.setShuffle,
            onRepeatChange: controller.setRepeat,
            onPrevious: controller.playPreviousDub,
            onNext: controller.playNextDub,
          }}
        />
  );
  return (
    <TutorialActivityContext.Provider value={tutorialActivity}>
    <TutorialNavigationContext.Provider value={tutorialNavigation ? { ...tutorialNavigation, ready: Boolean(tutorialStep) && activeSection === tutorialNavigation.destination } : null}>
    <Workspace key={state.member.id} childrenInPage className="vault-theme"
      restoreOnEntry restorationReady={workspace.ready && workspaceOwner === state.member.id}
      sidebarContent={playerLayout.desktop && activePack && previewTrack ? <div ref={setPlaylistContainer}
        className={`organism-card audio-player audio-player--playable audio-player--controller app-player-tracklist media-kind--${activePack.kind}${activePack.distribution === "alist" ? " audio-player--alist" : ""}`} /> : undefined}
      activityWindows={<ActivityWindows notifications={notifications} activeNotifications={activeNotifications}
        unreadCount={unreadNotificationCount} onRead={markNotificationsRead} onDismiss={dismissNotification} onClear={clearNotifications}
        onActivate={openNotification} uploadProgress={uploadProgress} uploadResults={uploadResults} onDismissUpload={dismissUploadResult} />}
      initialWorkspace={workspace.initial} onWorkspaceChange={workspace.ready && workspaceOwner === state.member.id ? workspace.onChange : undefined}
      playerTrackId={null}
      onActiveGroupChange={setActiveWindowGroup} tracklistControl={groupTracklistControl}
      onSuspendPlayback={pausePlayback}
      activeWindowId={windowStack.at(-1) && (state.packs.some((pack) => pack.id === windowStack.at(-1)) ? `pack:${windowStack.at(-1)}` : windowStack.at(-1))}
      dependencies={[
        ...(!isUploadOpen ? [
          { id: "action:upload", title: "Upload a dub or vocal", onOpen: () => openSingleUpload("dub") },
          { id: "action:create-pack", title: "Create a Dub / Sample / Vocal Pack", onOpen: () => openPackJourney() },
        ] : []),
        ...(!isProfileEditOpen ? [{ id: "action:edit-profile", title: "Edit your profile", onOpen: () => setIsProfileEditOpen(true) }] : []),
        ...(!isStartConversationOpen ? [{ id: "action:start-conversation", title: "Start a conversation", onOpen: () => setIsStartConversationOpen(true) }] : []),
        ...state.packs.map((pack) => ({ id: `pack:${pack.id}`, title: `Pack: ${pack.title}`, onOpen: () => openPackWindow(pack) })),
        ...state.dubs.map((dub) => ({ id: `track:${dub.id}`, title: `${dub.mediaKind === "vocal" ? "Vocal" : dub.mediaKind === "sample" ? "Sample" : "Dub"}: ${dub.title}`, onOpen: () => openDubWindow(dub) })),
        ...state.buddies.map((buddy) => ({ id: `conversation:${buddy.id}`, title: `Conversation: ${buddy.displayName}`, onOpen: () => openConversationWindow(buddy.id) })),
        ...[state.member, ...state.buddies, ...state.suggestedMembers].map((person) => ({
          id: `profile:${person.username}`, title: `Profile: ${person.displayName}`, onOpen: () => openProfile(person.username),
        })),
      ]}
      featureWindows={{ stack: windowStack, onActivate: raiseWindow, onRemove: dropWindow }}>
    <DashboardTemplate
      className={`community-dashboard-template vault-theme ${playerLayout.dashboardClassName}${activeSection === "messenger" ? " community-dashboard-template--messenger" : ""}`}
      scrollContent
      scrollResetKey={activeSection}
      contentOverlay={<Tutorials key={state.member.id} ownerId={state.member.id} isOpen={tutorialsOwner === state.member.id}
        onOpenChange={(open) => setTutorialsOwner(open ? state.member?.id ?? null : null)}
        onNavigateStep={navigateTutorialStep}
        onStepChange={setTutorialStep}
        onAction={(action) => {
          if (action === "workspace" && tutorialStep?.journey) {
            navigateTutorialStep({ ...tutorialStep, journey: { ...tutorialStep.journey, surface: "workspace" } });
            tutorialActivity.report({ type: "workspace-opened" });
            return;
          }
          if (action === "upload") { if (!isUploadOpen) openSingleUpload("dub", true); return; }
          if (action === "open-file") {
            const file = vaultDubs[0];
            if (file) openDubWindow(file);
            else { navigateTo("dubs"); notify("No accessible file is available yet. You can skip this step and return later.", "info"); }
            return;
          }
          const destination = sections.find((section) => section === (action === "alist" && !approved ? "alist-application" : action));
          if (destination) { navigateTo(destination); tutorialActivity.report({ type: "navigate", value: destination }); }
          else notify("This tutorial destination is not available.", "error");
        }} />}
      header={
        <div className="app-header-region">
        <AppHeader
          className="app-topbar"
          leading={<HistoryNavigation canGoBack={history.canGoBack} onBack={history.goBack} />}
          logoSrc={cre8LogoSrc}
          brandDescriptor="Dub Vault"
          createLabel="Upload"
          onCreate={() => openSingleUpload("dub", true)}
          onEditProfile={() => setIsProfileEditOpen(true)}
          onHelp={() => setTutorialsOwner(state.member?.id ?? null)}
          onLogout={() => {
            void workspace.flush().then(removeDevicePushSubscription).then(logout).catch((logoutError: unknown) => {
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
          brandDescriptor="Dub Vault"
          sections={interactiveNavigationSections}
          userDetail={state.member.role}
          userName={state.member.displayName}
          userAvatarUrl={state.member.avatarUrl}
          onUserProfile={() => { if (state.member) openProfile(state.member.username); }}
        />
      }
      footer={
        <footer className="app-sticky-footer" aria-label="Media and navigation">
        {appPlayer}
        <MobileNavigation activeItem={sectionLabels[activeSection]}
          primaryHrefs={["#dubs", "#samples", "#profile", "#messenger"]}
          sections={interactiveNavigationSections} />
        </footer>
      }
    >
      <div className={`app-content${activeSection === "messenger" ? " app-content--messenger" : ""}`}>
        {activeSection !== "messenger" && <DemoModeNotice />}
        {publishedDub && activeSection !== "my-dubs" && activeSection !== "my-samples" && activeSection !== "my-vocals" && activeSection !== "messenger" && (
          <section className="app-published-dub" aria-label="Published dub">
            <p><strong>{publishedDub.title}</strong> is published. Manage its details and access in Your {publishedDub.mediaKind === "vocal" ? "Vocals" : "Dubs"}.</p>
            <Button onClick={() => { navigateTo(publishedDub.mediaKind === "vocal" ? "my-vocals" : "my-dubs"); setPublishedDub(null); }} size="small">View in Your {publishedDub.mediaKind === "vocal" ? "Vocals" : "Dubs"}</Button>
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
              onDeletePack={handleDeletePack}
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
              onOpenDub={openDubWindow}
              onPlay={togglePlayback} onPlaySingle={toggleSinglePlayback}
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
        {(activeSection === "library" || activeSection === "full-library") && (
          <LibraryTemplate key={activeSection}
            downloads={state.library}
            tracks={activeSection === "full-library" ? accessibleTracks : undefined}
            onDownload={downloadDub}
            onPlay={toggleSinglePlayback}
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
            onOpenDub={openDubWindow}
            currentUsername={state.member.username}
            onEditDub={beginDubEdit}
            onDeleteDub={beginDubDelete}
            onShareWithFriend={beginSharingDub}
          />
        )}
        {(activeSection === "shared-with-me" || activeSection === "shared-samples" || activeSection === "shared-vocals") && (
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
            onPlay={togglePlayback} onPlaySingle={toggleSinglePlayback}
            onOpenProfile={openProfile}
            onOpenDub={openDubWindow}
            onShareWithFriend={beginSharingDub}
            onEdit={beginDubEdit}
            onDelete={beginDubDelete}
          />
        )}
        {(activeSection === "my-dubs" || isMySamples || isMyVocals || isAllUploads) && (
          <div className="owned-media">
          <section className="owned-media__create" aria-label={`Add to ${ownedMediaTitle}`}>
          <div className="owned-media__create-copy"><strong>{isAllUploads ? "My Uploads" : `Build ${ownedMediaTitle.toLowerCase()}`}</strong><p>{isAllUploads ? "Your files, packs and drafts. Add music by choosing a media type and a single file or pack." : isMySamples ? "Add samples with a licensed pack, or build a collection from samples and vocals." : "Upload a single file or bring a release together as a pack."}</p></div>
          <div className="owned-media__actions" role="group" aria-label={`${ownedMediaTitle} actions`}>
            <Button leadingIcon={<Upload />} onClick={() => {
              if (isAllUploads) { openSingleUpload("dub", true); return; }
              if (isMySamples) openPackJourney("sample");
              else openSingleUpload(isMyVocals ? "vocal" : "dub");
            }}>{isAllUploads ? "Start an upload" : `Add ${isMyVocals ? "Vocal" : isMySamples ? "Sample" : "Dub"}`}</Button>
            <Button variant="secondary" leadingIcon={<Folder />} onClick={() => openPackJourney(ownedMediaKind, null, null, isAllUploads)}>Add Pack</Button>
          </div>
          {isMySamples && <p className="owned-media__hint">Add Sample starts a Sample Pack. Publish with usage terms to classify and share its samples.</p>}
          </section>
          {isAllUploads && <DubSearchToolbar query={allUploadsQuery}>
            {(onSearch) => <DubSearch mediaKind={ownedMediaKind ?? "all"} showMediaKindFilter
              query={allUploadsQuery} onQueryChange={setAllUploadsQuery}
              filters={allUploadsFilters} onFiltersChange={setAllUploadsFilters} onSearch={onSearch}
              defaultDistributions={["worldwide", "private", "alist"]}
              distributionHint={ownedMediaTab === "packs" ? "Pack audience applies to the release. Sound and file details must match the same file within a pack. Drafts are included." : "All your audiences are included by default, including private uploads."}
              fileTypes={[...new Set(myDubs.map(trackFormat).filter(Boolean))].sort()}
              resultLabel={ownedMediaTab === "packs" ? "packs" : undefined}
              isSearching={ownedMediaTab === "packs" && allUploadsPacksLoading}
              resultCount={ownedMediaTab === "packs" ? allUploadsPackCount : ownedMedia.length} />}
          </DubSearchToolbar>}
          <div className="pack-tabs" role="group" aria-label={`${ownedMediaTitle} view`}>
            <Button variant={ownedMediaTab === "dubs" ? "primary" : "secondary"} aria-pressed={ownedMediaTab === "dubs"} onClick={() => { setOwnedMediaTab("dubs"); tutorialActivity.report({ type: "collection-view", value: "files" }); }}>{isAllUploads ? "Files" : isMyVocals ? "Vocals" : isMySamples ? "Samples" : "Dubs"}</Button>
            <Button variant={ownedMediaTab === "packs" ? "primary" : "secondary"} aria-pressed={ownedMediaTab === "packs"} onClick={() => { setOwnedMediaTab("packs"); tutorialActivity.report({ type: "collection-view", value: "packs" }); }}>Packs</Button>
          </div>
          {ownedMediaTab === "packs" ? <PackWorkspace hideCreateAction ownedOnly key={`${state.member.id}-${ownedMediaKind}`} username={state.member.username} approved={approved} mediaKind={ownedMediaKind}
            collectionSearch={isAllUploads ? { query: allUploadsQuery, filters: allUploadsFilters } : undefined}
            onCollectionCountChange={isAllUploads ? setAllUploadsPackCount : undefined}
            onCollectionLoadingChange={isAllUploads ? setAllUploadsPacksLoading : undefined}
            onClearCollectionSearch={isAllUploads ? clearAllUploadsFilters : undefined}
            {...packPlaybackControls}
            dubs={myDubs} artists={state.artists} buddies={state.buddies} playback={state} communityPacks={state.packs}
            onPlay={togglePlayback} onPlayAll={playPack} onSeek={seekPlaybackProgress} onVolume={setVolume}
            onDownloadDub={async (dub) => { await downloadDubFile(dub.id); await refreshCommunity(); }} onCommunityChange={async () => { await refreshCommunity(); }}
            onCreatePack={() => openPackJourney(ownedMediaKind)} onEditPack={beginPackEdit}
            onOpenPack={openPackWindow}
            onDeletePack={handleDeletePack}
            />
            : <MyDubsTemplate key={ownedMediaKind} mediaKind={isAllUploads ? "all" : ownedMediaKind} title={ownedMediaTitle}
            collectionSearch={isAllUploads ? { query: allUploadsQuery, filters: allUploadsFilters, onClear: clearAllUploadsFilters } : undefined}
            dubs={isAllUploads ? myDubs : ownedMedia}
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
            onPlay={toggleSinglePlayback}
            onEditDub={beginDubEdit}
            onDeleteDub={beginDubDelete}
            onRevokeGrant={revokeDubGrant}
            onOpenProfile={openProfile}
            onOpenDub={openDubWindow}
            onShareWithFriend={beginSharingDub}
            onAddToPack={(dub) => openPackJourney(dub.mediaKind ?? "dub", dub)}
          />
          }
          </div>
        )}
        {activeSection === "messenger" && renderMessenger(chatBuddyId)}
        {activeSection === "profile" && profile && renderProfile(profile)}
        {activeSection === "profile" && !profile && <p role="status">This profile is no longer available.</p>}
      </div>
      {workspace.ready && workspaceOwner === state.member.id && <PackWindows key={state.member.id} withinLayer
        audibleContextId={state.audibleContextId}
        windows={packWindows.map((entry) => ({ ...entry, pack: state.packs.find((current) => current.id === entry.pack.id) ?? entry.pack }))}
        stack={windowStack}
        contexts={state.packContexts} onActivateWindowQueue={activateWindowQueue}
        onWindowSettingsChange={setWindowSettings}
        username={state.member.username} authenticated buddies={state.buddies} playback={state}
        editor={{ dubs: state.dubs, artists: state.artists, approved }}
        {...packPlaybackControls} onPlay={windowControls.togglePlayback} onPlayAll={windowControls.playPack}
        onPrevious={windowControls.playPreviousDub} onNext={windowControls.playNextDub}
        onSeek={windowControls.seekPlaybackProgress} onVolume={setVolume}
        onDownloadDub={async (dub) => { await downloadDubFile(dub.id); await refreshCommunity(); }}
        onCommunityChange={async () => { await refreshCommunity(); }}
        onActivate={raiseWindow}
        onClose={(id) => { setPackWindows((current) => current.filter(({ pack }) => pack.id !== id)); dropWindow(id); }}
        onEdit={beginPackEdit}>
        {profileWindows.map(({ username, openRequest, groupWith }) => {
          const person = [state.member, ...state.buddies, ...state.suggestedMembers].find((member) => member?.username === username);
          const id = `profile:${username}`;
          return <FloatingWindow key={id} windowId={id} title={`Profile: ${person?.displayName ?? username}`} kind="profile"
            className="profile-window" openRequest={openRequest} groupWith={groupWith}
            active={windowStack.at(-1) === id} order={Math.max(0, windowStack.indexOf(id))} onActivate={() => raiseWindow(id)}
            onClose={() => { setProfileWindows((current) => current.filter((entry) => entry.username !== username)); dropWindow(id); }}>
            {person ? renderProfile(person) : <p role="alert">This profile is no longer available.</p>}
          </FloatingWindow>;
        })}
        {conversationWindows.map(({ buddyId, openRequest, groupWith }) => {
          const buddy = state.buddies.find((entry) => entry.id === buddyId);
          if (!buddy) return null;
          const id = `conversation:${buddyId}`;
          const messages = state.conversations.find((entry) => entry.buddyId === buddyId)?.messages ?? [];
          const track = messages.some((message) => !message.unsent && (message.dubId === state.nowPlayingId
            || Boolean(message.packId && message.packId === state.queuePackId))) ? state.dubs.find((dub) => dub.id === state.nowPlayingId) : null;
          return <FloatingWindow key={buddyId} windowId={id} title={`Chat: ${buddy.displayName}`} kind="conversation"
            openRequest={openRequest} groupWith={groupWith} active={windowStack[windowStack.length - 1] === id}
            order={Math.max(0, windowStack.indexOf(id))} onActivate={() => raiseWindow(id)}
            onClose={() => { setConversationWindows((current) => current.filter((entry) => entry.buddyId !== buddyId)); dropWindow(id); }}
            playback={track ? { isPlaying: state.isPlaying, onToggle: () => togglePlayback(track), trackTitle: track.title } : undefined}
            className="conversation-window">
            {renderMessenger(buddyId, true)}
          </FloatingWindow>;
        })}
        {trackWindows.map((entry) => {
          const dub = accessibleTracks.find((dub) => dub.id === entry.dubId);
          return dub && <TrackWindow key={dub.id} dub={dub} entry={entry} stack={windowStack} state={state}
            onActivate={raiseWindow} onClose={() => {
              setTrackWindows((current) => current.filter((item) => item.dubId !== dub.id)); dropWindow(`track:${dub.id}`);
            }} onActivateQueue={activateWindowQueue} onPlay={windowControls.togglePlayback} onSeek={windowControls.seekPlaybackProgress}
            onVolume={setVolume} onSettings={setWindowSettings} onDownload={downloadDub} />;
        })}
      </PackWindows>}
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
        openRequest={uploadOpenRequest}
        closeDisabled={Boolean(uploadProgress) || isUploadSubmitting || packJourneyBusy}
        onClose={() => {
          if (!uploadProgress && !isUploadSubmitting && !packJourneyBusy) {
            if ((packJourneyDirty || uploadFormDirty) && !window.confirm("Leave the editor? Unsaved edits and files not yet uploaded will be lost. Saved files remain in the pack.")) return;
            setIsUploadOpen(false);
            setShareDubTargetId(null);
            setUploadPackMounted(false); setPackJourneyDirty(false); setUploadFormDirty(false);
            setCreatePack(false); setPendingPackDub(null); setPendingEditPack(null);
          }
        }}
        title={uploadChooser ? "Upload" : uploadMode === "pack" ? packJourneyKind === "vocal" ? "Vocal Pack" : packJourneyKind === "sample" ? "Sample Pack" : "Dub Pack" : uploadMediaKind === "vocal" ? "Add Vocal" : "Add Dub"}
      >
        {isUploadOpen && <>
        {uploadChooser && <fieldset className="upload-choices" disabled={Boolean(uploadProgress) || isUploadSubmitting || packJourneyBusy}>
          <legend>What are you uploading?</legend>
          <label>Media type<select value={uploadChoiceKind} onChange={(event) => {
            const kind = event.currentTarget.value;
            if (kind !== "dub" && kind !== "sample" && kind !== "vocal") return;
            const changed = uploadMode === "pack" || kind === "sample" ? openPackJourney(kind, null, null, true) : openSingleUpload(kind, true);
            if (changed) tutorialActivity.report({ type: "upload-chosen" });
          }}><option value="dub">Dub</option><option value="sample">Sample</option><option value="vocal">Vocal</option></select></label>
          <label>Release format<select value={uploadMode} onChange={(event) => {
            const changed = event.currentTarget.value === "pack" ? openPackJourney(uploadChoiceKind, null, null, true)
              : uploadChoiceKind !== "sample" && openSingleUpload(uploadChoiceKind, true);
            if (changed) tutorialActivity.report({ type: "upload-chosen" });
          }}><option value="dub" disabled={uploadChoiceKind === "sample"}>Single file</option><option value="pack">Pack</option></select></label>
          {uploadChoiceKind === "sample" && <p>Samples are uploaded through a Sample Pack with usage terms. Packs may also include vocals.</p>}
        </fieldset>}
        {uploadMode === "dub" && <div onChangeCapture={() => setUploadFormDirty(true)} onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest("button[aria-pressed]")) setUploadFormDirty(true);
        }}><ModalFooterOutlet><DubUploadForm
          key={uploadMediaKind} initialMediaKind={uploadMediaKind} lockMediaKind
          artists={state.artists}
          aListApproved={state.member.aListApproved}
          buddies={state.buddies}
          aListMembers={aListMembers}
          initialBuddyIds={shareDubTargetId ? [shareDubTargetId] : []}
          onSubmit={handleShareDub}
          submissionError={uploadError}
          uploadProgress={uploadProgress}
          onCancel={() => {
            if (uploadFormDirty && !window.confirm("Discard this upload? Unsaved details and selected files will be lost.")) return;
            setIsUploadOpen(false);
            setUploadFormDirty(false);
            setShareDubTargetId(null);
          }}
        /></ModalFooterOutlet></div>}
        <div hidden={uploadMode !== "pack"}>
          {uploadPackMounted ? <PackWorkspace key={packJourneyRequest} username={state.member.username}
            approved={approved} mediaKind={packJourneyKind} {...packPlaybackControls}
            dubs={myDubs} artists={state.artists} buddies={state.buddies} playback={state} communityPacks={state.packs}
            onPlay={togglePlayback} onPlayAll={playPack} onSeek={seekPlaybackProgress} onVolume={setVolume}
            onDownloadDub={async (dub) => { await downloadDubFile(dub.id); await refreshCommunity(); }}
            onCommunityChange={async () => { await refreshCommunity(); }} create={createPack} pendingDub={pendingPackDub} editPack={pendingEditPack}
            onOpenPack={openPackWindow} onDeletePack={handleDeletePack} onBusyChange={setPackJourneyBusy} onDirtyChange={setPackJourneyDirty}
            onOpened={() => { setCreatePack(false); setPendingPackDub(null); setPendingEditPack(null); }} /> : null}
        </div></>}
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
    </Workspace>
    </TutorialNavigationContext.Provider>
    </TutorialActivityContext.Provider>
  );
}
