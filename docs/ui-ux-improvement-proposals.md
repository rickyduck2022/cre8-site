# Product and UX improvement opportunities

This document records potential UI and UX changes based on the current implementation. These are proposals, not commitments. They follow the existing React component library and app shell patterns.

## Codebase orientation

- **Workspace:** pnpm workspace coordinated by Turborepo. `apps/web` is the Vite/React front end; `apps/api` is a Node HTTP and WebSocket service; `packages/ui`, `packages/icons`, and `packages/tokens` are shared libraries.
- **UI architecture:** `packages/ui/src` groups reusable components into `atoms`, `molecules`, `organisms`, and `templates`. Most components have Storybook stories, with targeted Vitest tests for interaction-heavy controls. Page templates accept callbacks and data as props, keeping app-specific behavior outside the library.
- **Application composition:** `apps/web/src/app/App.tsx` owns navigation, dialogs, selected profile/crate, and wires page templates to `useCommunity`. `DashboardTemplate` composes header, navigation, main content, and persistent audio player. Hash routes provide basic deep links and browser history.
- **State and API:** `useCommunity` owns the community snapshot, request helpers, notifications, playback state and audio element, upload flow, and chat WebSocket/reconnect loop. It uses same-origin `/api` requests and refreshes the snapshot after mutations.
- **Server and persistence:** `apps/api/src/server.mjs` implements the API and authenticated chat, with a versioned JSON data file and uploaded media on disk. `apps/api/README.md` describes the deployment as a single-process demo, not a production data service.
- **Visual system:** `packages/tokens/src/theme.css` defines dark semantic surfaces, typography, focus, and action/audio colors. Component styles are mostly colocated CSS files; global/app layout styles live in the app and template layers.
- **Media interaction:** uploads use an XHR helper for byte progress and two-phase upload/publish; playback is managed by one `Audio` instance in the hook and exposed through the shared player. Downloads are the current “like” action.

## Potential UI and UX changes

### 1. Add a complete edit-track flow

**Why:** `DubCard` renders a “More options” button, but it has no handler or menu. The upload dialog creates a dub, while the API currently exposes create/download/audio operations and no apparent dub update/delete workflow. Users have no clear route to fix metadata or replace artwork after publishing.

**Potential change:** Make the card menu actionable for the uploader: Edit details, Replace artwork, and (if desired) Remove track. Add an edit form that pre-fills title, artist profile, genre, BPM, message, and current artwork. Preserve the audio file unless the user explicitly chooses a replacement. Show a clear save state and confirm destructive removal.

**Implementation notes:** First add owner-authorized update/delete API operations and a documented media cleanup policy; then add typed actions to `useCommunity`; finally connect the menu and form through the app shell. Reuse the upload form field styling and `Modal`, while making edit mode distinct from create mode. Handle failed saves without closing or losing entered values. If audio replacement is out of scope, make that limitation explicit in the UI.

### 2. Surface ownership-aware track actions

Only show management actions to the track owner and expose a useful menu to other viewers (for example, share or add to crate). This makes the existing “More options” affordance meaningful and avoids showing controls that cannot succeed. The server must remain authoritative about ownership.

### 3. Improve upload resilience and feedback

The upload already reports progress and cleans up temporary uploads on failure. Consider adding an explicit cancel action wired to `XMLHttpRequest.abort`, clearer stage labels (audio, artwork, publishing), retry guidance, and preserving metadata when upload fails. Keep the dialog open until success and prevent accidental close while an upload is active, with a clear explanation of the current restriction.

### 4. Improve search and filtering

The header search writes into shared app state, while the feed search filters title, artist, uploader, and genre; the feed also has newest/most-liked sorting and pagination. Clarify where global search applies, expose genre/BPM filters for crate digging, and add a one-click clear action and a useful no-results state. Keep filter state reflected in the URL if shareable search views are valuable.

### 5. Make playback behavior easier to understand

Playback controls appear in both the persistent player and each feed card. Consider a compact inline preview in feed cards with one canonical full player, clearer current-track indication, and a queue/next-up view. Explain why an audio item cannot play when `playbackError` is set and provide a retry action. Persist user preferences such as volume and repeat only if that behavior is intended across sessions.

### 6. Strengthen navigation and mobile orientation

The app combines hash navigation, a desktop sidebar, and mobile tabs; crates are represented as feed views. Consider active-state and breadcrumb/title treatment for crates, consistent browser back/forward behavior, and an accessible mobile way to reach crates and create actions. Check that the persistent player and mobile tabs do not compete for limited viewport height.

### 7. Clarify download-as-like semantics

The feed labels the action “Download · Like” and the server records a like from a download. Explain this once near the action and use consistent copy in notifications and profile/feed counts. Consider separating liking from downloading if people need to express appreciation without saving the file.

### 8. Add safer profile editing feedback

The profile form closes immediately after calling `updateProfile`, even though the mutation is asynchronous and its errors are handled through notifications. Keep it open during save, show inline failure, and close only after confirmed success. Reuse this save lifecycle for track editing.

### 9. Improve connection and empty states

Chat exposes connection status to its template and reconnects automatically. Make offline/reconnecting states visible where a message is composed, clarify whether sending is available, and provide a retry affordance. Review empty states for new accounts with no uploads, friends, crates, or conversations so each offers a relevant next step.

### 10. Accessibility and responsive polish

Continue the existing use of semantic buttons, labels, and ARIA roles. Audit keyboard operation for menus/dialogs, focus return after closing, screen-reader announcements for upload progress and chat status, visible focus indicators, and reduced-motion handling. Validate desktop, tablet, and narrow mobile layouts for long names, empty results, and persistent controls.

## Suggested sequence

1. Implement owner-authorized track update/delete support and an edit-track dialog, including save/error states.
2. Make card actions and ownership visibility consistent.
3. Fix async profile-save feedback and improve upload cancellation/recovery.
4. Polish search, mobile navigation, and playback presentation based on observed user needs.
5. Run an accessibility and responsive review across the shared stories and app flows.

## Scope and evidence limits

This review is based on the checked-in source and README, not analytics, user interviews, or a live usability study. In particular, edit-track requires server support: the current client-side “More options” button alone cannot safely update or remove persisted tracks.
