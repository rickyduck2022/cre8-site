# Developer handbook

For new contributors and ongoing maintainers. These guides describe the current
working implementation, including unreleased work; they do not assert that every
feature has been deployed. Package manifests, runtime source and focused tests
are the final authority when documentation disagrees.

## Start here

1. [Getting started](getting-started.md): prerequisites, safe local setup and commands.
2. [Architecture](architecture.md): repository boundaries and data/state flow.
3. [Frontend and design system](frontend.md): composition, navigation, tokens and UI.
4. [Product systems](product-systems.md): feature-to-code map and behavioral contracts.
5. [API and data](api-and-data.md): HTTP families, access, media and persistence.
6. [Testing and troubleshooting](testing.md): targeted tests and diagnosis.
7. [Deployment, admin and operations](operations.md): environments, storage and gates.

## Canonical specialist documentation

| Topic | Maintained reference |
| --- | --- |
| Media classification, uploads, packs, licensing, playback, windows/workspaces | [Packs and workspaces](../packs.md) |
| Tutorial actions, completion, highlighting and limitations | [Onboarding](../onboarding.md) |
| Crates, retained but not exposed | [Crates status](../features/crates.md) |
| API bootstrap/import, storage modes, push and media limits | [API README](../../apps/api/README.md) |
| Admin authorization, reviews and local/production entry points | [Admin README](../../apps/admin/README.md) |
| Typography | [Typography](../typography.md) |
| Recorded journeys | [Video guides](../guides/README.md) |
| Production assessment and separate experimental stages | [Backend spike](../backend-production-spike.md) |
| Current release inventory and proposed follow-ups | [Unreleased release notes](../release-notes-unreleased.md) |

Historical release notes, research and strategy documents are not runtime
contracts. In particular, the v0.1.0 release notes are not the current release
baseline. Experimental Stage A/B schemas are not the normal API database.

## Keeping docs current

- Change the relevant specialist contract with the code; link it here instead
  of copying long procedures across guides.
- Link to real source modules and tests. Explain state ownership and failure
  behavior, not just successful screenshots.
- Keep implemented, experimentally demonstrated, proposed and deployed behavior
  distinct. Record validation evidence with its scope; do not recycle old totals.
- Use synthetic examples only. Never copy credentials, private messages, database
  URLs or local community records into docs.
- Validate relative links and command names after moving files. Documentation-only
  changes do not require app builds unless they affect executable documentation.
