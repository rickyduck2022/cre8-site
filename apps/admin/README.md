# cre8 Admin

The admin console is an independently built React app at `/admin`, sharing the workspace tokens and `@craft/ui` atomic component library with the community app. It uses the existing API session cookie and stores no separate credentials.

## Local development

Run `pnpm dev` from the repository root to start the API (`3001`), community app (`5173`), and admin app (`5174`). The two local entry points are `http://localhost:5173/` for the community app and `http://localhost:5174/` for admin. The admin dev server proxies API calls to the local API.

Configure `ADMIN_USERNAMES` on the API process as a comma-separated list of existing account usernames, for example `ADMIN_USERNAMES=meladee`. This allowlist is the only source of admin privileges; the editable profile role is not used for authorization. Without this setting, no account has admin access.

## Production

Build with `pnpm --filter @craft/admin build`. The API serves the generated assets at `/admin` while the community app remains at `/`. Set `ADMIN_USERNAMES` in the API service environment. The API endpoint checks the authenticated session and allowlist on every request.

The dashboard currently provides aggregate community activity and searchable member and release inventories. Sensitive credential hashes, salts, session values, and private profile fields are never included in its response.
