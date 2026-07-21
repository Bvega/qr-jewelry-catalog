# Seller Manager local setup

## Requirements

- Node.js and npm versions compatible with the lockfile;
- Docker Desktop or another Docker-compatible runtime for local Supabase; and
- an ignored `.env.local` containing non-empty `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_PROJECT_REF` values for the remote browser-safe project configuration.

Do not add a database password, access token, owner UUID/email, secret key, or `service_role` key. The generator rejects known secret variable names and secret-key formats. Never expose such values publicly or place them in `admin/config.js`.

## Install, build, and validate

```bash
npm ci
npm run admin:build
npm run admin:validate
```

The build reads only `admin-src/` and dependencies. It does not read `.env.local`, does not embed project values, and does not modify the public catalog runtime.

For full database validation:

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:test
npm run supabase:lint
npm run supabase:stop
```

All automated auth records are fictional, local-only pgTAP fixtures that roll back.

## Generate browser configuration

Confirm that `.env.local` is ignored, then run:

```bash
npm run admin:config
```

The command reads but never modifies `.env.local`. It requires an HTTPS `{project-ref}.supabase.co` URL and a browser-safe publishable or legacy anon key. It writes `admin/config.js` with only:

```text
url
publishableKey
projectRef
```

It prints one neutral success message and no configuration value. `admin/config.js` is local-only and must never be committed.

## Serve and smoke test

```bash
npm run admin:serve
```

Open `http://127.0.0.1:3000/admin/`. The repository-local server binds only to `127.0.0.1`, serves read-only static files, rejects non-GET/HEAD methods, blocks dotfiles and traversal, and does not expose a write API.

Verify:

1. the signed-out form is visible;
2. no signup control exists;
3. an invalid sign-in returns neutral wording;
4. an authenticated non-admin is denied and signed out;
5. an allowlisted local test admin can load the empty local catalog; and
6. page source and the console contain no secret value or session/token log.

Do not use a real remote owner account for automated testing. Remote owner smoke testing waits for MASTER approval.

## Troubleshooting

**Configuration is missing or invalid:** Check only that the three required names are present and non-empty. Confirm the URL uses HTTPS, the hostname matches the project reference, and the key is publishable. Regenerate `admin/config.js`; do not inspect or paste credentials into issue reports.

**Access is denied after valid authentication:** Authentication and authorization are separate. Confirm the test user is allowlisted locally in `private.catalog_admins`. Do not expose or query the private allowlist from browser code.

**Catalog requests fail:** Confirm local Supabase is running, migrations were reset successfully, the session is valid, and RLS sees the fictional local test user as an owner/editor. Network failures remain recoverable in the UI.

**Image upload fails:** Confirm the file is JPEG, PNG, or WebP, no larger than 10 MiB, and has alternative text. Metadata errors may leave the Find saved without the new image; follow the on-screen recovery message and retry by editing that Find.

**Port 3000 is occupied:** Set a different local port without changing the bind address:

```bash
ADMIN_PORT=3001 npm run admin:serve
```
