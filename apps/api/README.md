# Community API and demo deployment

See the [developer handbook](../../docs/developer/README.md) for whole-app
architecture, the [API map](../../docs/developer/api-and-data.md) for route
families, and [operations](../../docs/developer/operations.md) for runtime
boundaries. This document owns detailed API/storage procedures.

Run the app and API together with `pnpm dev`, or start the backend alone with
`pnpm dev:api`. The API listens on port 3001 and the Vite development server
proxies `/api` requests to it.
During development, the web app loads the UI package from source so player and
other component changes are reflected without rebuilding the UI bundle.

Tutorial progress is account-owned and stored on the user record in both
compatibility storage modes. `GET /api/onboarding` returns version-1 progress
with independent `desktop` and `mobile` objects, each containing `dismissed`
and `completed` lesson IDs. `PATCH /api/onboarding` accepts
`{ ownerId, platform, action, lessonId? }`. Platform is `desktop` or `mobile`;
action is `dismiss` or `complete` (the latter requires one of `media`, `browse`,
`workspace`, `upload`, `sharing`, `community`). Updates acknowledge the welcome
offer, merge completion IDs without duplicates, and never modify the other
platform. The authenticated account must match `ownerId`; anonymous access is
rejected and responses are private/no-store. Progress survives sign-out and
server restarts. Replay does not clear completed lessons.

Signed-in window workspaces are stored on the user record in both JSON and
PostgreSQL compatibility modes. `GET /api/workspace` returns the current
account's workspace (or `null`), also included as `windowWorkspace` in community
snapshots. `PUT /api/workspace` accepts `{ ownerId, workspace }`; `ownerId` must
match the authenticated account, protecting delayed saves during account changes.
The version-1 workspace contains at most 50 uniquely identified windows
(`pack:`, `conversation:`, `track:`, `profile:<username>` or `player`), their validated frames, names,
groups, order, minimized state, dock widths and an optional Player track ID.
Root layouts optionally include `mode` (`simple` or `explorer`) and
`explorerIntroduced` (boolean). These account preferences survive access pruning
and server restarts; nested layouts cannot override them. Simple mode hides
independent contexts without removing their saved layouts.
Named contexts optionally include `savedLayout`, a validated flat layout
checkpoint from the last explicit Save. `layout` remains the recoverable working
arrangement. Checkpoint membership is historical, not live ownership; access
pruning applies to both layouts, including their opened dependency lists.
Older contexts without a checkpoint use their existing layout on first load.
The optional root-only `viewedWorkspaceId` remembers the inspected workspace:
`""` means Draft; other values must name a context in this account's catalog.
The optional root-only `activeWorkspaceId` records the running workspace for
the entry chooser: `""` means Draft, `null` means none, and other values must
name a context in the same catalog. Inspecting a different workspace does not
change this resume target. The UI offers to load the previous workspace or
start an empty Draft; it does not reveal saved windows before that choice.
Each layout optionally includes `openedDependencies`, a unique list of up to
50 IDs owned by that layout. Workspace-shell IDs cannot be selected. Access
pruning removes inaccessible IDs from both membership and remembered selection.
Explorer presents Draft and saved workspaces as flat peers; selecting one opens
all its windows directly. Manage opens its catalog separately. Legacy
workspace-shell records are flattened by the UI on save.
Entries optionally include `tabOrder` (a bounded non-negative integer, independent
of activation order) and `groupTitle` (a trimmed name of at most 100 characters,
only for grouped entries). Legacy version-1 layouts without these fields remain
valid. Feature-dialog windows and their drafts are session-only and are not saved.
Unknown fields are discarded, and unavailable/inaccessible content is excluded
on save and retrieval. Changes use the normal `persist()` transaction path.
Profile identifiers use the existing username format and are removed when the
corresponding user no longer exists; profiles can share saved groups with chats
and media, but profile contents and drafts are not part of the layout payload.
Workspace sync uses last-write-wins snapshots, restored on the next app load;
it does not push layout changes into already-open devices or synchronize drafts.

The same version-1 payload optionally includes a flat `workspaces` catalog of
up to 20 `{ id, title, saved, dependencies, layout }` contexts. A context's
`layout` has the normal version-1 fields without another catalog. Legacy
`workspace:<id>` window entries and context dependency links remain accepted
compatibility data; the current UI flattens workspace shells and clears those
links when saving. They do not describe the current flat workspace-opening
journey. Each layout permits 50 windows;
the complete arrangement permits 200, with globally unique window ownership.
Missing references, duplicate ownership, nested catalogs and cycles across
dependency links or workspace containment are rejected. Access pruning applies
independently to every context. Legacy layouts without the catalog still work.
`saved: false` retains temporary arrangements for reload without naming them
saved workspaces; explicit naming sets `saved: true`, after which layout changes
continue through the same account sync. Closed contexts can remain in the
catalog without an open window.

For the Render-first production-readiness assessment, migration gates and prepared
proof-of-concept scope, see the
[backend production spike](../../docs/backend-production-spike.md).
Other hosting providers are considered only as later scope.

## Full web/admin PostgreSQL compatibility mode

The **normal API entrypoint** now supports opt-in transactional PostgreSQL
storage while retaining its existing web/admin routes, responses, raw uploads,
audio/public links, pack downloads, Messenger and WebSocket contracts. The
frontends continue using same-origin `/api` requests; no browser connects
directly to PostgreSQL and no frontend API rewrite is needed.

This is the agreed **JSONB compatibility migration**, not the normalized Stage
A/B schema. Ordered domain records are stored in `cre8_community.records`;
sessions have a separate table containing only token hashes. It is intentionally
a single disk-owning API service, not a horizontal-scaling solution.

### Explicit bootstrap

Use a dedicated database named `cre8_community_<suffix>` (suffix: 3-32 lowercase
letters, digits or underscores). Inject secrets through environment settings,
never through source control or chat:

```powershell
$env:COMMUNITY_STORAGE = "postgres"
$env:COMMUNITY_DATABASE_NAME = "cre8_community_staging"
# Inject COMMUNITY_DATABASE_URL separately for that exact database.
# Remote URLs must use ?sslmode=verify-full with a trusted certificate chain.
pnpm.cmd --filter @craft/api db:migrate
```

The migration refuses a database containing other tables on first creation.
Subsequent runs verify the migration checksum. It does not import or seed
records, and startup refuses an uninitialized database. Normal `DATABASE_URL`
and `SPIKE_DATABASE_URL` are never used as fallbacks. The A/B fixtures and
health-only staging Blueprint are separate and cannot initialize this mode.

For **disposable local validation only**, outside `NODE_ENV=production`:

```powershell
$env:COMMUNITY_SYNTHETIC_ACK = "disposable-local-only"
pnpm.cmd --filter @craft/api db:seed:synthetic
pnpm.cmd dev:api
```

This explicit seed uses the existing deliberately public demo identities.
Never expose it publicly. For normal frontend development, start `pnpm.cmd dev`
with the same environment instead; Vite's existing API/WebSocket proxy works
unchanged. To return to JSON development, unset `COMMUNITY_STORAGE` and the
database settings before starting the process. This is **not** a data rollback.

### Inspect and import an existing community

No live import was performed. For a future approved migration:

1. Stop **all** source API writers/workers and take a verified, paired JSON/media
   backup. Use an offline copy, not the shared running development database.
2. Copy the media to an isolated target disk, preserving filenames, and set
   `COMMUNITY_MEDIA_DIRECTORY` to its absolute path. Existing URL paths and
   media names are preserved; the importer does not move or delete files.
3. Set `COMMUNITY_IMPORT_PATH` to an absolute path of the offline JSON copy.
   Inspect before authorizing an import:

   ```powershell
   pnpm.cmd --filter @craft/api db:inspect-import
   ```

   Inspection is read-only. It applies the existing versioned JSON migrations
   in memory, checks collections/identities/domain references, and hashes every
   referenced original/image/upload file. Unsafe names, symlinks, missing/empty
   media, unknown collections and dangling references fail explicitly. Retired
   built-in audio requires a separate explicit migration rather than guessing
   a location. Old-schema normalization preserves the existing API's migration
   semantics; review the reported counts against the backup before proceeding.
4. With the destination migrated and still empty, authorize the transaction:

   ```powershell
   $env:COMMUNITY_IMPORT_ACK = "offline-backup-verified"
   pnpm.cmd --filter @craft/api db:import
   ```

   Users/password hashes, artist IDs, ordering, packs/grants, conversations and
   other records are imported together. Existing destinations are never
   overwritten; a failed constraint rolls back the import. Legacy in-memory
   sessions are not available to import, so users sign in again after cutover.
5. Start the regular API with the explicit PostgreSQL configuration and the
   matching media directory, then run permission, upload, download, Messenger
   and admin acceptance checks. Do not send traffic to both JSON and PostgreSQL
   writers during cutover. Retain the frozen backup for a reviewed rollback.
   After accepting new PostgreSQL writes, simply toggling back to JSON would
   discard those writes; reconcile or restore deliberately instead.

### Render activation is still a separate step

The normal [Dockerfile](../../Dockerfile) includes this optional storage mode and
its migration/import CLI while continuing to serve the actual web/admin builds.
The existing [render.yaml](../../render.yaml) still defaults to JSON; no service,
database, secret or live record has been changed. A regular deployment without
`COMMUNITY_STORAGE=postgres` retains existing behavior.

For a future approved isolated Render test, use the normal application image,
not the health-only [staging Blueprint](../../render.staging.yaml), and configure
the explicit `COMMUNITY_*` settings above. Migrate/initialize the dedicated
database before enabling the mode. Files remain on that service's own persistent
disk. Use a migration role for DDL and a restricted runtime role for record,
metadata and session access; do not use a shared database or weaken remote TLS.
Remove/rotate public demo accounts before public operation.

### Transaction guarantees and remaining limits

- Each API command reads current PostgreSQL state under one database lock.
  `persist()` marks domain changes for the same transaction as session changes.
  JSON responses/cookies, socket snapshots, push dispatch and destructive media
  cleanup are held until commit. A failed command cannot leak in-memory changes
  into subsequent requests. Unknown dependency failures return generic errors,
  never stale JSON data.
- Sessions survive API/pool restarts; expiry/revocation is checked against the
  database. Raw session tokens are never persisted. Registration and its new
  session commit together. Existing `ADMIN_USERNAMES` authorization and separate
  admin seeding rules still apply.
- Full state is loaded for each API operation; changed collections are rewritten
  transactionally as ordered per-record JSONB. Pool size is three, admission is
  bounded at 16 pending operations, and a singleton row lock serializes database
  access. This prioritizes compatibility/correctness over throughput and remains
  unproven for the 0.5 CPU / 512 MB workload.
- Filesystem bytes and PostgreSQL are not one atomic store. Old media deletion
  follows commit; a crash or uncertain commit can leave an orphan. Never delete
  newly uploaded files merely because a COMMIT acknowledgment was lost.
  Coordinated backups/reconciliation and recovery testing remain release gates.
- This preserves the existing media path; it does **not** automatically adopt
  Stage B's quarantine/leased validation/ZIP job model, its quotas or its outbox.
  Notification dispatch is post-commit but not durable: a process crash can lose
  a dispatch. Domain data/messages remain durable.
- WebSocket connections and fan-out remain process-local. Database serialization
  prevents lost writes between test instances but is not distributed fan-out or
  cross-instance socket revocation. Deploy only one API instance. Existing
  commands do not all have idempotency keys; an uncertain commit may require
  reconciliation before retrying a non-idempotent action.
- Render/Linux/Node 22 execution, resource/soak results, paired backup restores,
  production abuse controls, OS-level processing isolation and a dedicated
  security review are still required before public cutover.

**Validation:** 24 integration checks pass against disposable PostgreSQL 18.6
on Windows/Node 26, with actual HTTP, WebSockets, ffmpeg previews and ZIP bytes;
the default API suite passes 49 tests. Integration cases cover identity/session
atomicity, cross-instance acknowledged writes, commit-time failures, uncertain
acknowledgments, rollback isolation, admin/A-List, grants and restart behavior.
Both frontends build. A real Chromium journey verified the built web app signs
in, displays a PostgreSQL-backed release, retains its session after an API
restart, reads changed database data and shows that release in the admin app.
No live data or infrastructure was used.

Run the integration suite only against a fresh disposable loopback database
named `cre8_community_test_<suffix>`, with the explicit settings above:

```powershell
pnpm.cmd --filter @craft/api db:test
```

The integration suite creates synthetic records and temporary failure-injection
functions/triggers. It deliberately tests schema drift; discard that test
database afterwards. The default `test` command does not discover this opt-in
integration file.

## Stage A PostgreSQL proof of concept

The opt-in harness in [spikes/stage-a](spikes/stage-a) implements versioned SQL
migrations, synthetic users/artists, hashed persistent sessions and transactional
crates with ordered membership, retry keys and atomic outbox records. It does
**not** replace the normal API, read community JSON, migrate live accounts or
provision Render resources.

Use an explicitly disposable PostgreSQL database named
`cre8_spike_<SPIKE_RUN_ID>`. The run ID must contain 3-32 lowercase letters,
digits or underscores. Provision it separately, use a role limited to that
database, and inject the URL through `SPIKE_DATABASE_URL`; never commit it or
paste credentials into chat. Local PostgreSQL is supported for validation;
Render Postgres remains the intended hosting target. From the repository root:

```powershell
$env:SPIKE_RUN_ID = "stage_a_local"
# Inject SPIKE_DATABASE_URL for database cre8_spike_stage_a_local separately.
pnpm.cmd --filter @craft/api spike:migrate
pnpm.cmd --filter @craft/api spike:seed
pnpm.cmd --filter @craft/api spike:test
pnpm.cmd --filter @craft/api spike:serve
```

Check each command succeeds before continuing. Missing/mismatched configuration
fails closed; no database URL falls back to `COMMUNITY_*` or `DATABASE_URL`.
Connection query parameters are restricted to `sslmode=verify-full` (required
for non-loopback hosts); TLS verification cannot be disabled remotely. Migrations refuse
non-spike tables and unknown/changed migration checksums. Re-running seed leaves
existing passwords unchanged. Use a fresh database for a clean test run; tests
create synthetic rows and temporary failure-injection database objects.

The CLI binds **only to 127.0.0.1:3002**, configurable via `SPIKE_PORT`.
It is a local harness, not a publicly deployable Render service. Synthetic
logins are `spike.alice` / `synthetic-alice-only` and
`spike.bob` / `synthetic-bob-only`; these are deliberately public fixtures,
not real community or administrator credentials.

| Route | Behavior |
| --- | --- |
| `POST /api/login`, `POST /api/logout` | Compatible `cre8_session` cookie; server stores only its SHA-256 hash |
| `GET /api/session` | Authenticated `{ user }`; expiry/revocation applies on every request |
| `GET /api/crates`, `GET /api/crates/:id` | Owner-only list `{ crates }` or crate `{ id, name, dubIds }` |
| `POST /api/crates`, `PATCH /api/crates/:id` | JSON `{ name }`; owner-scoped case-insensitive uniqueness |
| `DELETE /api/crates/:id` | Owner-only removal |
| `PUT`, `DELETE /api/crates/:id/dubs/:dubId` | Ordered unique membership; only synthetic fixtures |

Every crate mutation requires an `Idempotency-Key` header (1-100 visible ASCII
characters). Replaying the same actor/key/request returns its committed response;
changed payload/route conflicts with 409. This is intentionally opt-in harness
behavior, not a change to the current web client's contract. Mutations, replay
records and outbox events commit together; the harness has no event consumer yet.
Supported track IDs are `spike-public`, `spike-alice-private` and
`spike-bob-private`. Owner/worldwide fixture checks are **not** the complete
pack/A-List authorization implementation. Stage B adds a separate representative
media catalogue; neither stage imports real community data.

`spike:test` requires a database and fails if configuration is absent; the default
API suite runs only the database-free isolation-guard test in this directory.
Integration coverage includes 100 concurrent two-instance writes, a fresh API/pool
restart, concurrent retries, a deferred commit failure, ordered membership,
ownership, expiry/logout, unavailable database behavior and migration checks.
Validation used real temporary PostgreSQL 18.6 on Windows: **12 tests passed**.
The shared migration runner now also applies Stage B's additive migration 002,
preserving migration 001 and existing Stage A rows/checksums.
Render connectivity, its selected PostgreSQL version, Node 22/Linux/container
behavior and backup recovery still need staging validation. Stage A alone has no
media endpoints. Sockets, registration, session/replay retention sweepers and
production cutover remain outside this harness.

## Stage B private-media proof of concept

[Stage B](spikes/stage-b) extends the isolated harness, **not the live API**:
private disk uploads, validated audio and guest previews, packs/grants, leased
media jobs, revision-bound ZIP archives and atomic pack-sharing messages.
Render hosting remains the plan; this does not provision services or attach a
production disk.

### Start safely

Use the same isolated database configuration as Stage A. Run migration 002 before
starting either updated harness. For Stage B also set an absolute private media
directory whose final name is exactly `cre8_spike_<SPIKE_RUN_ID>`:

```powershell
# SPIKE_RUN_ID and the isolated SPIKE_DATABASE_URL must already be configured.
$env:SPIKE_MEDIA_DIRECTORY = Join-Path $env:TEMP ("cre8_spike_" + $env:SPIKE_RUN_ID)
pnpm.cmd --filter @craft/api spike:migrate
pnpm.cmd --filter @craft/api spike:seed:media
pnpm.cmd --filter @craft/api spike:test:media
pnpm.cmd --filter @craft/api spike:media
```

Check each command succeeds before continuing. Database integration tests assume
synthetic fixtures; use a fresh disposable database for a clean run. Stage B seeds
Alice as approved A-List, Bob as her unapproved friend, unapproved unrelated
`spike.charlie` (Bob's fixture password) and approved unrelated `spike.dana`
(Alice's fixture password). These are **public test identities**, not real logins.
Run Stage A's integration suite before seeding these additional Stage B personas
if reusing a test database, because Stage A asserts its two-user fixture.

The server binds only to loopback (default port 3002). Host/origin checks reject
non-loopback hosts and foreign browser mutation origins. No directory listing or
static media mount exists. A nonempty directory without a matching spike marker,
symlinks/junctions and unsafe media keys are rejected. The normal `COMMUNITY_*`
paths are never used as defaults.

In another terminal with the **same isolated configuration**, process due jobs:

```powershell
pnpm.cmd --filter @craft/api spike:work
pnpm.cmd --filter @craft/api spike:reconcile
```

`spike:work` drains currently due jobs, then exits; it is not an automatically
supervised production service. Failed attempts log a safe job ID/code and exit
nonzero. Retry after the two-second backoff, up to three attempts. These local
processes share one private disk; on Render they must run within the disk-owning
service, **not as a separate Render service with the same filesystem path**.

### Endpoint slice

Login/logout/session/crates still use Stage A's routes. Crates continue to use
the Stage A synthetic catalogue, not Stage B media IDs.

| Route | Request / behavior |
| --- | --- |
| `POST /api/uploads` | JSON `{ fileName, bytes }`; returns `{ id, state: "receiving" }` |
| `PUT /api/uploads/:id` | Raw audio bytes of the exact reserved size; returns 202 `uploaded`, not ready |
| `GET`, `DELETE /api/uploads/:id` | Owner-only state or tombstone; referenced track assets cannot be deleted |
| `POST /api/dubs` | `{ uploadId, title, distribution, aListPublic? }`, ready uploads only |
| `GET /api/dubs/:id`, `GET /api/dubs/:id/audio` | Current access checks; authenticated original or guest 30-second clipped WAV |
| `POST /api/packs` | `{ title, kind?, distribution, aListPublic?, licence?, dubIds? }` creates a draft |
| `PATCH /api/packs/:id` | Owner edits title/kind/licence/ordered dubIds; audience immutable in this POC |
| `POST /api/packs/:id/tracks` | `{ uploadId, title, confirmNewAccess? }` adds a new validated track |
| `POST /api/packs/:id/publish` | `{}`; validates membership, audience, readiness, bytes and Sample/Vocal usage terms atomically |
| `GET /api/packs/:id` | Authorized pack metadata; owner may inspect drafts |
| `POST /api/packs/:id/archive` | `{}`; returns 202 job `{ id, state, revision }`, deduplicated per revision |
| `GET /api/packs/:id/archive` | Ready current-revision ZIP only; rechecks pack access on every request |
| `POST /api/packs/:id/messages` | `{ recipientId, text, confirmPackAccess? }`; owner to existing friend, atomic message/grant/outbox |
| `DELETE /api/packs/:id/grants/:userId` | Owner revokes pack access and invalidates prior archives |
| `POST /api/dubs/:id/grants` | `{ userId }`; owner adds an independent private-dub grant |
| `DELETE /api/dubs/:id/grants/:userId` | Owner revokes that direct grant only |
| `GET /api/community`, `GET /api/dubs/search?q=...` | Authorized minimal catalogue, **not** the complete community snapshot contract |
| `GET /api/messages` | Sender/recipient-only synthetic pack-sharing messages |

JSON writes and deletes require `Idempotency-Key` as in Stage A; upload PUT is an
exclusive, one-shot reservation, not a resumable protocol. Use a new reservation
after a failed upload. POST publish/archive use JSON `{}`. Published-pack additions
with recipients require `confirmNewAccess: true`; granting new private pack access
through a message requires `confirmPackAccess: true`. Direct dub grants remain
independent when pack access is revoked. Draft Sample Pack membership does not
classify a sample; published membership does.

### Security and failure guarantees demonstrated

- Upload limit 100 MiB, 10 pending reservations and 1 GiB reserved/retained source
  bytes per synthetic user; free-space admission checks reserve 200 MiB headroom.
  Derived previews/ZIPs also consume disk: these are POC limits, not a complete
  production storage billing/quota policy.
- Uploads are hashed while streaming; incomplete/oversized/disconnected streams
  cannot become ready. Actual audio is fully decoded under a 30-second subprocess
  deadline before preparing a bounded 30-second preview. Supported extensions are
  WAV, MP3, OGG, M4A, AAC, FLAC and WebM, with forced demuxers.
- Jobs use durable leases (120 seconds), at most two active leases globally,
  three attempts, unique per-attempt output keys and transactional completion
  fencing. Node processing children have a 128 MiB V8 heap cap; ffmpeg uses one
  codec thread and a 64 MiB per-allocation cap. Parent deadlines cancel/terminate
  processing; these caps are **not an OS/container memory or filesystem sandbox**.
- Guest bytes come from a separately generated clipped file, never an original
  with a client playback limit. Guests cannot request original downloads or ZIPs.
  Protected streams support HEAD and single byte ranges, no-store and nosniff.
- Membership, A-List/public/private policy, grants and archive revision are checked
  before new transfers. Already authorized transfers/downloaded bytes cannot be
  recalled; signed bearer URLs are not used.
- Original/derived byte counts and SHA-256 checksums are verified; publication
  never substitutes missing or corrupt bytes. Reconciliation flags damaged ready
  assets, removes expired unclaimed uploads and stale archives, and deletes only
  unknown files older than one hour. Unknown directory entries stop cleanup.
- A failed sharing transaction leaves no message, new grant or outbox event.
  Logs exclude session tokens, database URLs, message text and raw decoder errors.

**Validation:** 17 Stage B checks and 12 Stage A checks passed against real
temporary PostgreSQL 18.6 on Windows/Node 26.13.0; the default API suite passed
39 tests. Coverage includes a killed lease claimant, stale completion rejection,
actual ffmpeg processing/cancellation, invalid files/retries, upload aborts,
cross-user/A-List/guest denial, exact two-track ZIP order/bytes, revision changes,
grant revocation, tampering, quotas, orphan cleanup and commit-time message rollback.
The suite also verifies the global two-lease limit and that a lost completion
acknowledgment cannot trigger deletion of an already committed preview.
The Stage A integration run also upgrades a version-1 fixture database to
version 2 without losing its existing crate.

This is a representative audio-only slice, not production readiness or a security
certification. Before public deployment: validate Render/Node 22/Linux, add real
supervision, OS-level process isolation, production rate limits and admission
controls, restore drills, and a dedicated security review. Artwork/avatar/banner
validation, complete community/Messenger flows, media replacement/deletion of
published tracks, read pagination, archive TTL/storage quotas, full domain import,
outbox delivery and live application integration remain outside Stage B.

### Isolated Render staging preparation

An opt-in [staging runtime and recovery runbook](spikes/staging/README.md) now
provide a separate container/Blueprint for the 0.5 CPU / 512 MB tier. Public
ingress is health-only; the synthetic harness stays loopback-only, with bounded
admission, one supervised media worker, resource samples and graceful shutdown.
The template starts paused, without a harness listener or worker. No resources
are provisioned and the live deployment is unchanged. Linux/container execution,
Render restore drills, capacity and a dedicated security review remain gates,
not results claimed by the local tests.

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
checked before inclusion. This supports dub, sample and vocal shared-file pages.
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

## Dub, sample and vocal packs

Authenticated artists can keep Dub Packs, Sample Packs and Vocal Packs as private drafts,
publish them to one audience (Worldwide, Private, or A-List), and share
published private packs with existing friends. Pack access is checked from
current pack membership; removing a pack recipient does not remove independent
track grants. Deleting a pack retains its tracks, and tracks created for a
discarded draft are kept private. Sample and Vocal packs require the owner's usage-terms
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

Dub responses include effective `mediaKind: "dub" | "sample" | "vocal"`.
Individual `POST /api/dubs` and `PATCH /api/dubs/:id` accept optional
`mediaKind: "dub" | "vocal"`; omitting it preserves the explicit type on edits.
Explicit Vocal uploads or published Vocal Pack membership take priority over
published Sample Pack membership. Otherwise files are dubs. Drafts never
reclassify existing releases. Removing pack membership recomputes classification
without clearing an explicit Vocal type. Pack item responses carry that pack's kind
for playback context. Existing access checks still apply independently.
Pack create/edit accept `kind: "dub" | "sample" | "vocal"`. Both Sample and Vocal
Packs require a nonempty licence on publication or published edits, and include
`LICENCE.txt` in ZIP downloads. Individual download access does not confer reuse rights.
Existing membership edits and publication enforce typed content: Dub Packs
accept dubs only, Sample Packs accept samples or vocals, and Vocal Packs accept
vocals only. Incompatible members return 409 without persisting partial changes.
New files uploaded through a pack use its kind; samples remain classified by
published membership. Individual type edits cannot invalidate a published pack.
`GET /api/dubs/search` accepts optional `mediaKind=dub|sample|vocal`; omitting it keeps
the mixed-media behavior for existing clients. Pack title matching respects the
selected kind. The three vaults use this scope for search and the same classification
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
