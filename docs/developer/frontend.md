# Frontend and design system

[Handbook](README.md) / Frontend

## Composition and navigation

The community [entry point](../../apps/web/src/main.tsx) initializes theme before
rendering and wraps the app with theme/PWA providers. Its
[App wrapper](../../apps/web/src/App.tsx) leads to the main
[composition](../../apps/web/src/app/App.tsx). Start there when tracing a user
journey, then follow the relevant hook/service and shared component.

Community navigation uses hash sections from
[`CommunitySection`](../../apps/web/src/types/community.ts):

- Discovery: `#dubs`, `#samples`, `#vocals`, `#alist`.
- Owned: `#my-dubs`, `#my-samples`, `#my-vocals`, `#all-uploads`.
- Received: `#shared-with-me`, `#shared-samples`, `#shared-vocals`.
- Other: `#library`, `#full-library`, `#profile`, `#buddies`, `#messenger`,
  `#alist-application`.

Preserve legacy hashes, browser history and desktop/mobile navigation parity when
adding destinations. The A-List feed is approval-gated; the application information
is a different journey. External shared links are handled by app entry/link helpers,
not by treating every URL as a community section.

## Shared UI and styling

Public exports are in [UI index](../../packages/ui/src/index.ts). Component-owned
styles are imported by their components; global foundations and shared palettes
define reusable roles. [UI package exports](../../packages/ui/package.json) point
to `dist` outside the web development alias.

Design colors are maintained together in token
[CSS](../../packages/tokens/src/theme.css),
[TypeScript](../../packages/tokens/src/index.ts) and
[JSON](../../packages/tokens/src/tokens.json).

| Foundation | Purpose |
| --- | --- |
| [MediaPalette](../../packages/ui/src/foundations/MediaPalette.css) | Dub turquoise, Sample green, Vocal violet and reusable media states |
| [AudiencePalette](../../packages/ui/src/foundations/AudiencePalette.css) | Worldwide/Private/A-List identity |
| [DistributionSurfaces](../../packages/ui/src/foundations/DistributionSurfaces.css) | Audience-specific release surfaces/overrides |
| [WorkspacePalette](../../packages/ui/src/foundations/WorkspacePalette.css) | Explorer, window/manager state and dependency tones |
| [ThemePalette](../../packages/ui/src/foundations/ThemePalette.css) | Theme mappings used by the app |

A-List orange identifies the release distribution, not merely an approved artist.
Media identity, permission checks and audience styling are separate concerns.
Use existing component variants; do not recolor a single page/card locally.
Derived color recipes must resolve on the element owning the variant so local
CSS custom-property overrides take effect.

[`ThemeProvider`](../../packages/ui/src/foundations/Theme.tsx) supports dark/light,
defaults to dark and stores the preference under `cre8:theme`. It listens for
cross-tab storage changes and reports persistence errors. This is a browser
preference, not server account synchronization. Typography contracts are in
[typography](../typography.md).

## Windows and players

- [Workspace](../../packages/ui/src/workspaces/Workspace/Workspace.tsx) owns the
  library/manager journey and independent context lifecycle.
- [Window](../../packages/ui/src/organisms/Window/Window.tsx) owns the shared
  registry, grouped tabs, placement, focus, minimization and close controls.
- [PackWindows](../../apps/web/src/components/PackWindows.tsx) and
  [TrackWindow](../../apps/web/src/components/TrackWindow.tsx) wire content and
  playback into shared windows.
- [AppPlayer](../../apps/web/src/components/AppPlayer.tsx) composes the persistent
  player; [usePlayerLayout](../../apps/web/src/hooks/usePlayerLayout.ts) handles its
  arrangement.

Keep stable content/portal identity so grouping, hiding or switching contexts does
not remount and lose a draft. Do not equate hidden, minimized, closed and suspended.
Pack controls must select exact queue identity; a shared track in another pack is
not sufficient. See [product contracts](product-systems.md).

## Accessibility and responsive work

Use the shared `760px` mobile boundary consistently. Window sheets, fullscreen
Explorer, pinned actions and guide overlays require short-height checks as well
as width checks. Controls need accessible labels, keyboard equivalents, visible
focus and adequate mobile touch targets. Drag-only functionality is insufficient:
retain menu/keyboard alternatives for moving, grouping and ordering.

For changed layouts, measure overflow, bounding boxes, target size, settled
computed colors and contrast in a browser. Test both media and audience variants.
Screenshots supplement assertions. Preserve input scaling behavior; use
[`MobileInputScale.test.mjs`](../../packages/ui/src/MobileInputScale.test.mjs).

Build shared UI before consuming tests/builds, even if the Vite source view works.
See [testing](testing.md) for precise commands and mock conventions.
