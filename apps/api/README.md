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
