# API and data

[Handbook](README.md) / API and data

## Entry points

The backend is framework-free Node ESM. Routes, request parsing, authorization
and snapshot composition live in
[`server.mjs`](../../apps/api/src/server.mjs), mainly inside `createApiServer`.
Do not introduce Express middleware assumptions into a new route.

Supporting modules:

| Module | Responsibility |
| --- | --- |
| [audioPreview.mjs](../../apps/api/src/audioPreview.mjs) | Bounded FFmpeg preview encoding/cache |
| [zipStore.mjs](../../apps/api/src/zipStore.mjs) | Streamed stored ZIP output |
| [push.mjs](../../apps/api/src/push.mjs) | Push configuration, validation and delivery |
| [windowWorkspace.mjs](../../apps/api/src/windowWorkspace.mjs) | Workspace validation and access pruning |
| [communityPostgres.mjs](../../apps/api/src/communityPostgres.mjs) | Explicit compatibility store and transaction boundary |
| [commitEffects.mjs](../../apps/api/src/commitEffects.mjs) | Commit-aware response/side-effect ordering |
| [community-postgres.sql](../../apps/api/src/community-postgres.sql) | Compatibility schema |

## HTTP surface map

This is a route-family index, not an exhaustive request-schema specification.
Follow the route branch, frontend caller and focused test for exact fields/statuses.
Use same-origin credentials from browsers.

| Family | Representative endpoints | Main consumers |
| --- | --- | --- |
| Health | `GET /api/health` | Deployment health check |
| Identity | `POST /api/login`, `/api/register`, `/api/logout` | Community/admin sign-in |
| Account snapshot/preferences | `GET /api/community`, `PUT /api/playback`, `GET/PUT /api/workspace`, `GET/PATCH /api/onboarding` | Community and persistence hooks |
| Discovery/profiles | `GET /api/dubs/search`, `GET /api/members`, profile media route | Search/profile hooks |
| Upload staging | `POST /api/uploads`, `DELETE /api/uploads/:id` | Upload service |
| Files | `POST /api/dubs`, `PATCH/DELETE /api/dubs/:id`, `GET .../audio`, `GET .../artwork`, `POST .../download` | Files, players, downloads |
| File access | `POST /api/dubs/:id/share-member`, `DELETE .../grants/:userId` | Sharing/access management |
| Packs | `GET/POST /api/packs`, `GET/PATCH/DELETE /api/packs/:id` | Pack service/editor |
| Pack actions | `POST .../tracks`, `PATCH .../tracks/:dubId`, `POST .../publish`, `POST .../share`, `POST .../download`, `GET .../archive` | Membership, publishing, grants, ZIP |
| Public links | `GET /api/public/dubs/:id` plus `/audio`/`/artwork`, `GET /api/public/packs/:id` plus `/artwork` | Shared landing pages |
| Preview preference | `PATCH /api/dubs/:id/preview` | Uploader external-share controls |
| Friends/messages | `POST /api/buddies`, `DELETE /api/buddies/:id`, `GET/POST /api/conversations/:id/messages`, message deletion and read actions | Messenger |
| Notifications/push | Read/delete notification routes; `/api/push/config`, `/status`, `/subscription` | In-app activity/device settings |
| A-List/admin | `/api/alist/application`, `/api/admin/overview`, `/api/admin/alist/*` | Submission/admin review |
| Retained crates | `/api/crates` and `/api/crates/:id/dubs` | Deferred app workflow |

Responses generally use JSON, including `{ error }` on errors, with explicit
status codes and some empty `204` responses. Media routes stream bytes instead.
Do not make helpers unconditionally JSON-decode audio, ZIP or empty responses.

## Authentication and authorization

The `cre8_session` cookie is HttpOnly, SameSite=Lax, Path=/ and Secure in
production. Sessions expire; clients must handle sign-out/expiry. Login verifies
salted scrypt hashes. Never expose password/session storage fields in snapshots.

Server checks distinguish owner, explicit file grant, published pack grant,
Worldwide, public A-List and restricted A-List. Classification does not grant
access. Admin access uses `ADMIN_USERNAMES`, never profile role text.

Recheck access on metadata, search, snapshots, public links, artwork, audio,
Messenger attachments and ZIP streams. Hiding an action in React is not an access
check. Revocation cannot recall files already downloaded or bytes buffered.

Workspace and onboarding writes include `ownerId` to reject delayed saves after
account switches. Workspace parsing limits shape/size, validates IDs, prunes
inaccessible content and rejects duplicate ownership. The current schema is
versioned; legacy payload compatibility must be explicit, not silent replacement.

## Persistence

| Mode | Domain state | Sessions | Limits |
| --- | --- | --- | --- |
| Default JSON | In-memory state loaded from JSON; `persist()` atomically replaces the data file | Process-local Map | Single instance; sessions do not survive restart |
| Explicit `COMMUNITY_STORAGE=postgres` | Ordered records in compatibility JSONB schema; command transaction and singleton lock | Persisted token hashes/expiry/revocation | Full-state commands, serialized access; still one API/media instance |

In PostgreSQL mode, responses/cookies, socket snapshots, push dispatch and
destructive media cleanup wait until commit. Do not bypass `persist()` or the
commit-effect helpers. A rollback must not leak shared in-memory mutations into
subsequent requests.

Disk media and database records are not a single atomic resource. An interrupted
or uncertain commit can leave orphans; do not delete uploaded media merely
because a commit acknowledgment was lost. Not all commands have idempotency
keys, so blind retry of a non-idempotent operation can be unsafe.

See the [API README](../../apps/api/README.md) for the exact bootstrap/import
procedure. It requires a dedicated database, explicit initialization and verified
remote TLS; there is no fallback between stores.

## Media and realtime

Uploads stream with caps; pack limits are 50 files, 100 MiB per file and 500 MiB
audio per archive. Metadata validation/publication is separate from uploading
bytes. Archive preparation and streaming both validate access. Sample/Vocal ZIPs
include licence text; membership removal does not delete the underlying file.

Anonymous public audio is a generated length-limited preview (30/60/90-second
uploader preference), not an original-file fallback. Range requests operate on
the allowed resource. Preview failure explicitly reports unavailability.

`/api/chat` upgrades to WebSocket after origin/session checks and sends
`community.snapshot` events. Connections/fan-out remain process-local in both
storage modes. The client refreshes on reconnect and has bounded retry backoff.
Device push is best-effort, not a durable event outbox.

## Developing safely

Create a server using `createApiServer` with temporary `dataPath`,
`mediaDirectory`, `publicAudioDirectory` and an ephemeral loopback port.
Follow [existing API tests](../../apps/api/test); never modify shared development
data for a test.

The [Stage A/B and staging harnesses](../../apps/api/spikes) use separate
entrypoints, databases and synthetic fixtures. Their normalized schemas, leased
jobs and health-only staging runtime are not automatically used by the normal
web/admin API. See [testing](testing.md) and [operations](operations.md).
