# M07B-2R1 Repair Implementation Report

## Result

- Status: PASS — implementation and required automated/value-free local validation complete.
- Acceptance state: Implementation candidate — pending MASTER acceptance.
- Branch: `fix/m07b2r1-seller-account-activation`
- Base and rollback reference: `852c8a0616c84ef197cc0fc20cd22c1ffb165739`
- Push/merge/tag: prohibited and not performed.

## Root cause confirmed

M07B-2 had email/password sign-in and the owner/editor role gate but no invitation-completion page where an authenticated invited seller could establish a first password. The development Site URL also pointed at `localhost:3000`, which resolved to another local application instead of the Seller Catalog Manager served at `127.0.0.1:3000`.

## Delivered repair

The repair adds `/admin/activate.html`, a deterministic activation bundle, testable session and password modules, accessible failure/success states, exact initial `type=invite` context enforcement, isolated nonpersistent activation Auth storage, exact owner/editor authorization, post-session URL scrubbing, confirmed password update, invitation-session sign-out, and a fresh `/admin/` sign-in link. It preserves the accepted manager architecture and normal sign-in flow.

## Security result

There is no signup, anonymous password creation, public password-reset request, current-password field, owner identifier, token parser, credential log, secret key, service-role key, or server-side key. Auth errors remain neutral. Only an exact initial `type=invite` marker can proceed to SDK session handling. The activation client uses fresh in-memory Auth storage, a dedicated storage key, `persistSession: false`, and `detectSessionInUrl: true`, so it cannot consume the manager's persisted owner/editor session. Missing or wrong flow types and stale, forged, expired, or credential-free invitation contexts fail closed without a role probe or password update. An SDK-established invite session cannot bypass the self-role probe. Non-admin invite sessions are denied and signed out. Password values are neither trimmed nor logged and are cleared after completion or failure.

## Protected scope

The repair does not change the public runtime, catalog data, accepted intake CSVs or photos, product images, identifier registry, legacy snapshot, Supabase migrations, database tests, remote Supabase configuration, or database state. No new migration is included.

## Validation

- `npm ci`: PASS; 19 packages installed from the lockfile.
- `npm run admin:build`: PASS; deterministic app, activation, and stylesheet assets rebuilt without source maps.
- `npm run admin:validate`: PASS; 53/53 Seller Manager Node tests in 8 files.
- `node scripts/validate-content-intake.mjs`: PASS with 8 inherited non-failing intake warnings.
- `node scripts/summarize-content-intake.mjs`: PASS; 4 proposed Finds ready for review and 0 blocked.
- `node scripts/validate-supabase-foundation.mjs`: PASS.
- `node scripts/validate-baseline.mjs`: PASS; all 32 baseline/domain/brand/discovery/detail/permalink/intake/Supabase/manager test files passed.
- `git diff --check`: PASS.
- Protected-file diff and working-tree checks: PASS; no public runtime, intake, image, identifier, migration, or database-test change.
- `npm run admin:config`: PASS with one neutral message and no printed values; generated configuration remains ignored and untracked.
- `npm run admin:serve`: PASS; server bound to `127.0.0.1:3000`.
- Loopback HTTP smoke: `/admin/`, `/admin/activate.html`, activation bundle, and stylesheet returned 200; `.env.local` returned 404; POST to both admin routes returned 405.
- Generated-value comparison: PASS; the ignored configuration values are absent from committed HTML, JS, and CSS assets.
- Exact invite-context capture, isolated nonpersistent storage configuration, shared-local-storage exclusion, forged/stale/expired invite rejection, valid isolated invite role gating, wrong-flow rejection, zero rejected-context `rpc` and `updateUser` calls, no-session, no-signup, strict-CSP, no-inline-script, no-log/render, and neutral failure behavior: PASS through focused Node assertions.

A controllable browser backend was unavailable, so visual rendering and live browser-console inspection remain deferred to MASTER review and the controlled remote owner activation smoke. No real invitation was opened and no remote Auth write occurred.

## Known limitations

- Remote owner activation remains deferred until MASTER acceptance.
- Supabase dashboard URL configuration and invitation resend are documented but intentionally not executed.
- Visual browser/console smoke remains deferred because no browser backend was attached to the implementation environment.
- Public catalog Supabase integration, intake migration, and Cloudflare deployment remain out of scope.
