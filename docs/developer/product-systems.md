# Product systems and invariants

[Handbook](README.md) / Product systems

This is the feature-to-code map, not a second copy of every product contract.
See [packs and workspaces](../packs.md) for detailed user journeys and limits.

## Identity, profiles and A-List

Authentication/profile operations and member lookup are implemented in the
[API server](../../apps/api/src/server.mjs), exposed through
[`useCommunity`](../../apps/web/src/hooks/useCommunity.ts) and composed in
[App](../../apps/web/src/app/App.tsx). Registration/profile UI uses shared
[organisms](../../packages/ui/src/organisms) and
[ProfileTemplate](../../packages/ui/src/templates/ProfileTemplate/ProfileTemplate.tsx).

Sessions use the API cookie; profile role text is not an authorization grant.
Friend search and public/profile media are access-filtered server-side.
A-List applications use the app
[submission form](../../apps/web/src/components/AListApplication.tsx), with
decisions in the [admin console](../../apps/admin/README.md).
An approval-gated feed and externally shareable public A-List releases are
different policies. Do not infer access from orange styling.

## Discovery, owned media and received shares

The three media domains are `dub`, `sample` and `vocal`, declared in
[domain types](../../packages/ui/src/types/domain.ts). Collection composition
uses [LatestDubsTemplate](../../packages/ui/src/templates/LatestDubsTemplate/LatestDubsTemplate.tsx),
[MyDubsTemplate](../../packages/ui/src/templates/MyDubsTemplate/MyDubsTemplate.tsx),
[SharedWithMeTemplate](../../packages/ui/src/templates/SharedWithMeTemplate/SharedWithMeTemplate.tsx)
and [shared filters](../../packages/ui/src/utils/collectionFilters.ts).

- Published Sample Pack membership classifies a file as a sample; draft
  membership alone does not.
- Explicit Vocal upload or published Vocal Pack membership classifies a vocal
  before considering Sample Pack membership. Classification and grants are
  independent; no duplicate underlying media is created.
- Dub Packs accept dubs; Sample Packs accept samples/vocals; Vocal Packs accept
  vocals. API and pickers enforce compatibility and audience rules.
- My Uploads contains only owned files/packs, including drafts. Full Library
  contains currently authorized tracks, not fictitious download history.
- Received collections depend on actual received shares/current grants, not
  merely public discovery. Pack member files are not repeated as standalone
  cards when their received pack is displayed.
- Search/filter combinations for a pack's file metadata must match a single
  member file, not satisfy each criterion using a different file.

Changes must reach navigation/counts, profile media, search, shared links,
Messenger attachments, player queues and owned/received surfaces together.

## Uploads, packs and downloads

Entry points:
[PackWorkspace](../../apps/web/src/components/PackWorkspace.tsx),
[PackEditor](../../apps/web/src/components/PackEditor.tsx),
[PackView](../../apps/web/src/components/PackView.tsx),
[pack service](../../apps/web/src/services/packs.ts),
[upload helper](../../apps/web/src/services/uploadFile.ts) and
[DubUploadForm](../../packages/ui/src/molecules/DubUploadForm/DubUploadForm.tsx).

Pack Details -> Add files -> Review is shared between creation and editing.
Next validates and uploads pending files; retries target failures, not successful
files. Never silently omit pending/failed files at publication. Sample/Vocal
publication requires uploader-supplied licence text, included in the ZIP.

An owned pack can edit/upload inside its stable window. Busy load/upload/save and
dirty editor close guards are not bypassed by workspace navigation/deletion.
Uploaded files are separately persisted; cancelling the form is not a transaction
that rolls back every successful upload. Pack deletion/removal retains the file.
Changing shared file metadata affects the same file everywhere.

Downloads are authorized requests, not proof of completed transfers.
[`DubPackStatistics`](../../packages/ui/src/organisms/DubPackCard/DubPackStatistics.tsx)
separates whole-pack ZIP requests from total member-file requests. File counts
include ZIP downloads and activity outside that pack; ZIP tracking starts with
the update and missing counts show Unavailable.

## Audio and player contexts

[`useAudioPlayback`](../../apps/web/src/hooks/useAudioPlayback.ts) is the single
audio-engine owner. Main, pack, standalone-track and minimized controls must use
that engine rather than instantiate competing playback.

Each window context retains queue, progress, shuffle/repeat and history.
Selecting which context the main player displays is distinct from changing which
queue is audible. Window settings can select a context without interrupting
another audible context. Explicit play/seek/queue actions choose the correct
window context.

Pack playback uses exact ordered membership and pack queue identity. Shuffle
visits members, Previous retraces history, repeat loops the pack, and transport
must not escape to another pack sharing a track. Opening/focusing a window alone
must not start playback. Revoked or removed tracks cannot remain playable because
they were once present in a snapshot.

## Workspaces, windows and feature dialogs

Core modules:
[Workspace](../../packages/ui/src/workspaces/Workspace/Workspace.tsx),
[Window](../../packages/ui/src/organisms/Window/Window.tsx),
[workspace types/helpers](../../packages/ui/src/organisms/Window/workspace.ts),
[app persistence adapter](../../apps/web/src/hooks/useWindowWorkspace.ts) and
[API parser](../../apps/api/src/windowWorkspace.mjs).

- Workspaces are flat peers: Draft plus named workspaces. Opening activates the
  complete workspace; Manage separately edits its catalog.
- Startup recovery does not auto-play or reveal saved windows before the
  resume/start-empty choice in Explorer mode. Simple mode uses Draft.
- A dependency has one owner. Transfers retain whole-group membership/drafts;
  legacy nested workspace shells are migration data, not current UI.
- Automatic recovery snapshots and last explicit Save checkpoints differ.
  Discard restores checkpoint layout/membership, not published media edits.
- Outside interaction temporarily hides windows. Minimize retains membership;
  close does not necessarily remove catalog membership; switching workspace
  suspends the previous runtime and pauses its audio.
- Mixed groups are explicit. New pure media packs prefer an already open pure
  group of their own kind. Grouping and docking are independent.
- Transient feature dialogs and browser draft contents are session-only. Do not
  serialize File objects or message text into an account layout.

Read the [workspace contract](../packs.md#workspaces-and-saved-arrangements)
before changing any lifecycle, saved-layout or transfer logic.

## Library, friends, Messenger and activity

[LibraryTemplate](../../packages/ui/src/templates/LibraryTemplate/LibraryTemplate.tsx)
handles listening collections; download-history My Library is distinct from
authorized Full Library. [Crates](../features/crates.md) retain UI/API code but
are deferred from app navigation and are not an advertised live workflow.

Friends and messages are wired through `useCommunity`,
[`useChatConnection`](../../apps/web/src/hooks/useChatConnection.ts) and
[MessengerTemplate](../../packages/ui/src/templates/MessengerTemplate/MessengerTemplate.tsx).
REST performs mutations and paged message reads; `/api/chat` delivers authorized
community snapshots and reconnects. Access redaction applies to attachments too.
Unsending a message is not equivalent to revoking a private media grant.

[ActivityWindows](../../packages/ui/src/organisms/NotificationViewport/ActivityWindows.tsx)
and [useNotifications](../../apps/web/src/hooks/useNotifications.ts) compose
in-app notifications/upload results. Device push is optional and separate from
successful message persistence; see [operations](operations.md).

## Shared links, PWA and onboarding

Public landing pages:
[SharedDubPage](../../apps/web/src/components/SharedDubPage.tsx),
[SharedPackPage](../../apps/web/src/components/SharedPackPage.tsx).
Guests receive explicit shortened/reduced-quality previews, with sign-in actions
for originals/downloads. Private/restricted content must not leak via public
metadata, artwork or streams. A preview is not DRM.

[PwaStatus](../../apps/web/src/components/PwaStatus.tsx),
[PushSettings](../../apps/web/src/components/PushSettings.tsx) and
[VitePWA configuration](../../apps/web/vite.config.ts) own install/update/offline
UX. Cached shell is not offline audio or queued writes.

Interactive onboarding lives in
[feature code](../../apps/web/src/features/onboarding) and shared
[TutorialGuide](../../packages/ui/src/organisms/TutorialGuide).
Account completion/dismissal is platform-specific; the current step is in-session.
Typed activity is emitted at real successful boundaries. Guide-driven reveals,
failed requests and unrelated paired actions cannot satisfy a lesson.
Tutorial highlights must not intercept or hide the controls being taught.
The [onboarding contract](../onboarding.md) documents replay, skip, focus and
failure behavior.
