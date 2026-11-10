# Community API and demo deployment

Run the app and API together with `pnpm dev`, or start the backend alone with
`pnpm dev:api`. The API listens on port 3001 and the Vite development server
proxies `/api` requests to it.
During development, the web app loads the UI package from source so player and
other component changes are reflected without rebuilding the UI bundle.

## Installable web app and offline behavior

The app's header, footer, floating and docked audio players include a Close
control. Closing stops playback and hides the player until another dub is
played. The current listening position is saved, and volume, shuffle and repeat
preferences are retained for the session.
Player layout actions share a single attached control rail: above footer and
mini players, below the header player. Mini-player dragging, keyboard movement,
position selection and closing stay available without separate floating tabs.

The production web build is an installable PWA. Serve it over HTTPS (or
localhost); service workers are disabled in the Vite development server.
Supported browsers can offer an Install app button. On iPhone and iPad, use the
browser's Share menu and choose Add to Home Screen. Installation and available
browser controls vary by browser and operating system.

The service worker caches the versioned app shell and static assets, not API
responses, messages, profiles, uploaded artwork or audio. After a successful
online visit and service-worker installation, the app can open offline and
explains that online features are unavailable. It does not queue changes,
send messages, upload, download, or stream while offline. Browser storage may
be cleared or evicted, so the shell may need another online visit. A failed
initial connection can be retried, and the app retries when connectivity
returns. A waiting update can be applied with Update app, which reloads the app
and stops playback; it can also activate after all older app tabs are closed.

This PWA cache is not persistent file sharing or offline media storage. Shared
files and access controls remain server-side; installation does not make uploads
durable or provide background transfers. The persistent disk described below
survives service restarts, subject to its capacity and provider limitations, but
production sharing still needs reliable durable storage, backups, access
controls, and a suitable transfer/retry design.

## Render demo

The root `render.yaml` and `Dockerfile` configure a single Render web service.
It serves the built Vite app, API, and authenticated chat WebSocket on the same
origin. The Render Blueprint attaches a 1 GB persistent disk at `/var/data`;
the JSON database and uploaded media are stored there. The service uses
`PORT` (defaulting to 3001 for local use) and binds to `0.0.0.0` in production.
The storage locations can be changed with `COMMUNITY_DATA_PATH` and
`COMMUNITY_MEDIA_DIRECTORY`; `WEB_DIST_DIRECTORY` selects the built frontend
directory.

To deploy, push this repository to a Git provider, create a Render Blueprint
from the repository, and apply the `render.yaml` configuration. The disk
requires a paid web-service instance. A service with a persistent disk runs as
a single instance, and Render briefly takes it offline during deploys to avoid
concurrent disk access. See Render's [persistent disk limitations](https://render.com/docs/disks#disk-limitations-and-considerations).

The demo is intentionally file-backed and single-process; do not use it as a
production service for public users or sensitive data. It has no automated
backups beyond Render's disk snapshots. For a production launch, replace the
JSON store and in-memory sessions with managed database/session services,
configure backups, and change/remove the built-in demo credentials.

New artists can register with an artist name, unique username, password, and an
optional genre. Registration creates a linked artist profile and signs the
artist in immediately. Signing out clears the server-side session and expires
the session cookie.

## Message and shared-dub push notifications

Community `sharedDubIds` includes accessible published files from received packs
as well as individual dub shares. Pack receipt is derived from full received
message history or current private pack grants, with pack and file permissions
checked before inclusion. This supports both dub and sample shared-file pages.
The accompanying `sharedPackIds` identifies accessible received packs so clients
can display whole releases rather than infer receipt from public discovery.

Web push is optional and disabled until the server has VAPID credentials.
Generate a key pair with `pnpm --filter @craft/api exec web-push generate-vapid-keys`
and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a contact
URI such as `mailto:admin@example.com`) in the server environment. Keep the
private key secret and retain the same keys across restarts and deployments.
Configure all three in Render's environment settings for a deployed service;
never commit the private key. Changing keys requires users to enable push again.

On HTTPS or localhost, open Notifications and choose **Enable push
notifications** to grant permission for that device. On iPhone and iPad,
install the app to the Home Screen first; browser and OS support varies. The
development Vite server does not register a service worker, so use a production
build to test push. Notifications include the sender and message or shared dub
title, which may be visible on a lock screen. Tapping one opens the conversation.
Disable push from the Notifications panel; signing out also removes the current
device subscription. Other subscribed devices remain enabled. Browser permission
may also be revoked in system settings.

Subscriptions are stored with community data and push messages are encrypted
for the receiving browser. Delivery depends on the browser push service and
network; it is best effort, and failures are logged without retrying. Expired
subscriptions are removed when the push service reports them. Existing in-app
notifications continue to work without push configuration.

Profile avatar URLs are included with members, friends, and dub uploaders.
Updating a profile image changes its URL and sends refreshed community
snapshots to connected members so their avatar badges update.

My Dubs shows manual download requests and unique supporters separately.
Each successful download request is counted before the file transfer starts;
repeated requests from one member count as one supporter. The list of
supporters is included in a dub's response only for its uploader.

Uploads select Worldwide, Private, or A-List distribution. Existing schema 3
dubs migrate to Worldwide. The distribution cannot be changed after upload.
Unversioned data is not automatically reset; startup stops without changing it
so it can be migrated safely.

Members can select multiple friends when sharing accessible dubs from dub cards
and the library; delivery happens in individual Messenger conversations, with
an optional message. Private uploads can also be sent to selected friends as
part of the upload, or kept private for later sharing. If a delivery fails after
upload, the upload remains saved and failed recipients can be retried without
uploading again. A-List uploads have an optional Public setting, off by default
for new and existing dubs. Restricted A-List dubs are accessible only to
approved members and can be sent to any other approved member; sharing with a
non-friend adds them to the sender's Friend List and sends a Messenger message.
Public A-List dubs are accessible to all members and can be shared with friends.
Worldwide and public A-List dubs also offer **Share externally / Copy link** in
the sharing dialog, including when there are no friends to send to. Links use
`/#share?dub=<id>` and open a standalone player without the community navigation
or Messenger. Logged-out listeners hear only a preview from the beginning.

## Dub and sample packs

Authenticated artists can keep Dub Packs and Sample Packs as private drafts,
publish them to one audience (Worldwide, Private, or A-List), and share
published private packs with existing friends. Pack access is checked from
current pack membership; removing a pack recipient does not remove independent
track grants. Deleting a pack retains its tracks, and tracks created for a
discarded draft are kept private. Sample packs require the owner's usage-terms
text before publishing; that text is included as `LICENCE.txt` in downloads.

Community snapshots include accessible published `packs` for compact release
cards in the Dub Vault; drafts are excluded. Dub search also matches titles
and descriptions of accessible published packs while retaining per-file
distribution, media-format and metadata filters. Revoking pack access removes
its metadata from both surfaces, even when separate track grants remain.

Pack archives are streamed as uncompressed ZIPs and limited to 500 MiB of
audio across at most 50 tracks. Each upload retains the existing 100 MiB
per-file limit. Archive requests validate current access and all media before
counting downloads; the archive URL rechecks access before streaming.
The uploader chooses 30, 60 or 90 seconds in the sharing dialog and saves the
setting for **all** external links to that dub; other members cannot change it.
Existing dubs default to 30 seconds. Shorter tracks are not padded.
Full listening and downloads require sign-in (or artist registration) and then
return to the shared dub. Signed-in downloads use the
existing download endpoint, recording each request and one like per member.

`GET /api/public/dubs/:id` exposes an explicit public metadata allowlist and an
authentication flag. Anonymous metadata describes the preview duration and audio
URL; authenticated metadata supplies the original `/api/dubs/:id/audio` URL.
Its `/audio` and `/artwork` endpoints support byte ranges. Anonymous audio
requests receive only a transcoded, length-limited WAV, never the original file;
range requests operate on that clip and cannot seek into the rest of the track.
Authenticated playback remains full length.
`PATCH /api/dubs/:id/preview` accepts `{ "previewSeconds": 30 | 60 | 90 }`
only from the uploader of an externally shareable dub and persists the setting.
All three endpoints recheck worldwide/public A-List eligibility on each request;
private, restricted, deleted and unknown dubs return the same unavailable
response, even to their owner. Public endpoints reject `?download` requests;
attachment downloads remain authenticated under `/api/dubs/:id`. Public metadata
and streams are not cached by the API or service worker. Removing public access
blocks subsequent requests but cannot revoke buffered or already received bytes.
This is access control, not DRM: the public preview and authenticated playback
can still be captured by their listeners.

Preview encoding uses FFmpeg, supplied by the `ffmpeg-static` API dependency for
local development. `FFMPEG_PATH` can select an existing executable. The production
Docker image installs Alpine's FFmpeg and sets that path explicitly. Encoding
failures return 503 with a retry message; there is no full-track fallback.
Encoding is limited to two concurrent jobs, with a 30-second timeout, fixed
16 kHz mono PCM output, bounded output size and a 16-clip in-memory LRU cache.
Cache keys include source path, size, modification time and preview length;
visibility and preview settings are rechecked after encoding. No preview files
are written to the media directory. Restarting clears the cache.

Changing Public on an existing dub creates a new version. Restricting it removes
API access for unapproved members and redacts existing messages, but cannot
recall downloaded files. The dedicated A-List feed still requires approval.
Private dubs are visible to
their uploader and friends explicitly shared with in Messenger. Only the uploader can share a private dub or revoke a grant from
My Dubs. Revocation prevents subsequent API access, but cannot recall files
already downloaded or bytes already transferred. Unsending a message does not
revoke private access; the uploader must revoke it separately. Restricted A-List access and A-List uploads
require server-side A-List approval. Members can submit applications under
A-List Submission; administrators configured through `ADMIN_USERNAMES` can
review and approve, reject, request information or revoke access in the admin
app. Decisions, previous submission versions and notifications are persisted.
Social profile URLs, events or brands, supporting artists and record labels are
optional. Supplied social URLs must use HTTP or HTTPS.
Follower counts are self-reported and unverified; no social API integration
is used. The Dub Vault shows accessible A-List dubs first, followed by
Worldwide dubs; private dubs are excluded unless explicitly selected in the
distribution filter, which includes only private dubs the member can access.
The feed search accepts repeated `distributionType` parameters (`worldwide`,
`private`, or `alist`) to match any selected type. Without them the feed retains
its default scope, and the API's default Worldwide-only search remains available.
Shared With Me lists and counts distinct accessible dubs received in Messenger,
regardless of distribution. It uses persisted share history, legacy incoming
messages and private grants, rather than the paginated conversation preview.
Its search and filters apply to the shared collection, with all distributions
selected by default. Dub Vault and A-List navigation counts reflect accessible
dubs in their default feeds, independently of active search filters.
Unsend does not erase share history; access revocation removes a dub from that
page and from My Library.
The API checks access independently for media, search, snapshots,
messages, playback, crates, library and admin overview.
Artist approval indicators reflect the linked account's current A-List status,
independently of a dub's distribution; approval and revocation update connected
community snapshots. Member discovery snapshots include public profile details
so artist links can open profiles for members who are not yet friends.
Owner-only supporter and private-access lists include the member's avatar and
approval status for their profile cards.

Share history is tracked per sender, friend, dub and current version, independently
of paginated messages. A friend already sent that version is marked Shared and
can explicitly be selected using Share again. A successful edit that changes
track metadata or media creates a new version; saving without changes does not.
Unsent messages and revoked private access do not erase the share history.
Schema 5 data migrates with empty versioned share history: older messages cannot
reliably be attributed to the current version because earlier edits were not
versioned.

Conversation snapshots include the most recent 30 messages per conversation.
The authenticated `GET /api/conversations/:buddyId/messages` endpoint returns
the newest page; pass `?before=<message-id>` to fetch the page immediately
before that message. Responses include `hasMoreMessages` so clients can stop
requesting history when they reach the beginning of the conversation.

`POST /api/conversations/:buddyId/messages` accepts `{text, packId}` to attach a
published Dub Pack or Sample Pack. `dubId` and `packId` are mutually exclusive.
The sender must have pack access; private packs can only be sent by their owner.
Adding a private recipient requires `confirmPackAccess: true` (otherwise 409)
and preserves existing grants. Restricted A-List recipients must be approved.
Revocation sanitizes inaccessible pack attachments from conversation responses.
Unsend clears the attachment without revoking any previously granted access.

Crate owners can create crates, rename them with `PATCH /api/crates/:crateId`,
delete them with `DELETE /api/crates/:crateId`, and add or remove dubs with the
`/api/crates/:crateId/dubs/:dubId` routes. Deleting a crate does not delete the
tracks it contained.

The authenticated `PUT /api/playback` endpoint saves the current user's most
recent track and position as `{ "dubId": "...", "positionSeconds": 12.5 }`.
The community snapshot returns this as `lastPlayback`, or `null` when no saved
track is available. The player restores it paused, saves periodically and on
seeks, pauses, track changes and sign-out, and advances through playable
community dubs in snapshot order (wrapping at the ends). Shuffle chooses a
different track and previous follows shuffle history; repeat loops the current
track. Replacing or deleting the audio clears saved positions for that dub.
Pack playback instead uses an explicit client-side queue: Next/Previous, shuffle
and repeat remain inside that pack. The active queue's pack identity is separate
from its track membership so overlapping releases retain the correct playlist
and share/download context.

Dub responses include derived `mediaKind: "dub" | "sample"`. Published Sample
Pack membership takes precedence over Dub Pack membership; drafts do not
reclassify existing releases. Classification is recomputed from membership,
not stored as another editable field. Pack item responses carry that pack's kind
for playback context. Existing access checks still apply independently.
`GET /api/dubs/search` accepts optional `mediaKind=dub|sample`; omitting it keeps
the mixed-media behavior for existing clients. Pack title matching respects the
selected kind. The two vaults use this scope for search and the same classification
for their default feeds, available formats and navigation counts.

The seeded demo accounts are `meladee` / `meladee` and `holik` / `holik`.
Passwords are stored as salted scrypt hashes. On a local run, community records,
uploaded audio, and optional dub artwork are stored under `apps/api/data/`;
to reset the local database, stop the API and run `pnpm dev:purge` from the
repository root. Confirm by typing `PURGE`, or pass `--yes` for non-interactive
use. This removes all other accounts and records, resets both demo accounts and
their passwords to the seed, and leaves uploaded media files on disk. It only
targets the default local database and refuses to run in production or when
`COMMUNITY_DATA_PATH` is set. Restart the API afterward; it keeps data in memory
and could otherwise overwrite the reset. New accounts start without
tracks; artists can add tracks by uploading audio. Dubs without an uploaded
image use the built-in whitelabel artwork.
