# cre8 Admin

Whole-app context: [developer handbook](../../docs/developer/README.md).
Deployment/storage boundaries: [operations](../../docs/developer/operations.md).

The admin console is an independently built React app at `/admin`, sharing the workspace tokens and `@craft/ui` atomic component library with the community app. It uses the existing API session cookie and stores no separate credentials.

## Local development

Run `pnpm dev` from the repository root to start the API (`3001`), community app (`5173`), and admin app (`5174`). The two local entry points are `http://localhost:5173/` for the community app and `http://localhost:5174/` for admin. The admin dev server proxies API calls to the local API.

Configure `ADMIN_USERNAMES` on the API process as a comma-separated list of existing account usernames, for example `ADMIN_USERNAMES=meladee`. This allowlist is the only source of admin privileges; the editable profile role is not used for authorization. Without this setting, no account has admin access.

## Production

Build with `pnpm --filter @craft/admin build`. The API serves the generated assets at `/admin` while the community app remains at `/`. Set `ADMIN_USERNAMES` in the API service environment. The API endpoint checks the authenticated session and allowlist on every request.

The Render Blueprint configures `admin` as an allowed administrator and seeds
that account on service startup using `ADMIN_SEED_USERNAME` and the secret
`ADMIN_SEED_PASSWORD`. Set `ADMIN_SEED_PASSWORD` in the Render dashboard when
creating or updating the Blueprint; it is not stored in this repository. Use a
strong unique password: short passwords are unsafe for an internet-facing admin
account. The seed runs against the persistent community database, including
existing deployments. It creates the account only if absent, never overwrites
an existing account or resets its password, and fails startup if an unrelated
account already owns the username. Resolve such a collision manually before
deploying. Changing the environment password after the account exists does not
change its saved password.

Outside Render, seeding is optional: configure both seed variables and include
the chosen username in `ADMIN_USERNAMES`. If only one seed variable is set,
startup fails rather than creating an account with an unintended password.

The dashboard currently provides aggregate community activity and searchable member and release inventories. Sensitive credential hashes, salts, session values, and private profile fields are never included in its response.

## Administration journeys

The console reuses the community design tokens, Brand, Navigation, Avatar,
SearchField, Badge, Button and Modal/ModalFooter components from `@craft/ui`.
Shared icons come from `@craft/icons`; admin CSS handles layout and data views
rather than defining a separate color palette.

- **Overview** starts with actionable paths to artist reviews, member discovery
  and release inventory, followed by community totals, activity and top releases.
  Counts describe a snapshot, not an always-live feed; use **Refresh data** to update.
- **A-List reviews** puts pending submissions first, with artist search and status
  filtering. Read identity/experience, scene highlights, social profiles and the
  decision history before approving, requesting information or rejecting.
  Rejection and access revocation require confirmation. Approved members remain
  manageable even when they predate the application workflow.
- **Members** and **Releases** provide searchable inventories and links back to
  community profiles. The member directory also leads to A-List access management.

Sections have direct hash routes (`#overview`, `#applications`, `#members`,
`#releases`) and support browser back/forward. Navigation wraps into grouped
mobile sections; wide tables scroll within their own keyboard-focusable region.
