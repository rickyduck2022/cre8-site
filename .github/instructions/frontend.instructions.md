---
description: "Use when changing React apps, shared UI, styling, responsive players, waveforms or frontend tests."
applyTo: "apps/web/**,apps/admin/**,packages/ui/**,packages/tokens/**,packages/icons/**"
---

# Frontend Implementation & Validation

- Follow the shared dependency direction: foundations/types/utilities -> atoms -> molecules -> organisms -> templates -> app composition. Search for existing controls/helpers before adding another implementation.
- Reuse semantic tokens and `MediaPalette.css` for Dub/Sample colors, including hover, active, focus, badges and playback controls. Preserve keyboard access, accessible names and explicit error states.
- Colour ownership: primitives and semantic roles live in `packages/tokens/src/theme.css`, mirrored in `index.ts` and `tokens.json`. `AudiencePalette.css` maps Worldwide/Private/A-List identity; `MediaPalette.css` maps Dub/Sample and shared interaction states; `DistributionSurfaces.css` applies release overrides. Components consume those roles, not primitive swatches, literal colours or duplicated `color-mix` recipes. New reusable state recipes belong in shared foundations, not component/page CSS.
- Prefer component variants for intent (for example `Button variant="primary"` for Open pack); do not override their backgrounds locally. Audience identity is independent of media kind; preserve A-List release precedence without recolouring ordinary releases by approved artists.
- Compute derived palette states on the element owning the variant so local token overrides resolve correctly; a `:root` expression is resolved before descendant overrides. For palette changes, test CSS/TypeScript/JSON token parity and theme overrides, plus computed colours and contrast on relevant cards, filters and players. Rebuild changed tokens before UI, then consuming apps.
- Rebuild `@craft/ui` after shared source changes before tests importing the app; its public exports resolve to `dist`. See the root instructions for exact commands.
- CSS contract tests read selectors and values from disk. Run the affected contracts alongside behavioral tests when changing styles; examples: `FooterPlayerLayout.test.mjs`, `MobileInputScale.test.mjs`, `DistributionSurfaces.test.mjs`. Change expectations only when the intended behavior changes.
- Some app tests deliberately mock `DashboardTemplate` without page children (`AppPlayer.test.tsx`). Feed-level interactions belong in a test with suitable composition, such as `AppOpenPack.test.tsx`; do not broaden a shared mock and create duplicate player regions throughout unrelated tests.
- Preserve the current mobile viewport/input-scale behavior unless intentionally changing it. Check web/admin entry points and `MobileInputScale.test.mjs`; do not assume viewport flags alone guarantee identical browser gesture behavior.

## Browser Checks

- Verify the actual requirement: measure bounding boxes, horizontal overflow, text truncation and computed colors; exercise controls and error states. Screenshots supplement, not replace, assertions.
- Cover relevant mobile/desktop breakpoints and short-height layouts. For player changes check header/footer/fullscreen/minimized modes and both media variants when affected.
- Wait for expected computed colors and settled viewport/layout dimensions rather than assuming a click or resize has completed CSS transitions.
- If live behavior contradicts source, compare the served module and built dependency with the edited files; check cache/service-worker state and build ordering. Only force a Vite re-transform after confirming stale output, and do not restart another session's server blindly.
- Use existing browser/API test helpers and isolated fixtures. Await playable audio before pause/seek assertions; retain and test real playback errors instead of hiding them to satisfy layout checks.
- Stop helpers you started and clean up named temporary scripts/data. Do not remove shared services or unrelated artifacts.

Feature details: [packs and playback](../../docs/packs.md), [typography](../../docs/typography.md).
