# cre8

A music community for discovering and sharing dubs, samples and vocals, publishing
packs, listening in workspaces, and connecting through friends and Messenger.

## Develop

Use Node.js 22 (the Docker runtime) and pnpm 9.15.4 (the pinned package manager).
From the repository root in PowerShell:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd --filter @craft/tokens build
pnpm.cmd --filter @craft/ui build
pnpm.cmd dev
```

The development stack starts the API on `3001`, web on `5173`, and admin on
`5174`. Check for an existing shared stack before starting another.

## Documentation

- [Developer handbook](docs/developer/README.md): setup, architecture, every app
  subsystem, testing, API, administration and operations.
- [Unreleased changes and recommendations](docs/release-notes-unreleased.md):
  major/minor features, improvements, fixes and release gates since v0.1.5.
- [Media, packs and workspaces](docs/packs.md): product behavior and invariants.
- [Interactive onboarding](docs/onboarding.md) and [video guides](docs/guides/README.md).
- [API/storage procedures](apps/api/README.md) and [admin console](apps/admin/README.md).

This is a pnpm/Turbo monorepo. The community and admin apps use React/Vite; the
backend is a framework-free Node HTTP server. Shared UI, tokens and icons live
under [packages](packages).

Local builds and tests are not proof of production readiness. See
[operations and release gates](docs/developer/operations.md) before deployment.
