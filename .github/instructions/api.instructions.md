---
description: "Use when changing the Node API, persistence, uploads, media permissions, admin authentication or deployment configuration."
applyTo: "apps/api/**,apps/admin/**,render.yaml,Dockerfile"
---

# API & Deployment

- Keep the API framework-free. Routes live inside `createApiServer` in `apps/api/src/server.mjs`; use existing validation, authorization and response helpers.
- JSON remains the default: local paths are `apps/api/data/community.json` and `apps/api/data/audio`; production uses `COMMUNITY_DATA_PATH` and `COMMUNITY_MEDIA_DIRECTORY`. Explicit `COMMUNITY_STORAGE=postgres` selects the API-compatible JSONB store in `src/communityPostgres.mjs`; require its exact database name/verified remote TLS, migrations and initialization. Never fall back between stores.
- Mutations go through `persist()`: atomic `saveData` in JSON mode, transaction dirty marking in PostgreSQL mode. Preserve request transaction isolation and commit-before-response/cookie/notification/media-deletion ordering through `commitEffects.mjs`; never bypass it with direct shared-state or filesystem mutations.
- JSON sessions use an in-memory Map; PostgreSQL sessions persist token hashes, expiry and revocation. Keep the existing `cre8_session` cookie contract. WebSocket connections/fan-out remain process-local in both modes; the compatibility backend is single-instance, not a distributed notification system.
- The Stage A/B harness schemas and health-only staging runtime are separate from the full web/admin compatibility store. Do not mix their databases, public fixtures or entrypoints. Bootstrap/import and release limits are documented in the API README; use offline copies and empty isolated destinations, never automatic live imports.
- Preserve access checks across snapshots, search, shared links, Messenger attachments, streams and ZIP downloads. Classification is not authorization; public discovery is not evidence that a pack was received.
- Use `createApiServer` with temporary data/media paths and an ephemeral port for tests. Follow existing `apps/api/test/` fixtures; never mutate the shared development JSON to prepare a test.
- Run the relevant suites with Node's test runner, e.g. `node --test apps\api\test\packs.test.mjs apps\api\test\server.test.mjs` when both pack behavior and snapshot/routes change.
- PostgreSQL integration uses `pnpm.cmd --filter @craft/api db:test` with an explicitly configured disposable loopback `cre8_community_test_*` database. It creates failure-injection objects and schema drift; never point it at staging/live community records. Default API tests remain JSON-mode regressions.
- Push configuration uses `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`; unconfigured push endpoints return 503. Do not add success-shaped fallbacks.

## Admin & Hosting

- Admin authorization and account seeding are separate: `ADMIN_USERNAMES` is the authorization allowlist; profile roles do not grant admin access.
- `ADMIN_SEED_USERNAME` and `ADMIN_SEED_PASSWORD` seed an account, never overwrite an existing account/password, and must be configured together. Username must match `^[a-z0-9._-]{3,24}$`.
- Render uses `render.yaml` and `Dockerfile`, one service on port 10000 and persistent storage under `/var/data`. Health endpoint: `/api/health`.
- The API serves built web at `/`, admin at `/admin` and published guides at `/guides`. Seed/configuration changes do not imply existing credentials were replaced.
- Read [admin documentation](../../apps/admin/README.md) and [API documentation](../../apps/api/README.md) for deployment details. Never request, print or commit actual environment secrets.
