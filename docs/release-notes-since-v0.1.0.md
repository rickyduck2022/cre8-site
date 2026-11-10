# Release notes: changes since v0.1.0

**Audience:** Product owner  
**Prepared:** 10 November 2026  
**Status:** Proposed release; production deployment not verified

These notes cover changes after the `release v0.1.0` commit (`d622864`)
through commit `0ad3c16`. No local release tags were available, so the release
commit is used as the baseline. A version number for this release has not
been assigned.

## Summary

This update makes cre8 easier to use on mobile and while listening: the audio
player can be positioned or docked, collections and dub cards have a clearer
layout, and users can opt into device notifications. It also introduces an
installable app experience and improves reconnection and release administration.

## What's new for members

### Audio playback

- Move the mini player around the screen or choose a position from its menu.
  Drop previews make the available docking locations clearer.
- Dock the player in the header or footer; on desktop it can also dock in the
  sidebar. On mobile it can collapse against either side of the screen, with
  play/pause and reopen controls available on the edge.
- Player position and mobile floating-player opacity are remembered on the
  device. The track and playback controls remain available while changing
  position.
- Refreshed waveform, playback controls, player typography and shadows make
  the player more consistent with the rest of the app.

### Browsing, navigation and sharing

- Collection headings, search and filter controls now sit together in a
  contextual header, leaving more space for the scrolling dub list. Controls
  can be collapsed on mobile.
- A header back control returns members to previous sections, profiles and
  conversations.
- Dub cards have a cleaner layout, particularly on mobile, with clearer
  distribution labels, a shorter date and compact download and share actions.
- Sharing dialogs now include a playable preview of the selected dub.
  Messenger's share-a-dub picker has also been refined, including an indication
  when a dub has already been shared.
- Notifications have a refreshed presentation, individual dismissal and a
  mobile-friendly panel. Conversation notifications can open the relevant chat.
- The local development notice can be dismissed persistently on the same
  device.

### Statistics

- My Dubs now presents download requests and unique supporters as separate
  metrics, alongside clearer supporter and access information. Repeat
  downloads by the same member count as one unique supporter.
- Existing profile navigation and access-revocation actions remain available.

### Installable app and notifications

- Members can install cre8 as a web app on supported devices. On iPhone and
  iPad, installation is through **Share > Add to Home Screen**.
- After an initial online visit, the cached app shell can open offline and
  explains which features need a connection. A prompt is available when an
  app update is ready; applying it reloads the app and stops playback.
- On supported devices, members can opt in to push notifications for messages
  and shared dubs. Tapping a notification opens the conversation. Push is
  optional and must be configured by the service operator.
- Connection failures can be retried, and the app retries when connectivity
  returns.

## Operational changes

- The Render configuration supports seeding an administrator account using a
  secret configured outside the repository. Existing accounts are not
  overwritten, and an admin username collision prevents startup until resolved.
- A guarded local development purge command resets community records while
  restoring the seeded demo logins. It is not a production reset tool and does
  not remove uploaded media files.
- Missing application files from the initial implementation commit were added
  in the follow-up commit to address the reported Render build failure.

## Rollout and limitations

- **Deployment:** The initial Render deploy failed because required files were
  absent from that commit. The follow-up commit contains them, but a successful
  Render deployment has not been verified.
- **Push setup:** Requires HTTPS or localhost, supported browser permissions,
  a service worker and configured VAPID credentials. iOS/iPadOS users must
  install the app first. Delivery is best effort; message details may be
  visible on a lock screen.
- **Offline:** Only the app shell and static assets are cached. Messages,
  uploads, downloads and streaming need a connection; changes are not queued
  and audio is not stored for offline playback.
- **Admin setup:** The Render administrator seed requires a strong secret
  password in the service environment. Changing that secret later does not
  change an existing account's password.
- **Service readiness:** The current file-backed demo remains single-instance
  and is not intended for public production use or sensitive data without
  additional storage, backup and session infrastructure.

## Verification

- The focused player, waveform, dub card, statistics, local-notice and docking
  checks passed: **93 tests across 10 test files**.
- The local build sequence for tokens, UI, web and admin completed successfully.
- These checks do not confirm a successful Render deployment or end-to-end
  push delivery on real devices.
