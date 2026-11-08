# Community API and demo deployment

Run the app and API together with `pnpm dev`, or start the backend alone with
`pnpm dev:api`. The API listens on port 3001 and the Vite development server
proxies `/api` requests to it.
During development, the web app loads the UI package from source so player and
other component changes are reflected without rebuilding the UI bundle.

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
uploading again. A-List
dubs can only be sent to approved A-List members. Private dubs are visible to
their uploader and friends explicitly shared with in Messenger. Only the uploader can share a private dub or revoke a grant from
My Dubs. Revocation prevents subsequent API access, but cannot recall files
already downloaded or bytes already transferred. Unsending a message does not
revoke private access; the uploader must revoke it separately. A-List access and uploads
require server-side A-List approval. Members can submit applications under
A-List Submission; administrators configured through `ADMIN_USERNAMES` can
review and approve, reject, request information or revoke access in the admin
app. Decisions, previous submission versions and notifications are persisted.
Social profile URLs, events or brands, supporting artists and record labels are
optional. Supplied social URLs must use HTTP or HTTPS.
Follower counts are self-reported and unverified; no social API integration
is used. The Dub Feed shows A-List dubs first for approved members, followed by
Worldwide dubs; private dubs are excluded unless explicitly selected in the
distribution filter, which includes only private dubs the member can access.
The feed search accepts repeated `distributionType` parameters (`worldwide`,
`private`, or `alist`) to match any selected type. Without them the feed retains
its default scope, and the API's default Worldwide-only search remains available.
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

The seeded demo accounts are `meladee` / `meladee` and `holik` / `holik`.
Passwords are stored as salted scrypt hashes. On a local run, community records,
uploaded audio, and optional dub artwork are stored under `apps/api/data/`;
remove that directory to reset the local seed. New accounts start without
tracks; artists can add tracks by uploading audio. Dubs without an uploaded
image use the built-in whitelabel artwork.
