# Testing and troubleshooting

[Handbook](README.md) / Testing

## Test ownership and smallest useful commands

The root [manifest](../../package.json) runs package scripts through Turbo.
Shared UI uses Vitest/jsdom; API tests use Node's test runner. Many web integration
tests intentionally live in the UI package and import web components/hooks.
There is no web `test` script in its manifest.

Run commands from the repository root in PowerShell:

```powershell
# Component/contract tests; selectors below are relative to packages/ui.
pnpm.cmd --filter @craft/ui exec vitest run src\organisms\Window\Window.test.tsx src\foundations\MediaPalette.test.mjs

# JSON-mode API regressions with isolated test fixtures.
node --test apps\api\test\packs.test.mjs apps\api\test\windowWorkspace.test.mjs

# UI source changes must be built before app integration tests importing dist.
pnpm.cmd --filter @craft/ui build
pnpm.cmd --filter @craft/ui exec vitest run src\AppOpenPack.test.tsx src\AppPlayer.test.tsx

# Affected consuming apps.
pnpm.cmd --filter @craft/web build
pnpm.cmd --filter @craft/admin build
```

Rebuild changed upstream tokens first. Icons export source and have no build step.
Use root `pnpm.cmd test`, `pnpm.cmd typecheck` or `pnpm.cmd build` for cross-cutting
work or unexplained regressions, not automatically for every CSS edit.
Build scripts include web/admin TypeScript project checks. API build/typecheck
currently syntax-check the main server; they are not substitutes for behavior tests.

## Useful regression map

| Area | Representative tests |
| --- | --- |
| Window/group/dock interactions | [Window tests](../../packages/ui/src/organisms/Window/Window.test.tsx), [docking](../../packages/ui/src/organisms/Window/WindowDocking.test.tsx) |
| Workspace journey and persistence | [Workspace tests](../../packages/ui/src/workspaces/Workspace/Workspace.test.tsx), [API layout tests](../../apps/api/test/windowWorkspace.test.mjs), [app opens](../../packages/ui/src/AppOpenPack.test.tsx) |
| Main/window audio contexts | [hook tests](../../packages/ui/src/useAudioPlayback.test.tsx), [AppPlayer](../../packages/ui/src/AppPlayer.test.tsx) |
| Uploads, packs and Vocal compatibility | [Packs](../../packages/ui/src/Packs.test.tsx), [SampleVault](../../packages/ui/src/SampleVault.test.tsx), [API packs](../../apps/api/test/packs.test.mjs) |
| Onboarding and spotlight behavior | [AppOnboarding](../../packages/ui/src/AppOnboarding.test.tsx), [TutorialFocus](../../packages/ui/src/TutorialFocus.test.tsx), [API onboarding](../../apps/api/test/onboarding.test.mjs) |
| Tokens/theme/contrast | [MediaPalette](../../packages/ui/src/foundations/MediaPalette.test.mjs), [theme](../../packages/ui/src/Theme.test.tsx), [semantic tokens](../../packages/ui/src/semanticTokens.test.ts) |
| Responsive shell/player/input | [Footer layout](../../packages/ui/src/templates/FooterPlayerLayout.test.mjs), [input scale](../../packages/ui/src/MobileInputScale.test.mjs) |
| Realtime recovery | [CommunityReconnect](../../packages/ui/src/CommunityReconnect.test.tsx) |

Contract tests inspect selectors/values on disk. Update them only for intentional
behavior changes, not merely to conceal a failing assertion. Some integration
mocks deliberately omit page children; feed interactions belong in suitable
composition tests rather than broadening every player mock.

## API isolation and optional database tests

JSON tests should create temporary data/media/public-audio directories, start
`createApiServer` on an ephemeral loopback port and clean up their own resources.
Never use shared development records or run `dev:purge` as a test setup.

`pnpm.cmd --filter @craft/api db:test` is an explicit opt-in integration suite.
It requires a disposable loopback database named `cre8_community_test_<suffix>`,
creates failure-injection/schema-drift objects and must not target live/staging
data. Follow [API setup and limits](../../apps/api/README.md).
Stage A/B and staging suites use different harnesses/configuration; do not treat
their passing results as evidence the full normal API has those capabilities.

## Browser validation

Use an isolated fixture or synthetic API data, not real uploads/accounts. Reuse
responsive shared servers only after verifying checkout, source aliases and built
assets. Do not restart or kill a server you did not start.

For affected surfaces verify:

- Desktop, `320px`/`390px` mobile widths and short-height layouts.
- No unintended horizontal overflow; pinned actions remain reachable and touch
  targets retain their minimum size.
- Settled computed border/background/text colors and contrast, including
  media/audience/theme overrides. Wait for transitions before assertions.
- Keyboard navigation, named controls, focus return, drag alternatives and
  dirty/busy/error/retry states.
- Playback using playable fixture audio: await actual playing before asserting
  pause/seek, queue switching and progress restoration.
- Reload/account switch and workspace save/discard/resume where persistence changes.

PWA/offline/update and real push behavior require the production build and suitable
browser/device support. A Vite screenshot is not an end-to-end push test.
Clean up exact temporary entrypoints/data and only processes you started.

## Troubleshooting

| Symptom | Check before changing code |
| --- | --- |
| Dev UI correct, integration tests/build stale | Rebuild UI dist; confirm whether consumer uses source alias or package exports |
| API not reachable after changing port | Vite proxy target remains `3001` unless deliberately changed |
| Login works, admin denied | API `ADMIN_USERNAMES`; profile role and seeded account existence do not grant authorization |
| Layout appears not restored | Simple/Explorer mode, startup resume choice, active vs inspected owner, current access pruning and explicit checkpoint |
| Player shows another queue | Selected main context vs audible context, exact pack identity, window activation callbacks |
| Colors differ from token expression | Local variant overrides, CSS specificity and where derived variables are computed |
| Guide advances incorrectly or blocks controls | Typed activity success boundary, current subject, overlay targets and short viewport |
| Guides return `404` | Publish generated video index/assets; check `GUIDES_DIRECTORY` |
| Preview/push unavailable | FFmpeg/VAPID configuration and explicit server errors, not an original-audio/success fallback |
| PostgreSQL startup rejects configuration | Exact DB name, verified remote TLS, migrations/initialization and mode; do not fall back silently |

For failures, record the exact selector, command and observed result. Distinguish
new regressions from independently reproduced pre-existing behavior. Do not keep
a permanent blanket exclusion list or report historical totals as a fresh run.

## Documentation-only validation

Check relative links (including source paths), headings/anchors, command names
against manifests, environment names against source, diagram syntax and diff
whitespace. Do not start apps, databases, imports, purge or deployment commands
just to verify prose. No additional dependency is needed for routine link checks.
