# Backend production-readiness spike

Assessment: 2026-11-10, backend at commit `1c6fc44`.

## Decision summary

**Not ready for an unrestricted public production launch.** The current backend
has useful authorization and functional coverage, but its storage and process
model cannot yet provide transactional durability, multiple API instances or
verified recovery.

Recommended direction:

- **Render first:** keep near-term hosting on Render. Other providers are later
  scope, not a prerequisite or a hosting decision to reopen for the first POC.
- Keep the framework-free Node HTTP API and existing HTTP/WebSocket contracts.
- Replace mutable JSON state with **Render Postgres** and explicit transactions.
- Store sessions in PostgreSQL initially; Redis is not a launch prerequisite.
- Initially retain media on the Render persistent disk behind authorized API
  routes, with quotas, verified lifecycle and backups. This remains a single
  disk-owning service with deployment downtime, not a horizontally scalable setup.
- Run bounded media jobs in supervised subprocesses within that service, with a
  durable PostgreSQL-backed job/outbox mechanism. A separate Render media worker
  and private object storage are a later scale phase, subject to approval.
- Add operational controls, restore drills and deployment gates before launch.
- Treat authorization, private media isolation, integrity and failure recovery as
  release gates, not optional follow-up work. Passing the POC is not a security
  certification; public deployment still requires a dedicated security review.
- Preserve the current access rules and UX; do not combine this migration with
  a framework rewrite, UI redesign or authentication-provider migration.

The original assessment made no runtime or infrastructure changes. A subsequent
**Stage A and B isolated POCs are now implemented**; see section 6 and the
[usage instructions](../apps/api/README.md#stage-a-postgresql-proof-of-concept).
It is not a production migration or deployment. No production services,
credentials or live community data were inspected.
The default JSON API behavior and deployed hosting settings remain unchanged;
the normal API now additionally supports explicitly opted-in PostgreSQL
compatibility storage as documented below.
The existing frontend work in the worktree is unrelated and remains untouched.

## 1. Scope, evidence and limits

Reviewed all four backend source modules, API tests, deployment configuration,
API/admin documentation and the principal web integration contracts.

| Area | Observed behavior | Evidence |
| --- | --- | --- |
| Persistence | One process loads the whole JSON state. Normal saves synchronously stringify to a temporary file then rename. Startup also normalizes and directly rewrites the JSON. | [initialization](../apps/api/src/server.mjs#L127), [startup write and saveData](../apps/api/src/server.mjs#L190) |
| Identity | Salted scrypt hashes; login performs synchronous hashing. Sessions are process-local, expire after seven days and use HttpOnly/SameSite=Lax cookies, Secure in production. Built-in demo identities are seeded. | [hashing and seeds](../apps/api/src/server.mjs#L59), [session state](../apps/api/src/server.mjs#L1070), [login](../apps/api/src/server.mjs#L1119) |
| Admin | Environment username allowlist, separate from editable profile roles; optional admin seed does not overwrite existing credentials. | [allowlist](../apps/api/src/server.mjs#L483), [seed](../apps/api/src/server.mjs#L205), [admin docs](../apps/admin/README.md) |
| Permissions | Dub and pack policies distinguish ownership, individual grants, published private pack grants, public A-List and restricted A-List. Sample classification is independent. | [access and classification](../apps/api/src/server.mjs#L535), [received shares](../apps/api/src/server.mjs#L753) |
| Uploads | Streamed with byte caps, exclusive file creation and failed-pipeline cleanup; filename extensions determine accepted formats. Metadata persists separately from files. | [limits](../apps/api/src/server.mjs#L20), [streaming upload](../apps/api/src/server.mjs#L1035), [upload route](../apps/api/src/server.mjs#L2250) |
| Media | Range streams and authenticated downloads; guests receive generated clips rather than original public-link audio. Local media operations include synchronous filesystem calls. | [range/stream helpers](../apps/api/src/server.mjs#L290), [public previews](../apps/api/src/server.mjs#L1224), [authenticated streams](../apps/api/src/server.mjs#L2490) |
| Processing | Preview encoding has a 30-second timeout, at most two pending encodes, in-flight deduplication and a 16-entry memory cache. ZIP generation pre-reads files for CRC then streams them again. | [previews](../apps/api/src/audioPreview.mjs#L15), [ZIP](../apps/api/src/zipStore.mjs#L73) |
| Transactions/retries | Pack-track creation has request/upload replay detection, but no general transaction/idempotency mechanism. Message sending updates both participant views and grants before persist. | [track replay](../apps/api/src/server.mjs#L1600), [message mutation](../apps/api/src/server.mjs#L915), [message persistence](../apps/api/src/server.mjs#L2628) |
| Read scale | Community responses include all accessible dubs/packs and member suggestions, with latest 30 messages per conversation. Search scans in-memory collections; mutations can broadcast full snapshots to connected users. | [snapshot](../apps/api/src/server.mjs#L753), [search](../apps/api/src/server.mjs#L2139), [broadcast](../apps/api/src/server.mjs#L2840) |
| Realtime/push | Socket membership is process-local; origin/session checks and logout/expiry closure exist. Push sends are best effort, with no durable retry queue. | [push validation](../apps/api/src/push.mjs#L5), [delivery](../apps/api/src/server.mjs#L2817), [WebSocket lifecycle](../apps/api/src/server.mjs#L2857) |
| Operations | Health returns a constant success response. Source has no explicit request tracing, service metrics, readiness dependency check, SIGTERM drain, rate limiter, socket heartbeat or buffered-send limit. Node/platform defaults are not evidence of tuned limits. | [health](../apps/api/src/server.mjs#L1092), [error handling](../apps/api/src/server.mjs#L2804), [entrypoint](../apps/api/src/server.mjs#L2903) |
| Hosting | Single service, 512 MB plan, 1 GB persistent disk; Node 22 Alpine image serves API, web, admin and guides. No repository CI workflow directory was present. | [Render](../render.yaml), [Dockerfile](../Dockerfile), [deployment caveat](../apps/api/README.md#render-demo) |

### Executed validation

- **37/37 API tests passed**, including packs, migrations, permissions, guest
  clips, admin seeding, messages, WebSocket origin checks, push and purge guards.
    Expected invalid-audio fixtures logged their preparation failures.
- Syntax checks passed for all four backend modules.
- Local test runtime was Node **26.13.0**, while the image declares Node **22**.
  Container/Linux behavior is **not verified** here: Docker and `psql` were not
  available. The next phase must validate on the selected supported Node LTS.
- Three additional isolated experiments used fresh temporary JSON/media paths,
  ephemeral localhost ports and a fake/unconfigured push service:
  1. Made the save temporary path a directory, then created a crate: HTTP 500,
     but a snapshot showed one crate while the saved JSON contained zero.
     **Failed persistence does not roll back the in-memory mutation.**
  2. Started two APIs over the same isolated data path: both crate creates
     returned 201, but disk retained only the second writer's crate.
     **Do not horizontally scale the JSON implementation.**
  3. Used instance A's cookie against B: HTTP 401.
     **Sessions are not shared across instances.**
- Helpers were closed and their temporary data removed.

These are functional/failure-mode observations, not a penetration test,
throughput benchmark, provider certification or production SLA measurement.
No production dataset size, traffic, bill, backup or incident history was available.

## 2. Proposed launch envelope and recovery objectives

The user has not supplied traffic or recovery requirements. The following are
**planning/test inputs requiring approval**, not current capacity claims:

| Input/objective | Proposed baseline |
| --- | --- |
| Community | 1,000 registered users; 100 active sessions/sockets |
| Catalogue/load fixture | 10,000 files, 1,000 packs, 100,000 messages |
| Listening | 100 simultaneous audio streams; model actual source bitrates, not only compressed previews |
| Ingest | 20 audio uploads/day averaging 25 MB; burst test five simultaneous uploads |
| Metadata load | 20 requests/second sustained, 50/second short bursts, including writes |
| Metadata latency | p95 below 300 ms, p99 below 1 second from a same-region load runner; separately measure network latency |
| Media | p95 first byte below 800 ms in the same region; maintain correct seeking/ranges under load |
| Reliability | Goal of 99.9% successful non-user-error API requests/month; define exclusions and alerting before offering an SLA |
| Recovery | Metadata RPO <=15 minutes, originals RPO <=24 hours for independent-backup disaster recovery, full service RTO <=4 hours |

The original-media RPO permits loss of up to a day of recent uploads if primary
storage and its version history are both lost. This must be explicitly accepted;
otherwise require independently protected copies within 15 minutes before launch.
Versioning protects against some deletions/overwrites, not every account/region
failure. RTO is a disaster-recovery target, not a promise that a four-hour outage
fits a 99.9% monthly availability budget.

Capacity/cost arithmetic:

- 10,000 originals at 25 MB average is about **250 GB**, before artwork,
  previews, versions, independent backups and archives.
- Twenty such uploads/day adds about **15 GB/month**.
- 100 streams at 320 kbit/s is about **32 Mbit/s / 14.4 GB per hour**.
  Eight hours/day at that utilization is about **3.46 TB/month**.
  Lossless originals can be substantially higher.
- The current 1 GB disk is not an adequate catalogue/storage plan for that
  envelope. Egress, backup copies and archive lifecycle may dominate cost.

Use measured bitrates, retention and listening hours to revise this model.
Do not size compute or promise a price from these estimates alone.

## 3. Render-first architecture and later scale path

### Near term: Render API + Render Postgres + existing media disk

```text
Browser / PWA
  -> Render HTTPS web service (one disk-owning instance)
     -> framework-free Node API (HTTP + WebSocket + static apps)
     -> supervised bounded media subprocesses / durable job runner
     -> persistent media disk, served only through authorized routes
     -> Render Postgres over its internal connection
        (domain rows, sessions, outbox, jobs)
```

Keep the API and paid Render Postgres in the same workspace/region; use the
internal database URL and least-privilege application credentials. Paid Postgres
provides PITR, but the selected workspace/compute plan and restore procedure
must be checked. Current Render documentation excludes the most recent ten minutes
from selectable PITR restore points; the proposed 15-minute metadata RPO still
requires a measured restore drill, not an assumed guarantee.

Render's disk constraints are architectural requirements:

- One disk is accessible by one service instance; another service or worker
  cannot mount it. Do not configure a separate media worker against that path.
- Disk-backed services cannot scale to multiple instances or use zero-downtime
  deployment. Accept a documented maintenance window for this stage; the 99.9%
  objective is not established by this topology.
- Disk files are unavailable to build/pre-deploy commands and one-off jobs.
  Run media import/maintenance within the disk-owning runtime under an explicit
  maintenance mode, not a pre-deploy job pretending to access `/var/data`.
- Render documents daily disk snapshots with seven-day retention. Validate restore
  and coordinate the database recovery point with the media manifest. A snapshot
  in the same account is not an independent disaster-recovery backup.
- Increase disk capacity only after an approved storage budget; enforce free-space
  alerts, admission thresholds and bounded temp use before accepting uploads.

A separate Render worker can handle jobs needing only PostgreSQL, such as push.
Keep media jobs in supervised subprocesses in the disk-owning service for now.
Their CPU/RSS/temp limits and shutdown must be measured on the selected Render
instance size; the existing 512 MB instance is not a validated production size.
Persist jobs before acknowledgment so a deploy can resume unfinished work.

This is a capped, non-HA release path, conditional on explicit acceptance of
downtime, recovery limits and measured load. If it cannot meet the approved
envelope, reduce the admitted launch scope or approve the next storage phase;
do not label the limitations solved by moving JSON into PostgreSQL alone.

### Later: scale on Render before considering a hosting move

```text
Browser / PWA
  -> Render HTTPS / load balancer
     -> Render Node API instances without persistent media disks
        -> Render Postgres (domain rows, sessions, outbox, jobs)
        -> private object storage (originals, artwork, generated assets)
     -> separate Render media worker (ffmpeg, validation, archives, push)
        -> PostgreSQL job leases + private object storage
```

Approve the object-storage service separately when needed; retaining Render
compute does not require migrating the whole application to that storage provider.
The storage adapter/lifecycle below prepares this path without requiring an
external bucket or a separate media service in the first POC.

Keep `/api`, `cre8_session`, public-share URLs and web/admin paths stable.
Static assets can remain with the API initially; a static CDN is optional.
Never put protected originals in a public static directory or public bucket.
No Kubernetes, microservice split, new HTTP framework or search cluster is
necessary to prove this architecture.

### Other providers: later scope only

These are future comparison notes, not options to select or provision now:

| Later option | Suitable shape | Trigger / trade-off to reassess |
| --- | --- | --- |
| AWS-managed | Container service + managed PostgreSQL/RDS + S3; optional SQS | Consider only if measured scale, recovery, region or cost needs justify a move; more network/IAM/operational setup |
| Other managed hosts | Long-running Node API/worker + pooled PostgreSQL + private object store | Reassess if Render cannot meet an approved requirement; require WebSockets, bounded jobs, migration execution and verified restores |

Avoid function-only hosting as the default fit for long streams, sockets and
ffmpeg. Select one region close to the initial audience and colocate API, worker,
database and media where practical. Price the *whole* system: HA compute,
database/PITR, storage versions, backup copies, transfer, requests, observability
and staging. Public Render disk, private-network and recovery documentation was
checked, but live account settings, current pricing and service availability were
not verified. Keep standard SQL migrations and storage interfaces portable; do not
build multi-cloud deployment machinery in anticipation of a possible later move.

### Database and module boundaries

Keep `createApiServer` as the composition root. Extract policy/domain services
and small repositories incrementally; routes must not load a global state blob
from PostgreSQL and write it back. Use parameterized SQL with a small `pg`-based
adapter unless the POC establishes a concrete need for more tooling.

Suggested transaction boundary:

```text
request validation + authentication
  -> transaction using one checked-out connection
     -> current authorization check / relevant row locks
     -> domain mutations + idempotency record + outbox rows
  -> commit
  -> response / best-effort wake-up of durable delivery
```

Failed commits must not alter a process-wide canonical state or broadcast success.
Use bounded connection pools, query/lock timeouts and optimistic revisions or
targeted row locks for conflicting updates. Retry only known transient failures,
with a limit and idempotent semantics; never blindly retry external side effects.

| Existing data | Proposed relational representation / invariant |
| --- | --- |
| Users/artists | `users`, `artists`; unique normalized username, existing salted hashes preserved; admin allowlist remains separate |
| Dubs/uploads | `dubs`, `media_assets`, `upload_intents`; owner, immutable object/version reference, bytes, checksum, state and revision |
| Packs | `packs`, `pack_items`, `pack_grants`; unique `(pack_id,dub_id)` and `(pack_id,position)`, explicit order, terms and draft/publication state |
| Permissions | `dub_grants` and `pack_grants` remain independent; do not flatten pack membership into permanent dub grants |
| Crates | `crates`, `crate_items`; owner-scoped normalized-name rule, unique membership and deterministic order |
| Friendships/chat | Directed `friendships`; canonical `messages` plus participant-specific read/visibility state, adapters preserve existing buddy/message IDs and sender views |
| Engagement/shares | `likes` unique per user/dub; append-only download-request events; versioned `dub_shares`, received-pack relationships derived compatibly |
| A-List/notifications | Applications, decisions, notifications, push subscriptions with ownership, timestamps and retention policies |
| Playback | Per-user last-playback row; update only that row rather than rewriting the catalogue |
| Operations | Hashed session tokens, expiry/revocation; idempotency records, outbox, leased jobs, admin audit events, migration versions |

Existing IDs include non-UUID seed/legacy identifiers. Use text IDs initially,
or an explicit verified mapping; do not force a UUID schema that drops them.
Historical deleted-message references need nullable/tombstone treatment, not
unconditional FK rejection or silent deletion.

Retain synchronous response shapes while swapping storage. Cursor pagination and
smaller realtime events are a coordinated **later client/API contract change**:
never silently truncate `/api/community`, pack search or message history.

### Sessions and account lifecycle

- Keep cookie behavior compatible; persist a hash of each random session token,
  user ID, creation/expiry and revocation timestamps. Bound cleanup of expired rows.
- Move scrypt to the asynchronous API with bounded hashing work; preserve hash
  verification and support future upgrades on login. Bound all credential inputs.
- Rate-limit login/register, mutations, upload bytes and expensive preview/ZIP
  operations with explicit 429/Retry-After semantics; define trusted proxy handling.
- Preserve admin authorization, record privileged actions and introduce stronger
  admin authentication before broad public access. Password reset/account recovery,
  abuse reporting and data deletion need owner-approved workflows; do not invent
  an email identity model without deciding how addresses are verified.
- Production must not auto-create usable demo logins. Existing seeded identities
  may own real data: migrate ownership intact, then deliberately disable/reset
  credentials with an approved recovery path. First remove startup's required-demo-
  account coupling; do not simply delete accounts that initialization expects.
- Database/session failures fail closed. No fallback to anonymous or an in-memory
  session store in production.

### Media lifecycle and access

Implement these lifecycle rules first with a private Render disk adapter.
The object-specific parts describe the later storage adapter, not an immediate
external-service dependency. Preserve the same readiness, integrity and access
requirements on both adapters; local filesystem/SQL writes are also not atomic.

1. Authenticate and reserve an upload intent with owner, expected type/size,
   immutable random object key and expiry. Enforce per-file and account quotas.
2. Initially stream through the existing API contract to private storage. A later
   resumable/direct-upload flow needs explicit client contracts, tightly scoped
   upload URLs, checksums and completion validation; do not expose storage keys.
3. Keep uploads quarantined until actual bytes, size, decoder metadata and
   appropriate image/media scanning pass. Filename extension and client-reported
   duration/Content-Type are not authoritative validation.
4. Worker validates within CPU/memory/time/temp-disk limits and writes immutable
   derived assets keyed by source version + processing version + preview length.
5. Transaction marks assets ready and makes the release publishable. Pending or
   failed assets return explicit state/errors, never a playable success fallback.
6. Publish checks membership, owner, audience, readiness, licence and aggregate
   size atomically. Existing 100 MiB audio / 10 MiB image / 50-item / 500 MiB pack
   limits remain unless separately approved.
7. Original/preview/archive delivery rechecks current permission before starting
   each request. Preserve Range/206/416, content disposition, cache boundaries,
   cancellation and the guest clipped-file guarantee.
8. Delete via tombstone + retryable cleanup jobs. Reference-check shared artwork
   and assets before physical deletion. Expire unclaimed uploads and generated
   archives; reconcile database references against object manifests.

**Revocation decision:** start with API-authorized proxy delivery for protected
originals and archives, preserving request-time checks. Signed download URLs are
bearer access until expiry and can remain usable after a grant is revoked.
Do not switch to them without accepting a documented revocation window and
testing provider behavior. Neither method recalls already downloaded bytes or
guarantees interruption of a transfer that was authorized before revocation.
Guest previews must always reference a clipped object, never an original with a
client-side playback limit.

Media-store and database writes are not one atomic transaction. Use explicit
pending/ready/deleting states, checksums, retries and reconciliation to recover
every crash point. Never acknowledge a ready upload whose verified bytes are
missing. Before generating/downloading an archive, bind it to a pack revision and
recheck current access; edits/revocation must not expose stale unauthorized files.

### Jobs, realtime and push

- Commit durable outbox/job records with the domain change. Lease jobs with
  bounded attempts/backoff and a dead-letter/inspection path. Assume at-least-once
  execution; use deterministic asset keys and deduplication for effects.
- At launch, a PostgreSQL-backed queue avoids another mandatory service. Evaluate
  a maintained queue library versus a small lease-table implementation in the POC;
  include lease expiry, worker death, fencing and cleanup before selecting.
- WebSocket connections remain local, but events must reach all API instances.
  PostgreSQL LISTEN/NOTIFY may wake listeners; it is **not** the durable queue.
  Each API instance needs its own event cursor/fan-out semantics; a single
  competing-consumer outbox claim cannot deliver the event to every instance.
  Reconnect must resynchronize authorized state after missed notifications.
- Add socket heartbeat, connection limits and buffered-send thresholds; disconnect
  slow consumers rather than accumulating unbounded snapshots.
- Preserve logout/expiry closure across instances. Recheck session revocation on
  events or through bounded polling/invalidation; a socket established before
  revocation must not retain indefinite access.
- Push retries may duplicate a notification after a crash. Use a stable event/tag
  for collapse where supported; do not promise exactly-once push delivery.
  Do not log endpoints, keys, message bodies, cookies or signed URLs.

## 4. Production backlog and release gates

Priorities here describe implementation order, not vulnerability severity.

| Phase | Deliverable | Exit gate / dependency |
| --- | --- | --- |
| P0a: operational guardrails | Disable new demo credentials in production safely; bounded async auth; rate/body/socket limits; trusted origins/proxy handling; centralized safe errors/request IDs; startup config validation; least-privilege runtime | Tests cover failed dependencies and malformed inputs; no sensitive logs; actual Node/Linux image tested. Existing routes and access tests stay green |
| P0b: transactional state | Render Postgres, domain repositories, versioned schema migrations, sessions, atomic command paths and uniqueness/revision controls | Failed writes invisible; concurrent operations do not lose updates; restart and isolated two-instance session tests pass. No mixed JSON/DB production authority |
| P0c: durable media | Private Render disk adapter, verified asset lifecycle, bounded local media runner, outbox/reconciliation, quotas, protected range delivery | Worker kill/retry and partial upload tests pass; no public original leakage; classification/access matrix and orphan/deletion tests pass; disk-backed service limitations accepted |
| P0d: operations and recovery | Readiness/liveness, metrics, alerts, shutdown drain, backups/retention, tested restores, CI and immutable releases | Restore complete metadata+media in a fresh environment within approved targets; rollback rehearsed; no launch without monitoring owner/runbooks |
| P1: bounded read/realtime scale | Indexed queries, pagination migration, smaller events, multi-instance fan-out and slow-consumer handling | Agreed fixture/load envelope passes without permission regressions or connection-pool exhaustion |
| Launch gate | All P0 work plus the P1 items needed for the chosen workload | Owner accepts recovery/cost/region policies; staging soak, permission suite, image tests, migration dress rehearsal and rollback evidence signed off |

Do not horizontally scale API traffic until transactional storage, shared sessions,
cross-instance invalidation and shared media storage are complete. Render's
disk-backed service must remain single-instance even after database migration.
The two-instance POC uses isolated storage-independent routes to prove DB/session
semantics; it is not permission to scale the live disk-owning service.

Operational acceptance details:

- Keep `/api/health` compatible as liveness; add a separate readiness check for
  database/schema and required configuration. Readiness is false while draining.
  Do not make optional push availability a general outage, or run expensive media
  work/object downloads on every health probe.
- Set explicit upload/header/request/idle timeouts aligned with ingress and object
  storage limits. On SIGTERM stop admission, drain bounded HTTP work, close sockets
  with reconnect guidance and release worker leases before an enforced deadline.
- Structured logs: request ID, route template, status, duration, safe error code.
  Metrics: p95/p99, event-loop lag, RSS, pool waits, job age/failures, media errors,
  storage bytes, socket counts/send backlog and backup age.
- Gate releases on backend functional tests, dependency/image scanning, migration
  tests, contract tests and the deployment Node LTS. Use non-root runtime and
  explicit writable temp locations; pin/rebuild images and ffmpeg on a policy.
- Configure TLS, security headers appropriate to PWA/media, exact allowed origins,
  secret management/rotation and a documented browser mutation-origin/CSRF policy.
  A security-focused review remains a separate required launch activity.
- Retention and deletion cover messages, profile data, session rows, download
  history, logs and backup expiration. Define moderation/takedown and support
  ownership before public registration is unrestricted.

## 5. Migration, cutover and rollback

1. Inventory schema version and media references from an approved snapshot,
   not the running app's mutable files. Hash/record the snapshot and file manifest;
   never copy credentials/content into repository fixtures.
2. Make a raw backup **before** calling existing initialization/migrations, which
   rewrite data. On isolated copies, validate schema 2-7 behavior; reject unknown
   or unversioned data with an actionable report rather than resetting it.
3. Import into an empty isolated database and private media directory (an object
   prefix in the later storage phase). Preserve IDs, existing password hashes and
   salts, ownership, order, grants, timestamps, track request replay mappings,
   A-List decisions, message/unsend state and independent share histories.
4. Reconcile duplicated sender/recipient message records by stable IDs and report
   mismatches. Reproduce old case/name normalization and crate deduplication
   intentionally. Broken references/missing bytes must appear in an import report;
   no silent discard or broad defaults.
5. Verify per-domain counts, relational integrity, asset sizes/checksums and
   fixture snapshots for multiple authorization personas. An importer rerun must
   either be safely resumable by migration ID or refuse a nonempty target.
6. Rehearse restore and time the import/media transfer with representative sizes.
   Define an approved maintenance window from those measurements.
7. At cutover, stop/drain every JSON writer, pause workers, take final snapshots
   and manifests, run the verified import and compare again. Do not copy a live
   JSON file while writes continue. Switch backend authority once; no production
   dual writes or automatic fallback to JSON. On Render, keep the disk mounted
   in the runtime and block mutations with maintenance mode during the import;
   a pre-deploy command or separate one-off job cannot read that disk.
8. Run login, browse/search, upload, publish, share/revoke, message, original/range,
   preview and ZIP canaries before admitting public writes. Existing in-memory
   sessions cannot be migrated: explicitly plan one-time reauthentication.
9. Keep the old image and encrypted snapshot read-only for a bounded rollback
   period. Before new writes are admitted, rollback can restore the old system.
   **After DB writes begin, restoring old JSON loses new data.** Roll back only to
   a database-compatible previous build, or freeze traffic and use a rehearsed
   reverse migration/reconciliation. If neither exists, forward-fix.

Do not run `dev:purge` as a migration, cleanup or production reset.

## 6. Proof-of-concept status and remaining scope

### First objective

Prove **Render Postgres transactions + persistent sessions + private Render-disk
media lifecycle** in an isolated environment before converting every route.

The Stage A entrypoint is the opt-in
[harness CLI](../apps/api/spikes/stage-a/cli.mjs), using synthetic data and a
strictly named disposable database. It binds to loopback, not a Render public
port; no Render resources are provisioned by this harness. It does not activate
the normal server's separate PostgreSQL mode or change deployment settings.
Never offer partially migrated routes against real
JSON/DB state. Stage B adds an isolated private media directory; no staging disk
or live resource is provisioned automatically.

Stage A (implemented):

- `pg` connection/configuration seam; migration runner and synthetic fixtures.
- Users/artists + hashed sessions + crates/ordered items + idempotency/outbox rows.
- Login, logout, session validation and crate create/read/rename/membership.
- Two local/test API instances over one disposable Render Postgres database for
  storage-independent routes; no sticky-session requirement.
- First reproduce the three failure experiments above, then show that the
  transactional implementation prevents each undesired outcome.

Verification: **12/12 Stage A tests passed** against real disposable PostgreSQL
18.6 on Windows/Node 26.13.0. The suite demonstrates 100 acknowledged writes
across two API instances surviving an API/connection-pool restart, shared hashed
sessions, cross-instance expiry/logout, concurrent idempotent retries and an
actual deferred constraint failure at COMMIT leaving no crate, retry record or
outbox event. It also checks ordered synthetic membership, owner isolation,
safe dependency errors and migration guards. The latest default API validation is
**39/39 tests** (the original 37 plus config/private-disk guard tests).

This does not validate Render networking, the chosen Render PostgreSQL version,
Node 22/Linux images, host/Postgres crash recovery or performance targets.
The restart test restarts the API/pool, not the database host. Temporary PostgreSQL
tooling was used outside the repository and the test cluster was stopped/removed.
There is no full community snapshot, socket endpoint, outbox delivery consumer,
session/replay retention sweeper, registration or production data importer yet.
Database-free checks run in the default suite; real integration tests require
explicit `spike:test` configuration and do not silently skip a missing database.

Stage B (implemented representative audio/permission slice):

- Private disk adapter, upload intent/completion and one bounded local runner.
- Minimal dubs/packs/items/grants with publish, direct/pack access and guest preview.
- Authenticated proxy range/download and revision-bound archive preparation.
- Worker crash/retry, orphan reconciliation and revoked-access checks.
- Message+grant+outbox transaction test before extending all Messenger routes.

The [Stage B CLI](../apps/api/spikes/stage-b/cli.mjs) and
[usage instructions](../apps/api/README.md#stage-b-private-media-proof-of-concept)
provide loopback-only `spike:media`, due-job `spike:work` and explicit
`spike:reconcile` commands. Migration 002 is additive to the unchanged Stage A
migration; both updated harnesses verify its checksum. Database/filesystem naming
guards and a matching marker prevent implicit use of community storage.

Verification: **17/17 Stage B tests passed**, alongside **12/12 Stage A tests**,
using real temporary PostgreSQL 18.6, actual audio/ffmpeg and private synthetic
disk files on Windows/Node 26.13.0. Tests cover aborted uploads, invalid-content
retries, a killed job claimant, lease expiry/fencing, canceled processing,
30-second guest bytes versus original bytes, HEAD/ranges, exact ordered two-track
ZIP contents, publication/terms, private/A-List access, confirmed access changes,
independent grants, revision invalidation, quotas, tampering and orphan cleanup.
A deferred constraint failure verifies message, recipient grant and both outbox
events roll back together. Stage B itself does not activate the normal API's
separate compatibility store or change the deployed service.
Additional failure checks verify the global two-lease cap and preserve committed
preview files when the completion commit acknowledgment is lost.
The Stage A suite also exercises an actual version-1-to-2 upgrade with preserved
existing crate data.

Security is a high-priority acceptance condition: quarantined assets cannot
publish, unauthenticated callers cannot download originals/ZIPs, non-loopback
hosts/foreign mutation origins fail, and new media requests recheck current
access. Jobs have three attempts, 120-second fenced leases, at most two active
leases, bounded processing children and immutable attempt outputs. Never expose
the synthetic identities or harness publicly.

Remaining limits: audio only (no artwork/avatar/banner validation); minimal
catalogue and friend message flow, not full app/Messenger integration; no real
domain import or published-track replacement/deletion; no archive TTL/complete
storage quota policy, production supervision/rate controls or OS sandbox.
The child heap/thread/allocation/deadline limits are not container isolation.
Render/Linux/Node 22, database-host crash/power-loss recovery, actual mid-encode
host termination and backup restores remain unverified. A killed lease claimant
and canceled processor are not evidence of those stronger recovery guarantees.
Stage A crates remain backed by their synthetic fixture catalogue, separate from
Stage B media. Stage C/object storage and other providers remain later scope.

Render staging preparation is now available in the
[isolated staging runbook](../apps/api/spikes/staging/README.md), separate from
the live Dockerfile/Blueprint. It targets the existing 0.5 CPU / 512 MB compute
tier, not an approved capacity estimate or permission to provision resources.
Health-only public ingress, loopback-only synthetic API, bounded admission,
single-worker supervision and a paused backup state are implemented. Linux,
Render deployment, whole-container capacity, backup/restore and security review
remain unverified gates; no real records or infrastructure have been changed.

The normal web/admin API now also has a separately opted-in
[transactional PostgreSQL compatibility mode](../apps/api/README.md#full-webadmin-postgresql-compatibility-mode).
This preserves existing frontend contracts using ordered JSONB domain records
and hashed SQL sessions; it does not switch the app to the A/B normalized schema
or import live data. Commit-before-response and post-commit effects are wired
through existing routes. Real PostgreSQL integration and built-client browser
checks pass locally. Read-all/collection rewrite costs, single-instance socket
fan-out, non-durable dispatch, legacy media processing, recovery/security gates
and deliberate cutover still limit production readiness.

Stage C (later scope, not required to start):

- Private object-storage adapter and separate Render media worker.
- Validate shared media access, migration off the disk, multi-instance fan-out and
  zero-downtime deployment before scaling the API. Compare other hosting providers
  only if a measured requirement justifies reopening that decision.

These stages do not claim the entire backend has migrated. The remaining domain
routes must move together at production cutover, with compatibility coverage.

### Proposed seams and dependencies

| Seam | Required behavior for POC |
| --- | --- |
| `unitOfWork.run(command)` | One transaction/connection; no commit means no authoritative mutation or outbox event |
| `sessionStore` | Issue opaque cookie token, persist only its hash, authenticate/expire/revoke across instances |
| `mediaStore` | Put/stat/range-read/delete immutable assets on an isolated private disk first; record real size/checksum; cancel streams; add object adapter later |
| `jobStore` | Transactional enqueue, lease/renew/reclaim, attempt limit, completion fence and terminal failure |
| `eventDelivery` | Durable event IDs, per-instance fan-out/reconnect resync; no private data in NOTIFY payloads |
| `migrationTool` | Dry-run validation/report, schema versioning, manifest checks and explicit cutover ownership |

Stage A now uses `pg`; an object SDK belongs to the later object-adapter change.
Avoid introducing an ORM, Redis, a framework
or cloud resource merely for this assessment. Any PostgreSQL queue library is a
decision to validate, not a package already selected.

POC configuration (only the opt-in harness, never the normal server):

```text
SPIKE_DATABASE_URL        disposable Render Postgres database, never production
SPIKE_RUN_ID              unique run identifier used to validate fixture isolation
SPIKE_PORT                optional local HTTP port; defaults to 3002
SPIKE_MEDIA_DIRECTORY     Stage B absolute private directory named cre8_spike_<run ID>
```

Object-store endpoint/bucket/region/prefix settings are deferred to Stage C.
Use environment/secret injection, not committed values. Test database credentials
must be scoped to the disposable resources. Refuse missing isolation markers;
never default these settings to existing `COMMUNITY_*` paths.

### Acceptance matrix ready for implementation

| ID | Scenario | Measurable pass condition |
| --- | --- | --- |
| T01 | Commit failure/DB unavailable | Non-success response, zero committed rows and zero published success events; later read/restart agrees |
| T02 | Two-instance concurrent writes | 100 distinct acknowledged crate writes remain after restart; collisions produce explicit conflict/unique handling, not lost rows |
| T03 | Session restart/routing | Same cookie works on both instances and after restart; expired/revoked cookies fail on both and affected sockets close |
| T04 | Retry/idempotency | Same actor/key/request yields one logical mutation; different payload with reused key conflicts; new keys permit intended repeated actions |
| T05 | State/permission matrix | Owner, recipient, unrelated member, approved/unapproved A-List and guest observe existing expected visibility across snapshot/search/share/message/media/ZIP |
| T06 | Classification | Published Sample Pack membership classifies a sample; draft membership alone does not; independent dub grant survives pack grant revocation |
| T07 | Upload interruption | Abort at several offsets; no ready asset without verified bytes, bounded staging residue, eventual cleanup |
| T08 | Decoder/job failure | Invalid bytes never publish; worker timeout/kill and lease expiry retry safely; stale worker cannot complete a superseded lease |
| T09 | Media correctness | Verify checksum/size; seek/range responses and full-file length; guest clip is <= configured length without original-byte delivery |
| T10 | Concurrent edit/revoke | New requests after committed revocation cannot obtain originals/archives; stale queued pack revisions are rejected or rebuilt |
| T11 | Message atomicity | Message, recipient visibility/grant and outbox all commit or all roll back; a worker crash does not lose the event |
| T12 | Shutdown/backpressure | Drain within an initially proposed 30-second deadline; no acknowledged write lost, no unbounded socket buffers, canceled streams release resources |
| T13 | Import/restore | Counts, IDs, grants, order and checksums match manifest; Render Postgres restore plus recovered disk assets meets approved RPO/RTO and authorization checks |
| T14 | Load/soak | Proposed envelope in section 2 sustained for 60 minutes; meet latency/error targets, report peak RSS/pool waits/job lag; no monotonic leak after steady state |
| T15 | Compatibility | Existing 37 API tests still pass; affected app tests pass; all production routes use one authority before launch |

Download events currently count an authorized request **before** transfer, not
confirmed receipt. Keep that meaning in the migration. Idempotency suppresses
retries with the same explicit key; it must not suppress distinct intentional
repeat downloads. Existing pack-track replay protection must not be regressed.

### POC prerequisites and stop conditions

Before staging deployment or extending Stage B (local Stage A/B validation is complete):

1. Approve test envelope, recovery targets, budget ceiling and initial region.
2. Approve a disposable Render Postgres database and isolated temporary media
   paths; use a separate Render service/disk for deployment and recovery checks.
   Docker/`psql` are not currently available on this machine; a Node `pg` client can
   exercise the staging database once dependencies are added. Never substitute
   the existing production database or disk to bypass missing tooling.
3. Validate the supported Node LTS/container; extend the versioned SQL migrations
   and select media queue tooling.
4. Prepare synthetic fixtures only: private/public/restricted A-List releases,
   sample/dub overlaps, draft tracks, two chat participants, duplicate retries,
   small valid audio/images and deliberately invalid media.
5. Provision no live resources or credentials without separate approval.

Stop and report if tests point at non-isolated resources, an import cannot
reconcile references, access semantics change unintentionally, or a proposed
dependency requires unacceptable recovery/cost assumptions. A failed dependency
must not trigger a permissive fallback.

Suggested implementation order: Stage A transaction/session proof, then Stage B
disk media/permissions, then a reviewed migration implementation. Stage C is later
scope, not a prerequisite for the Render-first POC. Do not add a generic
repository abstraction to every route before the first transaction is proven.

## 7. Re-running the current baseline

From the repository root in PowerShell, with production seed/push configuration
absent from the test process:

```powershell
node --test apps\api\test\admin-seed.test.mjs apps\api\test\audioPreview.test.mjs apps\api\test\packs.test.mjs apps\api\test\purge.test.mjs apps\api\test\push-worker.test.mjs apps\api\test\push.test.mjs apps\api\test\server.test.mjs
node --check apps\api\src\server.mjs
node --check apps\api\src\audioPreview.mjs
node --check apps\api\src\push.mjs
node --check apps\api\src\zipStore.mjs
```

Existing tests use temporary directories/ports; pack fixtures use uniquely named
test directories, not the shared community JSON. These commands do not execute
the future POC, restore infrastructure, or establish performance capacity.

## 8. Outstanding decisions

- Region, monthly budget ceiling and who owns on-call/incident response.
- Actual stream bitrate/concurrency, upload quota and storage retention.
- Whether a day of independent-backup media loss is acceptable; price stricter
  replication/backup before promising 15-minute recovery for originals.
- Render compute/Postgres/PITR tier, accepted disk-backed deployment downtime and
  proof of restore, not just a backup checkbox. Hosting remains Render for now.
- Account recovery, admin stronger authentication and retirement of demo access.
- Acceptable signed-URL revocation window if proxy delivery is later replaced.
- Isolated Render POC resources, backup destination and queue implementation.
- Later: storage-scale trigger, object-store choice and whether measured needs
  ever justify comparing other compute/database providers.

## References

- [Current API deployment guidance](../apps/api/README.md#render-demo).
- [Render persistent disk constraints](https://render.com/docs/disks#disk-limitations-and-considerations)
  (single-instance access, deployment downtime and runtime-only disk access).
- [Render Postgres recovery](https://render.com/docs/postgresql-backups):
  paid-database PITR, plan-dependent retention and restore into a new instance.
- [Render private networking](https://render.com/docs/private-network):
  same-workspace/region internal connections; workers cannot share service disks.
- [PostgreSQL continuous archiving and PITR](https://www.postgresql.org/docs/current/continuous-archiving.html):
  WAL plus a base backup enables recovery; a logical dump alone is not PITR.
- [PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html):
  notifications are delivered after commit and payloads are visible to database
  listeners; keep durable event data in tables.
- [S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html):
  time-limited bearer access, upload overwrite behavior and checksum support.
  Verify equivalent behavior on any S3-compatible alternative.
