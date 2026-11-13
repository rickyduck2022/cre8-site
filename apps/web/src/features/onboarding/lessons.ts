import type { TutorialActivityType, TutorialLesson, TutorialStep } from "@craft/ui";

const interactible = ':is(button, input:not([type="hidden"]), select, textarea, a[href], summary, [role="slider"], [role="tab"])';
const controls = (scope: string) => `${scope} ${interactible}`;
const navigationTo = (destination: string) => [
  `.navigation .navigation__item[href="#${destination}"]`,
  `.navigation__section:has(a[href="#${destination}"]) > .navigation__section-toggle[aria-expanded="false"]`,
  `.mobile-navigation a[href="#${destination}"]`,
];
const more = ".mobile-navigation > button:last-child";
const vaults = ["dubs", "samples", "vocals"];
const collection = [controls(".vault-view-switch"), controls('[aria-label="My Uploads view"]')];
const filesTab = ['.vault-view-switch [role="tab"][id$="-files"]', '.owned-media .pack-tabs > button:first-child', '[aria-label="My Uploads view"] > button:first-child'];
const packsTab = ['.vault-view-switch [role="tab"][id$="-packs"]', '.owned-media .pack-tabs > button:last-child', '[aria-label="My Uploads view"] > button:last-child'];
const search = [controls(".dub-search__query"), '.dub-search-toolbar [aria-label^="Search and filters"]'];
const filters = [...search.map((selector) => `${selector}:not(body:has(.dub-search__dialog[open]) *)`),
  ".dub-search__toggle", controls(".dub-search__panel"), controls(".dub-search__dialog[open] .modal__footer")];
const playback = [controls(".dub-card .transport-controls"), controls(".audio-player .transport-controls"), controls(".audio-player__timeline"), controls(".audio-player__volume"),
  ".app-player-edge-handle button", '.pack-playlist button[aria-label^="Play"]'];
const play = ['.dub-card .transport-controls__play', '.app-player .transport-controls__play', '.pack-playlist button[aria-label^="Play"]', ".app-player-edge-handle button"];
const pause = ['.transport-controls__play[aria-label="Pause"]', ".app-player-edge-handle button"];
const openWindow = ['.dashboard-template__content button:is([aria-label^="Open dub:"], [aria-label^="Open sample:"], [aria-label^="Open vocal:"], [aria-label^="Open pack"])'];
const minimizeWindow = ['.floating-window__header button[aria-label^="Minimize "]:not([aria-label*="all windows"])', 'button[aria-label="Show windows"]'];
const restoreWindow = ['button[aria-label^="Restore "]:not([aria-label^="Restore size"])', 'button[aria-label="Show window manager"]', 'button[aria-label="Show windows"]'];
const workspaceEntry = ['button[aria-label="Workspaces"]'];
const workspaceSave = [
  ...workspaceEntry, 'button[aria-label="Show window manager"]',
  controls('form[aria-label="Create workspace"]'), controls('form[aria-label="Save workspace"]'),
  '[aria-label="Workspace Explorer"] .workspace-explorer-intro > button:first-of-type',
  '.workspace-runtime__actions > button:first-child',
];
const upload = [controls(".upload-choices"), '.app-header__actions [aria-label="Upload"]'];
const packEditor = ['.owned-media__actions > button:last-child',
  '.pack-editor :is(input, select, textarea, .pack-steps button, .pack-editor__footer button):not([aria-label^="Remove"])',
  '.pack-editor > button:not([aria-label^="Remove"])', '.pack-editor .pack-item-editor button'];
const fileForm = ['.dub-upload-form :is(input, select, textarea, button[type="submit"], button[aria-pressed])',
  '.feature-window:has(.dub-upload-form) .modal__footer button[type="submit"]',
  '.dub-upload-form .friend-picker button'];
const audience = ['.dub-search__distributions input', '.dub-search__toggle', '.dub-search-toolbar [aria-label^="Search and filters"]'];
const filterDecision = ['.dub-search__actions button:first-child', '.dub-search__actions button[type="submit"]', '.dub-search__toggle'];
const shareDialog = ['.share-dub-dialog .friend-picker :is(input, button)', '.share-dub-dialog textarea',
  '.modal:has(.share-dub-dialog) button[type="submit"]', '.feature-window:has(.share-dub-dialog) button[type="submit"]',
  '.pack-share .friend-picker :is(input, button)', '.pack-share .share-pack__confirmation input', '.pack-share .modal__footer button:last-child'];
const share = [
  'body:not(:has(.share-dub-dialog, .pack-share)) .dashboard-template__content button[aria-label^="Share"]',
  ...shareDialog,
];
const friends = ['.buddy-list-template button[aria-label^="Add "]', '.friend-lookup input'];
const messages = ['.messenger__conversations .conversation-link', '.chat-compose :is(input, button)',
  '.messenger__sidebar button[aria-label="Start a conversation"]', controls(".start-conversation-list")];

const mediaJourneys: TutorialStep[] = ([
  { label: "Dubs", vault: "dubs", owned: "my-dubs", shared: "shared-with-me", icon: "music", detail: "Dubs are full tracks and versions." },
  { label: "Samples", vault: "samples", owned: "my-samples", shared: "shared-samples", icon: "samples", detail: "Samples are production sounds and loops. Published Sample Packs classify their files as samples; draft membership alone does not." },
  { label: "Vocals", vault: "vocals", owned: "my-vocals", shared: "shared-vocals", icon: "vocals", detail: "Vocals are voices, hooks and acapellas. Vocal Packs contain vocals only; Sample Packs can also include vocals." },
] as const).flatMap((domain): TutorialStep[] => {
  const group = { id: domain.vault, label: domain.label, description: "Same pattern, separate music: Vault → Your uploads → Shared with you. Skip this journey if familiar; skipped actions stay incomplete." };
  const visit = (destination: string, label: string) => ({
    label: `Visit ${label}`, events: [{ type: "navigate" as const, value: destination }],
    focusTargets: [...navigationTo(destination), more], focusStrategy: "single" as const,
  });
  const tabs = [
    { label: `Select ${domain.label}`, events: [{ type: "collection-view" as const, value: "files" }], focusTargets: filesTab },
    { label: "Select Packs", events: [{ type: "collection-view" as const, value: "packs" }], focusTargets: packsTab },
  ];
  return [
    {
      title: `${domain.label}: explore the vault`, group, focusStrategy: "single",
      journey: { destination: domain.vault, surface: "browse" },
      focusTargets: [...navigationTo(domain.vault), more],
      requirements: [visit(domain.vault, `${domain.label} Vault`), ...tabs],
      visual: [{ icon: domain.icon, label: `${domain.label} Vault` }, { icon: "music", label: domain.label }, { icon: "folder", label: "Packs" }],
      description: `${domain.detail} The vault is for discovery. Compare individual files with packs and their own tracklists. Opening is different from playing.`,
      task: `Visit the ${domain.label} Vault, then select ${domain.label} and Packs. Empty collections are fine; nothing is uploaded or played.`,
      action: { label: `Explore ${domain.label}`, id: domain.vault },
    },
    {
      title: `${domain.label}: your uploads`, group, focusStrategy: "single",
      journey: { destination: domain.owned, surface: "browse" },
      focusTargets: [...navigationTo(domain.owned), more],
      requirements: [visit(domain.owned, `Your ${domain.label}`), ...tabs],
      visual: [{ icon: domain.icon, label: `Your ${domain.label}` }, { icon: "upload", label: "You own" }, { icon: "folder", label: "Drafts & packs" }],
      description: `Your ${domain.label} manages the ${domain.label.toLowerCase()} you own, including private uploads and drafts. It is separate from the discovery vault and received shares. My Uploads brings all three domains together; My Library is your download history.`,
      task: `Open Your ${domain.label}, then select ${domain.label} and Packs. Inspect only; no upload, publish or delete action is required.`,
      action: { label: `Open Your ${domain.label}`, id: domain.owned },
    },
    {
      title: `${domain.label}: shared with you`, group, focusStrategy: "single",
      journey: { destination: domain.shared, surface: "browse" },
      focusTargets: [...navigationTo(domain.shared), more],
      requirements: [visit(domain.shared, `${domain.label} shared with you`)],
      visual: [{ icon: domain.icon, label: domain.label }, { icon: "message", label: "Received" }, { icon: "access", label: "Access" }],
      description: `${domain.label} shared with you brings received files and packs together, while access remains valid. It is not your upload collection. Sharing a link alone does not grant private access. All three domains repeat this pattern with different content, not duplicate music.`,
      task: `Visit ${domain.label} shared with you. An empty received collection is normal. No message or access grant is required.`,
      action: { label: `Open shared ${domain.label}`, id: domain.shared },
    },
  ];
});

const lessons: TutorialLesson[] = [
  {
    id: "media", title: "Meet your music", summary: "Three distinct domains, one familiar pattern: vault, your uploads and received shares. Skip a domain once you understand it.",
    steps: mediaJourneys,
  },
  {
    id: "browse", title: "Find and play", summary: "Search, apply filters, and understand playback queues.",
    steps: [
      {
        title: "Search a collection",
        visual: [{ icon: "search", label: "Search" }, { icon: "music", label: "Matches" }, { icon: "restore", label: "Clear" }],
        requirements: [
          { label: "Enter a search", events: [{ type: "search" }], focusTargets: ['.dub-search__query input', '.dub-search-toolbar [aria-label^="Search and filters"]'], focusStrategy: "single" },
          { label: "Clear your search", events: [{ type: "search-cleared" }], focusTargets: ['.dub-search__query button[aria-label="Clear search text"]'], focusStrategy: "single" },
        ],
        journey: { destination: "dubs", destinations: vaults, surface: "search" },
        focusTargets: search,
        description: "Search narrows the current collection. Each vault keeps its own filters. My Uploads and Full Library also filter by media type.",
        mobileDescription: "Tap Search and filters beside the collection tabs. My Uploads and Full Library also filter by media type.",
        task: "Enter a title, artist or tag in the collection search. Clear it again to see everything.",
      },
      {
        title: "Choose filters, then apply",
        visual: [{ icon: "search", label: "Choose" }, { icon: "done", label: "Apply" }, { icon: "music", label: "Results" }],
        requirements: [{ label: "Apply or cancel the filter choices", events: [{ type: "filters-applied" }, { type: "filters-cancelled" }] }],
        journey: { destination: "dubs", destinations: vaults, surface: "filters" },
        focusTargets: filters,
        description: "Filters take over the collection area without letting results scroll behind. Choose tags, genres, formats, audience or metadata ranges, then Apply. Cancel keeps your earlier choices and scroll position.",
        mobileDescription: "Tap Filters for a full-height sheet. Choose your criteria, then Apply to see matching results from the top. Cancel keeps your earlier choices and scroll position.",
        task: "Open Filters, inspect the choices and Apply or Cancel. Clear filters if you want to restore the full collection.",
      },
      {
        title: "Play without losing your place",
        focusStrategy: "single",
        visual: [{ icon: "music", label: "File" }, { icon: "play", label: "Play" }, { icon: "minimize", label: "Pause" }],
        requirements: [
          { label: "Play an accessible file", events: [{ type: "playback-started" }], focusTargets: play },
          { label: "Pause the same file", events: [{ type: "playback-paused" }], sameSubjectAsPrevious: true, focusTargets: pause },
        ],
        journey: { destination: "dubs", destinations: vaults, surface: "playback" },
        focusTargets: playback,
        description: "Play starts audio; Open shows a file or pack window. Pack playback stays inside that pack when you use previous, next, shuffle or repeat. The global player keeps playback available while you browse.",
        task: "Try Play on a file you can access, then pause it. Adjust the player controls yourself; this guide will not start audio.",
      },
      {
        title: "Understand shared previews",
        visual: [{ icon: "message", label: "Link" }, { icon: "play", label: "Preview" }, { icon: "access", label: "Access" }],
        journey: { destination: "dubs", destinations: vaults, surface: "browse" },
        focusTargets: playback,
        description: "Signed-out shared links provide a duration-capped, 16 kHz mono preview rather than the original-quality stream. Signing in restores original playback only when the account has access; it does not bypass private or A-List permissions.",
        task: "Look for preview and access labels when someone shares a link. You can continue without leaving the app.",
      },
    ],
  },
  {
    id: "workspace", title: "Make a workspace", summary: "Open windows, keep drafts, and return to a saved setup.",
    steps: [
      {
        title: "Open is different from Play",
        focusStrategy: "single",
        visual: [{ icon: "music", label: "File" }, { icon: "folder", label: "Open" }, { icon: "restore", label: "Window" }],
        requirements: [{ label: "Open a file or pack window", events: [{ type: "window-opened" }] }],
        journey: { destination: "dubs", destinations: vaults, surface: "playback" },
        focusTargets: openWindow,
        description: "Opening a file or pack gives it a window without starting playback. Opening the same window again restores it if minimized and brings it into focus. Your other windows are not discarded.",
        mobileDescription: "Open shows a file or pack as a fullscreen sheet. Opening it again restores and focuses that sheet. The mobile window manager starts minimized so browsing stays clear.",
        task: "Open an available file. If your vault is empty, skip this step and return when you have music.",
        action: { label: "Open an available file", id: "open-file" },
      },
      {
        title: "Minimized is not closed",
        focusStrategy: "single",
        visual: [{ icon: "restore", label: "Window" }, { icon: "minimize", label: "Minimize" }, { icon: "restore", label: "Restore" }],
        requirements: [
          { label: "Minimize a window", events: [{ type: "window-minimized" }], focusTargets: minimizeWindow },
          { label: "Restore the same window", events: [{ type: "window-restored" }], sameSubjectAsPrevious: true, focusTargets: restoreWindow },
        ],
        journey: { destination: "dubs", destinations: vaults, surface: "browse" },
        focusTargets: minimizeWindow,
        description: "Minimize keeps the window and its state in the minimized dock. Close removes that window. Clicking outside the window system can hide windows without minimizing them; Open or Show windows reveals them again.",
        mobileDescription: "Minimize keeps a sheet's state so you can return from the minimized controls. Close removes it. To switch windows, use the window manager or Open the same file or pack again.",
        task: "Minimize a window, then Open it again. It should restore and focus on the first request.",
      },
      {
        title: "A draft is a working setup",
        focusStrategy: "single",
        visual: [{ icon: "restore", label: "Windows" }, { icon: "folder", label: "Explorer" }, { icon: "music", label: "Same music" }],
        requirements: [{ label: "Use Workspaces to open Explorer", events: [{ type: "workspace-opened" }] }],
        journey: { destination: "dubs", destinations: vaults, surface: "browse" },
        focusTargets: workspaceEntry,
        action: { label: "Open Workspace Explorer", id: "workspace" },
        description: "Workspaces remember window membership and arrangement, not a second copy of your music. If none is loaded, opening a window starts a Draft. Use Workspaces to inspect the Explorer and save a setup when you want to return.",
        mobileDescription: "Tap Workspaces to open Explorer. Your window manager stays minimized until you expand it yourself. A Draft is your working set of windows; saving names that setup, not a second copy of your music.",
        task: "Open Workspaces using its own button and inspect the controls. You do not need to save or discard anything.",
      },
      {
        title: "Come back safely",
        visual: [{ icon: "folder", label: "Draft" }, { icon: "done", label: "Name & save" }, { icon: "restore", label: "Return" }],
        requirements: [{ label: "Save a named workspace", events: [{ type: "workspace-saved" }] }],
        journey: { destination: "dubs", destinations: vaults, surface: "workspace" },
        focusTargets: workspaceSave,
        description: "On entry you can load the previous workspace or start an empty Draft. Save Workspace updates the saved setup. Discard prompts appear for unsaved layout changes; editors may separately ask about their unsaved content.",
        task: "Use Save Workspace to name and save your current setup, or enable Explorer and create a named workspace. Wait for it to save. Do not close or discard work.",
      },
    ],
  },
  {
    id: "upload", title: "Upload and organise", summary: "Choose the right media, create packs, and manage drafts.",
    steps: [
      {
        title: "Choose what you are adding",
        focusStrategy: "single",
        visual: [{ icon: "upload", label: "Upload" }, { icon: "music", label: "Media type" }, { icon: "folder", label: "File or pack" }],
        requirements: [{ label: "Choose a media type or release format", events: [{ type: "upload-chosen" }] }],
        journey: { destination: "all-uploads", surface: "upload" },
        focusTargets: upload,
        description: "The global Upload action asks for a media type and a single file or pack. Your Dubs, Samples and Vocals pages offer contextual Add actions. Production samples are organised through Sample Packs.",
        task: "Choose a media type or release format in the Upload chooser. Selecting a choice does not upload anything.",
        action: { label: "Open Upload chooser", id: "upload" },
      },
      {
        title: "Prepare a file",
        visual: [{ icon: "music", label: "Audio" }, { icon: "access", label: "Audience" }, { icon: "upload", label: "Upload" }],
        requirements: [{ label: "Successfully upload a file", events: [{ type: "file-uploaded" }] }],
        journey: { destination: "all-uploads", surface: "upload" },
        focusTargets: [...fileForm, ...packEditor, ...upload],
        description: "Give your upload a useful title and accurate tags, genre and other available metadata. Choose its audience deliberately. Uploading and publishing are real actions; nothing in this lesson submits the form for you.",
        task: "Choose your audio file, complete its details and submit the upload. For a pack, add and upload a track. Only upload material you intend to keep; Skip leaves this step incomplete.",
      },
      {
        title: "Build a pack",
        visual: [{ icon: "folder", label: "Add Pack" }, { icon: "music", label: "Details" }, { icon: "done", label: "Save draft" }],
        requirements: [{ label: "Save a pack draft or publish a pack", events: [{ type: "pack-saved" }] }],
        journey: { destination: "my-samples", surface: "browse" },
        focusTargets: [...packEditor, ".feature-window:has(.upload-choices) .floating-window__close"],
        description: "Choose a Dub, Sample or Vocal Pack. Sample Packs can contain samples and vocals; Vocal Packs cannot contain samples. Pack membership and distribution must be compatible. Draft membership alone does not publish or reclassify a file as a sample.",
        task: "Use Add Pack, give the pack useful details and Save draft. Publishing also counts, but is not required.",
        action: { label: "Go to Your Samples", id: "my-samples" },
      },
      {
        title: "Manage what you own",
        visual: [{ icon: "upload", label: "My Uploads" }, { icon: "music", label: "Files" }, { icon: "folder", label: "Packs" }],
        requirements: [
          { label: "Select Files", events: [{ type: "collection-view", value: "files" }], focusTargets: filesTab },
          { label: "Select Packs", events: [{ type: "collection-view", value: "packs" }], focusTargets: packsTab },
        ],
        journey: { destination: "all-uploads", surface: "browse" },
        focusTargets: collection,
        description: "My Uploads includes your files, packs and drafts. Files and Packs share search and filters. Pack file-detail filters must match the same member file.",
        task: "Select Files, then Packs. Check titles, audience and draft state before you publish or share.",
        action: { label: "Review My Uploads", id: "all-uploads" },
      },
    ],
  },
  {
    id: "sharing", title: "Share with the right people", summary: "Understand audience, private access and A-List.",
    steps: [
      {
        title: "Media type is not permission",
        visual: [{ icon: "music", label: "Content" }, { icon: "access", label: "Audience" }, { icon: "search", label: "Filter" }],
        requirements: [
          { label: "Change an audience filter", events: [{ type: "audience-changed" }], focusTargets: audience },
          { label: "Apply or cancel your filter choices", events: [{ type: "filters-applied" }, { type: "filters-cancelled" }], focusTargets: filterDecision },
        ],
        journey: { destination: "all-uploads", surface: "filters" },
        focusTargets: filters,
        description: "Dub, Sample and Vocal describe the content. Worldwide, Private and A-List describe its audience. Putting a file in a pack or finding its link does not automatically grant someone access.",
        task: "Toggle an audience filter, then Apply or Cancel. These filters change what you see, not anyone's access to your music.",
        action: { label: "Review your uploads", id: "all-uploads" },
      },
      {
        title: "Share deliberately",
        focusStrategy: "single",
        visual: [{ icon: "music", label: "Choose" }, { icon: "access", label: "Recipient" }, { icon: "message", label: "Send" }],
        requirements: [{ label: "Successfully share a file or pack with a recipient", events: [{ type: "media-shared" }] }],
        journey: { destination: "all-uploads", surface: "browse" },
        focusTargets: share,
        description: "Use the available Share controls for a file or pack you are allowed to share. Private sharing is controlled by its uploader. Check recipients and permissions before confirming; a copied link is not a private access grant.",
        task: "Choose a file or pack you may share, review a recipient and send it. This is a real share; Skip instead if you do not want to grant access or send anything.",
      },
      {
        title: "A-List has its own access rules",
        focusStrategy: "single",
        visual: [{ icon: "access", label: "A-List" }, { icon: "done", label: "Approval" }, { icon: "music", label: "Access" }],
        requirements: [{ label: "Visit A-List or its application page", events: [{ type: "navigate", value: "alist" }, { type: "navigate", value: "alist-application" }] }],
        journey: { destination: "alist", surface: "browse" },
        focusTargets: [...navigationTo("alist"), ...navigationTo("alist-application"), more,
          '.feature-window:has(.share-dub-dialog__success) .modal__footer button', '.pack-share:has([role="status"]) .modal__footer button:first-child'],
        description: "A-List access is approved separately. Some releases are visible to approved members; others need a specific grant. A tutorial, friendship or public preview never bypasses those rules.",
        task: "Open A-List to see your current access or application options. You do not need to apply during this lesson.",
        action: { label: "Explore A-List", id: "alist" },
      },
    ],
  },
  {
    id: "community", title: "Keep and connect", summary: "Use your Library, friends and Messenger.",
    steps: [
      {
        title: "Return to your downloads",
        focusStrategy: "single",
        visual: [{ icon: "download", label: "Downloads" }, { icon: "folder", label: "My Library" }, { icon: "restore", label: "Return" }],
        requirements: [{ label: "Visit My Library", events: [{ type: "navigate", value: "library" }] }],
        journey: { destination: "library", surface: "browse" },
        focusTargets: [...navigationTo("library"), more],
        description: "My Library is your download history. Full Library shows every accessible track, including uploads and shared music. My Uploads manages music you own.",
        task: "Open My Library and inspect the available downloads. An empty history is normal for a new account.",
        action: { label: "Open My Library", id: "library" },
      },
      {
        title: "Find your community",
        focusStrategy: "single",
        visual: [{ icon: "search", label: "Find artist" }, { icon: "done", label: "Add friend" }, { icon: "message", label: "Connect" }],
        requirements: [{ label: "Add a friend", events: [{ type: "friend-added" }] }],
        journey: { destination: "buddies", surface: "browse" },
        focusTargets: friends,
        description: "Friends and member profiles help you reconnect with artists. A friendship is not the same as a private media grant or A-List approval.",
        task: "Find an artist and add them to your Friend List. This is a real change; Skip if you do not want to add anyone.",
        action: { label: "Open Friend List", id: "buddies" },
      },
      {
        title: "Message when you are ready",
        visual: [{ icon: "message", label: "Recipient" }, { icon: "music", label: "Write" }, { icon: "done", label: "Send" }],
        requirements: [{ label: "Successfully send a message", events: [{ type: "message-sent" }] }],
        journey: { destination: "messenger", surface: "browse" },
        focusTargets: messages,
        description: "Messenger holds your conversations and shared music. Open a conversation to read it; attaching a file or pack and sending a message are deliberate actions. This guide never sends anything.",
        task: "Choose a recipient, write and review your message, then Send. This sends a real message; Skip if you do not want to contact anyone.",
        action: { label: "Open Messenger", id: "messenger" },
      },
    ],
  },
];

const collectionResults = [
  ".dashboard-template__content .latest-dubs-template__results",
  ".dashboard-template__content .dub-card-list",
  ".dashboard-template__content .my-dubs-template__list",
  ".dashboard-template__content .pack-grid",
  ".dashboard-template__content .empty-state",
  ".dashboard-template__content .pack-empty",
];
const actionResults: Partial<Record<TutorialActivityType, string[]>> = {
  navigate: collectionResults,
  "collection-view": collectionResults,
  search: collectionResults,
  "search-cleared": collectionResults,
  "filters-applied": collectionResults,
  "filters-cancelled": collectionResults,
  "audience-changed": [".dub-search__distributions"],
  "playback-started": [".audio-player.app-player", ".app-player-edge-handle"],
  "playback-paused": [".audio-player.app-player", ".app-player-edge-handle"],
  "window-opened": [".floating-window--active .floating-window__content"],
  "window-minimized": [".window-layer__minimized-group"],
  "window-restored": [".floating-window--active .floating-window__content"],
  "workspace-opened": [".workspace-explorer__body"],
  "workspace-saved": [".workspace-explorer__workspaces", ".workspace-runtime__actions"],
  "upload-chosen": [".dub-upload-form", ".pack-editor"],
  "file-uploaded": [".dub-upload-form [role='status']", ...collectionResults],
  "pack-saved": [".pack-editor [role='status']", ...collectionResults],
  "media-shared": [".share-dub-dialog__success", ".pack-share [role='status']"],
  "friend-added": [".buddy-list"],
  "message-sent": [".chat-messages"],
};
export const onboardingLessons: TutorialLesson[] = lessons.map((lesson) => ({
  ...lesson,
  steps: lesson.steps.map((step) => ({
    ...step,
    requirements: step.requirements?.map((requirement) => ({
      ...requirement,
      resultTargets: Array.from(new Set(requirement.events.flatMap((event) =>
        event.type === "navigate" && event.value === "alist-application"
          ? [".alist-application__intro", ".alist-application__status"]
          : actionResults[event.type] ?? []))),
    })),
  })),
}));
