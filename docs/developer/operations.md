# Deployment, admin and operations

[Handbook](README.md) / Operations

## Supported shapes and their boundaries

| Shape | Entry/configuration | Purpose |
| --- | --- | --- |
| Local development | [scripts/dev.mjs](../../scripts/dev.mjs) | API + two Vite apps |
| Normal Docker service | [Dockerfile](../../Dockerfile), [render.yaml](../../render.yaml) | Built community/admin, API and published guides |
| Opt-in PostgreSQL compatibility | Normal API with explicit `COMMUNITY_*` settings | Preserve full web/admin contracts with transactional domain/session storage |
| Stage A/B experiments | [API spikes](../../apps/api/spikes) | Isolated synthetic persistence/media proofs |
| Experimental staging | [Dockerfile.staging](../../Dockerfile.staging), [render.staging.yaml](../../render.staging.yaml) | Separate harness, not a full app rollout |

The normal image builds tokens -> UI -> web -> admin, installs system FFmpeg and
starts `node apps/api/src/server.mjs`. It serves web at `/`, admin at `/admin`,
guides at `/guides`, and API at `/api`. The Render blueprint has auto-deploy and
`/api/health`; configuration existing in Git is not evidence that a deployment
succeeded.

## Runtime configuration inventory

Names and purposes only; inject secrets using the service's secret-management
facilities. Never paste connection strings, session tokens or passwords into docs.

| Variable(s) | Purpose |
| --- | --- |
| `PORT`, `API_PORT`, `API_HOST`, `NODE_ENV` | API listener/runtime; `PORT` takes precedence over `API_PORT` |
| `COMMUNITY_DATA_PATH` | JSON state location |
| `COMMUNITY_MEDIA_DIRECTORY` | Uploaded media directory in either compatibility mode |
| `WEB_DIST_DIRECTORY`, `ADMIN_DIST_DIRECTORY`, `GUIDES_DIRECTORY` | Built/static asset locations |
| `COMMUNITY_STORAGE` | Explicit `json`/`postgres` mode; JSON default |
| `COMMUNITY_DATABASE_NAME`, `COMMUNITY_DATABASE_URL` | Exact dedicated compatibility database and secret connection URL |
| `COMMUNITY_IMPORT_PATH`, `COMMUNITY_IMPORT_ACK` | Guarded offline import input/acknowledgment |
| `COMMUNITY_SYNTHETIC_ACK` | Explicit disposable synthetic initialization guard |
| `ADMIN_USERNAMES` | Admin authorization allowlist |
| `ADMIN_SEED_USERNAME`, `ADMIN_SEED_PASSWORD` | Optional paired admin seed; never overwrite existing credentials |
| `WEB_ORIGINS`, `WEB_ORIGIN` | Explicit accepted origin configuration |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional device-push configuration |
| `FFMPEG_PATH` | Override the preview encoder executable |
| `WEB_HOST`, `WEB_PORT`, `ADMIN_HOST`, `ADMIN_PORT` | Local orchestrator Vite listener overrides |

These are not interchangeable with `SPIKE_*` configuration. Refer to the
[API procedures](../../apps/api/README.md) for guard values, TLS rules, bootstrap
and import commands; do not execute them as part of routine documentation checks.

## Storage, migration and recovery

The normal container config puts state/media under `/var/data`, backed by the
Render disk in the blueprint. PostgreSQL compatibility still owns media on disk;
do not scale the API horizontally or assume shared socket fan-out.

For a storage change:

1. Establish the exact running entrypoint, mode, database and media paths without
   printing secret values. Stop if staging/live/disposable scope is ambiguous.
2. Plan an offline, coordinated backup of metadata and media; test restoration to
   an isolated destination. A metadata-only backup is not a working media restore.
3. Use a dedicated empty target and the guarded migration/inspection/import
   procedures. Do not import a live changing source or silently fall back to JSON.
4. Validate account access, sessions, grants, streams, ZIPs, admin and restart
   recovery against the isolated result.
5. Approve cutover and rollback separately. Starting a server or passing a health
   route is not sufficient validation of migration or durability.

Filesystem bytes and database commit are not atomic together. Post-commit deletion
reduces premature loss but does not eliminate crash or uncertain-commit orphans.
Keep reconciliation and paired restore drills as release gates.

## Admin

The [admin README](../../apps/admin/README.md) is authoritative for local setup,
hash routes and review journeys. The console is separately built, uses the API
session cookie and has no separate credential store.

`ADMIN_USERNAMES` is the authorization source; editable roles do not grant admin.
Seeding and authorization are separate. A seed creates an absent account only,
does not rotate its password, and rejects username collisions or incomplete
configuration. Review/revocation confirmations and access decisions are persisted.

## Push, PWA and guides

- Device push requires service-worker support, configured VAPID keys and HTTPS
  (or localhost). iOS/iPadOS require installation. Unconfigured endpoints return
  explicit unavailability; delivery is best-effort and can expose notification
  text on lock screens.
- Production PWA caches shell/static assets, not API responses, messages, uploads
  or audio. It does not queue offline writes. Applying an update reloads the app
  and stops playback. Vite development does not enable service workers.
- Published guides are generated artifacts. An unbuilt guide library returns
  `404`; follow [record/publish instructions](../guides/README.md).

## Release readiness

Read the dated [backend assessment](../backend-production-spike.md) alongside the
current API implementation; its original observations are historical, not a
blanket description of current PostgreSQL guarantees.

Before public cutover, require current functional/access regressions, target
Linux/Node runtime checks, resource/soak evidence, coordinated backup restores,
appropriate abuse controls and a dedicated security review. `/api/health` currently
returns a simple status; it is not proof of DB/media recovery or push delivery.
Database transactions alone do not add durable push, distributed sockets, object
storage or Stage B's job system to the normal service.

Document actual validation outcomes and unresolved failures for the exact release.
No deployment, migration, import, reset or credential change should be performed
merely because a documentation example exists.
