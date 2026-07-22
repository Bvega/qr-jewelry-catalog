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
npm run migration:prepare
npm run migration:validate
npm run migration:test
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

It prints one neutral success message and no configuration value. `admin/config.js` is local-only and must never be committed or fetched directly. The loopback server validates this file and emits only its browser-safe fields at `/admin/runtime-config.js`; requests to `/admin/config.js` return 404.

## Serve and smoke test

```bash
npm run admin:serve
```

Open `http://127.0.0.1:3000/admin/`. The repository-local server binds only to `127.0.0.1`, serves read-only files, rejects non-GET/HEAD methods, blocks dotfiles and traversal, and does not expose a write API.

The separate seller invitation-completion route is:

```text
http://127.0.0.1:3000/admin/activate.html
```

It uses the same ignored browser configuration. It is not a signup or password-reset request page; it accepts an invitation-created Auth session, verifies the current seller role, sets a first password, signs out, and directs the seller back to `/admin/` for a fresh sign-in. See `docs/SELLER_ACCOUNT_ACTIVATION.md` for the complete security boundary and post-acceptance dashboard plan.

The temporary M07B-3 owner-only intake route is intentionally unlinked:

```text
http://127.0.0.1:3000/admin/migrate-intake.html
```

It loads migration sources through the exact `/__maintenance/m07b3/` allowlist only after the server validates the current bearer session and exact owner role. The access token stays in the Authorization header and is never placed in a URL, page source, response, or log. Direct static access to the plan, accepted CSVs, manifest, source photos, and identifier registry is blocked. Editor and non-admin accounts are signed out. Every dry-run freshly reloads and verifies all plan, registry, CSV, and photo bytes and performs no writes; execution additionally requires a current successful dry-run, a review checkbox, the exact confirmation phrase, and a separate final action. During Stage A use only fictional local Auth users. After local Supabase starts, `npm run admin:config -- --local` writes an ignored loopback configuration without printing its browser-safe value. An isolated validation copy may add `--workdir /path/to/unlinked-project`. Do not use the local option for the post-acceptance remote runbook.

Verify:

1. the signed-out form is visible;
2. no signup control exists;
3. an invalid sign-in returns neutral wording;
4. an authenticated non-admin is denied and signed out;
5. an allowlisted local test admin can load the empty local catalog; and
6. page source and the console contain no secret value or session/token log.

For the M07B-3 route, also verify direct and protected unauthenticated requests reveal no migration source, authenticated editors are denied, an authenticated owner can fetch only the exact maintenance allowlist, each owner dry-run reloads all sources and reports four target IDs with zero writes, source photos verify, and refresh never starts execution.

Do not use a real remote owner account for automated testing. Remote owner smoke testing waits for MASTER approval.

## Controlled activation smoke

Before MASTER acceptance, use only the no-invitation local path:

1. Run `npm run admin:config`, then `npm run admin:serve`.
2. Confirm `/admin/` still loads its normal sign-in page.
3. Open `http://127.0.0.1:3000/admin/activate.html` without invitation material and confirm the neutral invalid, expired, or missing state.
4. Confirm the activation source contains no email field, signup control, inline script, configuration value, invitation value, or owner identifier.
5. Confirm the browser console contains no password, URL fragment, token, session, or user-object log.
6. Confirm a POST to either admin route receives `405 Method Not Allowed`.

Do not use a real invitation or write to remote Auth during implementation. After MASTER acceptance, follow the controlled remote activation steps in `docs/SELLER_ACCOUNT_ACTIVATION.md`; keep the existing Auth user and allowlist row, and use exact `127.0.0.1` URLs rather than `localhost`.

## Troubleshooting

**Configuration is missing or invalid:** Check only that the three required names are present and non-empty. Confirm the URL uses HTTPS, the hostname matches the project reference, and the key is publishable. Regenerate `admin/config.js`; do not inspect it through HTTP or paste credentials into issue reports. The browser loads the validated `/admin/runtime-config.js` response.

**Access is denied after valid authentication:** Authentication and authorization are separate. Confirm the test user is allowlisted locally in `private.catalog_admins`. Do not expose or query the private allowlist from browser code.

**Activation invitation is unavailable:** Confirm the link is current and was opened at exact `http://127.0.0.1:3000/admin/activate.html` while the local server was running. Request a new invitation to the existing user after MASTER acceptance; do not recreate the user or change its allowlist row.

**Catalog requests fail:** Confirm local Supabase is running, migrations were reset successfully, the session is valid, and RLS sees the fictional local test user as an owner/editor. Network failures remain recoverable in the UI.

**Image upload fails:** Confirm the file is JPEG, PNG, or WebP, no larger than 10 MiB, and has alternative text. Metadata errors may leave the Find saved without the new image; follow the on-screen recovery message and retry by editing that Find.

**Port 3000 is occupied:** Set a different local port without changing the bind address:

```bash
ADMIN_PORT=3001 npm run admin:serve
```
