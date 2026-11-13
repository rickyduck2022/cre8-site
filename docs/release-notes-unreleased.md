# Unreleased: features, improvements, fixes and recommendations

**Baseline:** `5ae86ab` (`RELEASE v0.1.5`) to the current working tree, including
relevant untracked implementation files. No new release number is assigned.
These notes describe code present during preparation, not verified production
deployment. Shared-worktree changes should be reconciled before packaging.

## Release headline

**A more complete music workspace: Vocals, guided onboarding, saved arrangements
and consistent listening across collections and windows.**

Docking, packs, samples, PWA installation and device push already existed before
this baseline. This release extends those systems; it does not introduce all of
them from scratch. Existing backend PostgreSQL compatibility and experimental
infrastructure work are documented separately, not advertised as a new deployment.

## Major features

### 1. Account-owned workspaces and recovery

- Draft and named workspaces are top-level peers, with Simple mode for a single
  Draft and Explorer mode for saved arrangements.
- Opening a workspace opens its complete dependency set; Manage separately edits
  content/naming. Switching workspaces suspends the old windows and pauses their
  playback without destroying live session drafts.
- Startup offers recovery or an empty Draft when appropriate.
- Explicit Save checkpoints are distinct from automatic recovery. Close supports
  Save/Discard/Cancel, with editor guards and recovery of saved arrangements.

### 2. Expanded window and grouping system

- Mixed media, player, profile and conversation groups; named groups, tab tear-out,
  reordering and menu/keyboard alternatives.
- Grouping/ordering undo, minimized-group drop targets and independent dock stacks.
- Consistent manager controls and mobile fullscreen/switching behavior, while
  retaining stable content identity during layout changes.

### 3. Vocal media throughout the app

- Vocal Vault, Your Vocals and received Vocal files/packs.
- Individual Vocal uploads and Vocal Packs with violet navigation/player identity.
- Sample/Vocal licence requirements and compatible membership validation across
  pickers and API. Vocal classification remains independent from audience grants.

### 4. Interactive onboarding

- Six replayable lessons covering media, discovery/playback, workspaces, uploads,
  sharing/A-List and community features.
- Contextual spotlight, ordered action requirements and completion only after real
  successful actions, with safe skip/retry.
- Account-owned desktop/mobile dismissal and completion tracked independently.
  The guide does not upload, publish, share or send on the member's behalf.

### 5. Consistent main and window playback

- Main, pack, standalone-track and minimized controls use one audio engine.
- Window queues retain progress and settings; interacting controls select the
  appropriate context in the main player.
- Exact pack membership and queue identity are preserved across transport,
  shuffle/repeat and shared member tracks.

### 6. Broader collection views

- My Uploads combines owned files/packs, including drafts.
- Full Library browses currently authorized tracks across media domains, separate
  from download-history My Library.
- Received collections include packs and files with current access, without
  duplicating displayed pack members as standalone releases.

## Minor features

- Browser-persisted light/dark theme preference.
- Open individual files in track windows without starting playback.
- Edit owned packs and upload audio directly inside their current window.
- Workspace content picker, media sections, group disclosures and minimize-all.
- Whole-pack ZIP request statistics alongside member-file download counts.
- Clear guest preview notices and sign-in/download actions on shared releases.

ZIP tracking begins with this update. File counts include ZIP requests and
downloads outside the displayed pack; counts measure requests, not completed
transfers. An unavailable ZIP count is not presented as zero.

## UX and UI improvements

- Compact right-bar Explorer/manager, independently scrolling lists and pinned
  actions coordinated with the sidebar tracklist/footer player.
- Temporary outside hiding with restoration on new/open requests, distinct from
  minimization or closure.
- Staggered initial positions and content-fit sizing that preserves manually sized
  and restored layouts.
- Bright focused window/control outlines and selected visibility indicators.
  Visible/Hidden icons are simplified while minimize/maximize actions retain
  their own controls.
- Shared media tones, neutral mixed-window styling, collapsible navigation groups,
  Files/Packs collection controls and richer filter panels.
- More consistent upload choices and numbered editor sections, per-file progress,
  retries, validation and mobile touch targets.

## Fixes and reliability changes

These are intended fixes present in code and related regression coverage, not a
claim that every current test has been rerun for this document:

- Explicit open/focus restores a saved, minimized or hidden target on the first
  request instead of creating duplicates or requiring another click.
- Workspace ownership reconciliation and guards prevent stale snapshots from
  duplicating dependencies; inaccessible saved content is validated/pruned.
- Save/discard uses the explicit checkpoint rather than the arrangement at opening.
  Busy/dirty editor decisions stay reachable.
- Main/window context selection no longer leaves the main controller on an
  unrelated queue; pack transport remains scoped to the intended membership.
- Draft membership does not incorrectly reclassify public releases; incompatible
  published memberships and type changes are rejected.
- Received content follows actual shares/current grants rather than assuming
  every accessible public release was received.
- Tutorial reveals/failed operations do not count as completion; paired actions
  must refer to the same subject. Spotlight/focus handling avoids blocking the
  interaction being taught.

## Recommended release gates

Stabilize this scope rather than add another major feature before shipping:

1. **Current regression evidence:** run the affected API, workspace, docking,
   playback, collection and tutorial tests against the final packaged tree.
   A previous session reported a docking reset-position assertion; its current
   status has not been reverified during this documentation task.
2. **Recovery and data safety:** desktop/mobile reload, startup choice, save vs
   recovery, discard, transfers, deletion and unsaved/busy editor guards.
3. **Media/access consistency:** Vocal compatibility/licensing, A-List precedence,
   revoked private access, public previews and received pack membership.
4. **Playback:** exact queues, paused progress, seek, shuffle/repeat and main/window
   switching, including minimized controls.
5. **Responsive/accessibility:** narrow and short viewports, keyboard alternatives,
   reachable pinned actions, theme contrast and tutorial overlay placement.
6. **Operational readiness:** verify the intended deployment/runtime, paired
   metadata/media backup restore, storage-mode setup and release artifact inclusion.
   Local builds do not prove staging or production success.

## Proposed follow-ups, not included features

| Priority | Proposal | Benefit |
| --- | --- | --- |
| Small | Persist partial tutorial requirements and resume position | Avoid restarting a lesson after reload |
| Small | Availability-aware tutorial prerequisites and clearer recovery/empty states | Explain missing media, recipients or access before an action |
| Small | Optional manual continuation and compact short-screen chrome | Give members more control and usable space |
| Later major | Explicit isolated tutorial practice mode | Teach uploads/sharing without real account changes |
| Later major | Conflict-aware cross-device workspace synchronization | Go beyond last-write-wins snapshots without implying draft collaboration |
| Later major | Workspace templates/duplication | Reusable starting arrangements after separate UX design |

These proposals require separate approval/implementation. No product changes,
deployment, migration or new release version are part of the documentation work.

## Evidence and limits

Detailed behavior/source maps:
[product systems](developer/product-systems.md),
[packs/workspaces](packs.md), [onboarding](onboarding.md),
[API](developer/api-and-data.md), [operations](developer/operations.md).

Focused regression entry points are indexed in
[testing](developer/testing.md). This documentation task does not claim a fresh
application test run, real-device push verification or production readiness.
Partial tutorial-step persistence, offline media, durable push dispatch,
collaborative workspaces and automatic adoption of experimental Stage B jobs are
not implemented promises.
