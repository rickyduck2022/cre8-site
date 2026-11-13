# Getting started

[Handbook](README.md) / Getting started

## Prerequisites

- Node.js 22 is the reference runtime in the [Dockerfile](../../Dockerfile).
- pnpm 9.15.4 is pinned in the root [manifest](../../package.json). Use Corepack
  where available, or install that pnpm version through your normal tooling.
- Git and a modern browser. FFmpeg is provided by the API's `ffmpeg-static`
  dependency locally; an existing executable can be selected with `FFMPEG_PATH`.
- PostgreSQL is optional. Ordinary local development uses JSON; do not configure
  a database just to start the app.

Use `pnpm.cmd` in Windows PowerShell to avoid script execution-policy problems.
Shell filesystem paths below use Windows separators; Markdown links use `/`.

## Before starting

Inspect `git status --short` and preserve unfamiliar edits. A worktree, development
server and local data may be shared by other sessions. Reuse an existing stack
only after checking its checkout and served build; do not restart another
person's server or purge its data.

## Install and run

From the repository root:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd --filter @craft/tokens build
pnpm.cmd --filter @craft/ui build
pnpm.cmd dev
```

The [orchestrator](../../scripts/dev.mjs) starts three processes:

| Service | Default URL | Notes |
| --- | --- | --- |
| Community web | `http://localhost:5173/` | Vite; proxies `/api` including WebSocket upgrades and `/guides` |
| Admin | `http://localhost:5174/` | Separate Vite app, API session required |
| API | `http://127.0.0.1:3001/api/health` | Node HTTP, local data/media |

`pnpm.cmd dev:api` starts only the API. Despite its name, root `dev:web` currently
starts the same three-service orchestrator as `dev`. Web/admin host and port
overrides belong to the orchestrator; the web API proxy remains configured for
`3001`, so changing the API port alone does not retarget it.

Register a synthetic local account through the app for development. Admin access
requires an API-side allowlist, not a profile role; follow the
[admin setup](../../apps/admin/README.md). Never document real credentials.

## Package resolution and builds

The [web Vite config](../../apps/web/vite.config.ts) aliases `@craft/ui` to source
**only during development serving**, including its stylesheet entry. Normal
package consumers, production builds and app integration tests resolve UI `dist`.
Thus a working dev page does not prove the built UI is current.

After shared UI changes, build before app tests/builds:

```powershell
pnpm.cmd --filter @craft/tokens build
pnpm.cmd --filter @craft/ui build
pnpm.cmd --filter @craft/web build
pnpm.cmd --filter @craft/admin build
```

Rebuild tokens when changed. Icons export source and have no build script.
Root `build`, `test` and `typecheck` use Turbo; prefer the
[smallest relevant check](testing.md). Storybook runs with `pnpm.cmd storybook`
on port `6006`.

## Local data and optional services

JSON defaults to `apps\api\data\community.json`; uploads go to
`apps\api\data\audio`. These are runtime data, not fixtures to edit for tests.
The API also has a seed public-audio directory; use isolated overrides in tests.
Use temporary data/media and synthetic accounts for experiments.

Push needs VAPID configuration and browser support; the app can run without it,
but unconfigured push endpoints explicitly report unavailability. Published video
guides need a separately generated library. Neither setup is required to browse
the app locally.

Do not run `dev:purge`, migrations, imports or synthetic database seeding against
shared data. See [API/storage procedures](../../apps/api/README.md) before any
storage-mode change and [operations](operations.md) before deployment.
