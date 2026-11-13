# Crates feature status

See the [product-system map](../developer/product-systems.md) for the distinction
between retained crate code, download-history My Library and authorized Full Library.

Crates are deferred from the current Cre8 Messenger release. The app does not expose crate navigation, feed actions, or the crate management modal.

The implementation is retained for a later release:

- UI: `packages/ui/src/organisms/CrateManager`, `packages/ui/src/molecules/CreateCrateForm`, `packages/ui/src/molecules/CratePicker`, and the optional crate actions in `packages/ui/src/templates/LatestDubsTemplate`.
- App data and API integration: crate state and operations remain in `apps/web/src/hooks/useCommunity.ts` and the crate endpoints remain in `apps/api/src/server.mjs`.
- Persistence and behavior coverage: crate API tests remain in `apps/api/test/server.test.mjs` and the UI component tests remain alongside their components.

To bring the feature back, reconnect the retained app operations to the navigation, feed, and modal entry points in `apps/web/src/app/App.tsx`.
