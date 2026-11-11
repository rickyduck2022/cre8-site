# Render staging preparation

This is an opt-in **synthetic-only** deployment, not the community API and not
Stage C. Nothing is provisioned automatically. The live `render.yaml`,
`Dockerfile`, JSON data and media are unchanged.

## What is prepared

- [Separate image](../../../../Dockerfile.staging): Node 22 on Debian, system
  ffmpeg, non-root runtime, no frontend build or live API entrypoint. Dependency
  install scripts are disabled; the image uses system ffmpeg instead of
  downloading ffmpeg-static's binary.
- [Separate Blueprint](../../../../render.staging.yaml): one 0.5 CPU / 512 MB
  service, manual deployments and a separate 1 GB disk. This matches the stated
  compute tier, **not an approved capacity or spending estimate**. A separate
  paid Postgres instance and disk add cost; the existing service's allocation is
  not spare capacity for staging.
- Public ingress serves only `GET/HEAD /api/health`. Every other path/method is
  404; it never proxies the harness. Health probes are cached, fail closed on
  dependency errors/staleness and expose no database, queue or media details.
- The harness binds only `127.0.0.1:3002`. Use an approved operator shell or
  authenticated tunnel; never publish/proxy that port. Synthetic passwords are
  intentionally public and provide no perimeter protection.
- Exactly one supervised worker in this entrypoint, within the disk-owning
  service; no separate disk-sharing Render worker. Underlying Stage B retains
  its two-lease global ceiling for its standalone tests/tools. Do not start
  additional workers or harness processes alongside staging.
- Process-local admission: two active requests, one active login and one active
  upload; 120 admitted requests and five admitted logins per fixed minute.
  Rejection is 429 with `Retry-After`, before database work. Slots release on
  response completion/disconnect. Limits are aggregate, not per user/IP, and
  restart with the process; they are **not production abuse protection**.
- Main Node heap defaults to 96 MiB; processing children retain their 128 MiB
  V8 cap. These are not total RSS limits or an ffmpeg sandbox. Main-process
  RSS/heap samples log every 30 seconds; measure total container memory,
  descendants, CPU and OOMs through the hosting platform as well.
- Shutdown marks readiness unavailable, aborts the active worker, closes HTTP
  connections and waits before closing Postgres. Process deadline: 85 seconds;
  configured platform grace: 90 seconds. SIGKILL/OOM can bypass shutdown; durable
  leases, not graceful shutdown alone, must recover the job.

## Preparation checks

From the repository root, on Windows:

```powershell
pnpm.cmd --filter @craft/api spike:test:staging
pnpm.cmd --filter @craft/api test
```

Once Docker is available, before any Render sync:

```powershell
docker build -f Dockerfile.staging -t cre8-backend-staging .
docker run --rm --cpus=0.5 --memory=512m --pids-limit=64 --cap-drop=ALL --security-opt=no-new-privileges --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m cre8-backend-staging node --test apps/api/spikes/staging/staging.test.mjs apps/api/spikes/stage-a/config.test.mjs apps/api/spikes/stage-b/disk.test.mjs
```

The Docker restrictions above are local verification settings, **not a claim
that Render applies equivalent per-child isolation**. Do not enable public
uploads until a dedicated review establishes an adequate processing boundary.

Current evidence: seven staging tests pass locally on Windows/Node 26, plus the
existing config/disk checks; the default API suite passes 46 tests. Docker is
not available locally, so the image, Linux/Node 22, real shutdown timing, Render
disk ownership and this compute tier's capacity remain unverified. Earlier real
PostgreSQL Stage A/B results remain documented separately; they were not rerun
against Render or the staging supervisor.

## Approval and bootstrap

1. Approve a **separate** staging service/disk and disposable Render Postgres,
   their common region, budget ceiling and retention/recovery objectives.
   Do not sync this Blueprint onto the live service. No database is declared in
   the template: database provisioning requires its own approval.
2. Name the disposable database `cre8_spike_render_stage`. Configure its secret
   connection in Render's environment settings as `SPIKE_DATABASE_URL`, with
   `sslmode=verify-full` and a trusted certificate chain. Never weaken TLS to
   bypass a connection failure. The harness does not use `DATABASE_URL` or
   `COMMUNITY_*`. Never paste credentials into chat or commit them.
3. Before starting the service, use an approved Node 22 operator environment
   with those same isolated settings to run, in order:

   ```powershell
   pnpm.cmd --filter @craft/api spike:migrate
   pnpm.cmd --filter @craft/api spike:seed
   pnpm.cmd --filter @craft/api spike:seed:media
   ```

   `SPIKE_RUN_ID=render_stage` is required. These commands do not migrate live
   JSON or reset existing fixture passwords. Migrations run explicitly, not on
   every service startup. Missing/drifted schemas fail startup closed.
4. Validate the Blueprint against Render's current schema and select the
   approved region before syncing. The template disables automatic deploys and
   starts with `SPIKE_STAGING_PAUSED=true`.
5. Verify the non-root runtime can write **only the separate mounted media
   directory** `/var/data/cre8_spike_render_stage` and create its matching marker.
   Fail and correct the mount's ownership if it cannot; do not switch to root,
   grant world-write permissions, reuse live storage or remove marker checks.
6. Confirm public health becomes `{"status":"paused"}` and every other public
   route remains 404. Pause starts neither the harness listener nor worker.
   After approval to exercise fixtures, set `SPIKE_STAGING_PAUSED=false` and
   manually deploy; health should become `{"status":"ready"}`.

## Restart, recovery and migration rehearsal

Use synthetic media only. Record image digest, Node/ffmpeg/Postgres versions,
migration checksums, timestamps and redacted outcomes; never record tokens,
passwords, full connection URLs or message text.

| Drill | Required evidence before accepting staging |
| --- | --- |
| Restart | Sessions and acknowledged domain writes survive a service restart; no duplicate command/outbox write |
| Interrupted processing | Kill the service mid-encode, restart, wait for the 120-second lease to expire; a new token completes once, stale output never publishes |
| Dependencies | Database outage, exhausted disk headroom and permission failure produce explicit errors/unavailable health; no original/preview fallback |
| Permissions | Repeat private/A-List/guest denial, grant revocation and stale archive checks on Linux and real media |
| Capacity | Representative uploads, decode, ZIPs, ranges and login traffic together; measure whole-container peak RSS, CPU, latency, disk and retries, not just Node heap |
| Recovery | Restore a coordinated database/media backup to fresh isolated resources and verify checksums, references, sessions, grants and actual downloaded bytes |
| Upgrade/rollback | Upgrade schema 001 to 002 with preserved records; a mismatched older image refuses startup. Demonstrate forward repair or full paired restore, not SQL downgrade |

For a coordinated logical backup:

1. Deploy with `SPIKE_STAGING_PAUSED=true`, verify `paused` health and no
   separately started CLI/tunnel writers or workers. Wait for the previous
   process to terminate; pause is a deployment state, not an instantaneous
   request barrier. Keep the service paused throughout capture.
2. From an approved operator environment, use `pg_dump` of the same/newer major
   version than the server. Configure staging-only `PGHOST`, `PGPORT`, `PGUSER`,
   `PGDATABASE`, `PGPASSWORD` and verified TLS through secret settings, not
   command-line URLs. In that environment (POSIX shell):

   ```sh
   test "$PGDATABASE" = cre8_spike_render_stage || exit 1
   test "$PGSSLMODE" = verify-full || exit 1
   pg_dump --format=custom --no-owner --no-acl --file=stage-db.dump
   ```

3. In the **paused disk-owning service's operator shell**, archive
   `/var/data/cre8_spike_render_stage`, including `.cre8-spike`. Export it using
   the approved secure operator transfer mechanism and record its SHA-256 next
   to the database dump's. Disk contents are unavailable to pre-deploy/build/
   one-off jobs. Do not put backups on that same disk or in source control.
4. Restore only into a new, empty, separately approved database instance and
   disk. Reuse the database name/run ID and exact mount path in that isolated
   environment so the marker stays intact; never rewrite it to bypass a guard.
   Confirm the target hostname/resource identity differs from the source before
   any restore. Use `pg_restore --exit-on-error --single-transaction --no-owner
   --no-acl --dbname="$PGDATABASE" stage-db.dump` with the **target's** secret
   PG settings and the same database-name/TLS guards above. Do not use `--clean`.
5. Restore the matching media archive only to that new disk, preserve file
   ownership/modes, verify backup checksums and start the same image paused.
   Verify schema checksums, then unpause and test media integrity/access and job
   recovery. Keep the source untouched. Delete only explicitly approved
   disposable resources after evidence is captured.

Independent database PITR and daily disk snapshots are not automatically a
consistent cross-store restore. Measure achievable RPO/RTO rather than assuming
provider retention equals an application recovery guarantee.

## Still blocked before production

No staging resources, spending, migration of real records or production cutover
are authorized by this preparation. Linux/image execution, recovery drills,
capacity/soak results, external alerting, dedicated security review and adequate
OS-level media isolation are outstanding. Full application/API compatibility,
outbox delivery, complete quotas and non-audio validation also remain outside
the current slice. Stage C/object storage remains deferred.
