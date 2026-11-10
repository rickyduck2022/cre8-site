# cre8 — Project Guidelines

cre8 is a music community app for dubs, samples, packs, messaging and A-List access. It uses a pnpm + turbo monorepo, React front ends and a framework-free Node API.

## Repository Layout

| Path | What it is |
|------|------------|
| `apps/api` | Entire backend in one file: `src/server.mjs`. Plain Node `http` server (no Express/framework), ESM `.mjs`. Only deps: `ws`, `web-push`, `ffmpeg-static`. |
| `apps/web` | Community app (React + Vite). Source split into `app/`, `components/`, `features/`, `hooks/`, `services/`. |
| `apps/admin` | Admin console (React + Vite), served at `/admin`. Styles in `src/admin.css`. |
| `packages/ui` | `@craft/ui` — shared component library, atomic design: `foundations/ → atoms/ → molecules/ → organisms/ → templates/`. Has Storybook. |
| `packages/tokens` | Design tokens (CSS custom properties, `src/theme.css`). |
| `packages/icons` | Icon components. |
| `scripts/dev.mjs` | Dev orchestrator. `scripts/video-guides/` records/publishes the video guide site. |

## Working Safely Across Sessions

- Inspect `git status --short` and relevant diffs before editing. Other sessions may share this worktree: preserve unfamiliar edits, reread overlapping files, and stop for clarification if changes conflict.
- Reuse a responsive dev stack when available; do not restart shared servers or terminate processes you did not start without agreement. Verify which checkout/build a server serves before trusting it.
- Use isolated temporary data/media directories for destructive API tests. Never run `dev:purge` against shared data without explicit approval.
- Do not read credential scratch files or include secrets in code, logs, documentation or commits.

## Build / Test / Dev

- `pnpm dev` starts API (`:3001`), web (`:5173`) and admin (`:5174`); Vite proxies `/api` to the API.
- `pnpm build` / `pnpm test` / `pnpm typecheck` run through turbo across packages. On Windows PowerShell use `pnpm.cmd` and native filesystem paths.
- **Build ordering matters:** `@craft/ui` exports `dist`, not source. After shared UI changes, run `pnpm.cmd --filter @craft/ui build` before app integration tests or consuming app builds. Rebuild changed upstream token/icon packages first when applicable.
- Start with the smallest relevant validation: `pnpm.cmd --filter @craft/ui exec vitest run <test-paths>` (paths relative to `packages/ui`) or `node --test apps\api\test\<file>.test.mjs`. Combine related selectors in one run.
- Run the affected app build for UI/app changes, e.g. `pnpm.cmd --filter @craft/web build`. Escalate to broader suites for cross-cutting changes or unexplained regressions, not automatically for every CSS edit.
- Distinguish failures caused by the change from independently verified baseline failures; report remaining failures explicitly. Do not maintain a stale blanket test-exclusion list.
- Documentation/instruction-only changes need link, command and frontmatter checks, not application builds unless documentation tests exist.

## Architecture & Media Invariants

- Reuse design tokens, media palettes and existing atomic components rather than app-local copies. Shared UI must not import app implementation; app composition wires API/state into reusable UI.
- Keep shared domain types and formatting/playback helpers in lower layers; templates and apps consume them, not the reverse.
- Sample classification and distribution/access permissions are independent. Published Sample Pack membership classifies a file as a sample; draft membership alone does not.
- Pack playback uses explicit pack queue identity and exact membership. Previous/next/shuffle/repeat must not escape that pack or activate another pack sharing a track.
- Keep Dubs and Samples surfaces consistent while preserving their turquoise/green variants. Detailed behavior: [packs](../docs/packs.md); typography: [typography](../docs/typography.md).

## Scoped Guidance

- [Frontend instructions](instructions/frontend.instructions.md): component boundaries, CSS contracts, browser validation and app-test mocks.
- [API instructions](instructions/api.instructions.md): persistence, access checks, isolated tests and admin/deployment configuration.
- Keep this file focused on durable project-wide rules. Put specialist detail in scoped instructions or link existing documentation instead of duplicating it. Do not record temporary task status, blanket failure claims or speculative diagnoses.
