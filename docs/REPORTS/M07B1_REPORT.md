# M07B-1 Implementation Report

## M07B-1 Result

- Status: PASS
- Acceptance state: `Implementation candidate — pending MASTER acceptance`
- Branch: `feature/m07b1-supabase-foundation`
- Commit: the milestone commit containing this report, titled `feat: add Supabase catalog foundation` (resolve with `git rev-parse HEAD`)
- Base commit: `e7c065c28ac24c135946d10bdb40d3a2977d7fc8`
- Rollback reference: `e7c065c28ac24c135946d10bdb40d3a2977d7fc8`

## Repository inspected

- Preflight: clean `main`; `main`, `origin/main`, and `HEAD` matched the base; `4e15db2` was an ancestor; required fetch succeeded.
- Node/npm: Node `v24.18.0`; npm `11.16.0`.
- Container runtime: Docker Desktop `4.76.0`, Engine `29.5.2`, API `1.54`, reachable and healthy.
- Inherited validation: PASS; all 170 M07A tests passed, intake validated, and the summary remained 4 ready / 0 blocked.

## Supabase tooling

- CLI version: stable `2.109.1`, pinned as the only development dependency.
- Package files: private `package.json` with no runtime dependencies and npm lockfile version 3.
- npm scripts: `validate`, `validate:baseline`, `validate:intake`, `validate:supabase`, `supabase:start`, `supabase:stop`, `supabase:reset`, `supabase:test`, and `supabase:lint`.
- Local stack result: PASS; first start downloaded the official images, applied the migration and seed, reconciled the configured bucket, and passed health checks. Clean database reset also passed.

## Database foundation

- Schemas: application tables in `public`; authorization helpers and allowlist in API-excluded `private`.
- Tables: `private.catalog_admins`, `public.collections`, `public.finds`, `public.find_photos`, and `public.find_relations`.
- Constraints: approved Collection IDs/status, bounded nonblank Find content, positive USD price, allowed availability, ID/slug/legacy rules, ordered and uniquely primary photos, positive optional dimensions, unique storage paths, and non-self relations.
- Public-ID generation: non-cycling sequence plus collision-checking security-definer generator; automatic `BU-NNNN` values and explicit accepted IDs are supported. Sequence-adjustment SQL is documented.
- Audit triggers: trusted server-side creator/updater/timestamps and first publication timestamp for Finds; trusted photo creator/timestamps and Collection timestamps.
- Seed behavior: only the approved six-record Collection registry for local development; Jewelry alone is active. No users, admins, products, photos, relations, objects, credentials, or owner data.

## Security foundation

- Admin allowlist: private owner/editor table keyed to `auth.users`; no real owner UUID committed.
- RLS: enabled on every exposed catalog table with explicit grants and operation-specific policies.
- anon behavior: all Collection metadata and only published, non-archived Finds plus eligible photos/relations are readable; no catalog writes.
- authenticated non-admin behavior: same approved public reads; catalog and Storage management denied.
- admin behavior: allowlisted authenticated users may read drafts and manage Collections, Finds, photo metadata, relations, and bucket objects.
- Secret boundary: only empty URL/publishable-key/project-ref placeholders are tracked. No credential, hosted link, real UUID, browser SDK, or browser configuration was added.

## Storage foundation

- Bucket: public-retrieval `find-images`, declared in local config and reconciled in the migration.
- MIME and size restrictions: JPEG, PNG, and WebP only; 10 MiB maximum; HEIC excluded as a final format.
- path convention: `finds/{find-uuid}/{unique-filename}` with a policy-enforced UUID directory and one filename segment.
- public retrieval: bucket URLs are public; anonymous database listing is not granted.
- admin write policies: authenticated allowlisted admin only for list, insert, update, and delete.

## Files created

- `.env.example`
- `docs/REPORTS/M07B1_REPORT.md`
- `docs/SUPABASE_ARCHITECTURE.md`
- `docs/SUPABASE_CONFIGURATION.md`
- `docs/SUPABASE_LOCAL_DEVELOPMENT.md`
- `docs/SUPABASE_REMOTE_SETUP.md`
- `package-lock.json`
- `package.json`
- `scripts/validate-supabase-foundation.mjs`
- `supabase/.gitignore`
- `supabase/config.toml`
- `supabase/migrations/20260720120000_m07b1_catalog_foundation.sql`
- `supabase/seed.sql`
- `supabase/tests/database/01_catalog_foundation.test.sql`
- `supabase/tests/database/02_fixture_rollback.test.sql`
- `tests/supabase-foundation/foundation.test.mjs`

## Files modified

- `.gitignore`
- `README.md`
- `docs/VALIDATION.md`
- `scripts/validate-baseline.mjs`
- `tests/detail/gallery.test.mjs`
- Protected files changed: No

The gallery assertion was narrowed from forbidding every package file to forbidding runtime dependencies and allowing only the required Supabase CLI development dependency. Its public no-carousel behavior remains protected.

## Files removed

- None

## Validation executed

- `node --check scripts/validate-supabase-foundation.mjs` — PASS
- `node scripts/validate-supabase-foundation.mjs` — PASS
- `node --test tests/supabase-foundation/*.test.mjs` — PASS; 13/13
- `node scripts/validate-content-intake.mjs` — PASS
- `node scripts/summarize-content-intake.mjs` — PASS; 4 ready / 0 blocked
- `node scripts/validate-baseline.mjs` — PASS; 183/183 Node tests, including all 170 inherited tests
- `npm run supabase:start` — PASS
- `npm run supabase:reset` — PASS
- `npm run supabase:test` — PASS; two pgTAP files, 57/57 assertions
- `npm run supabase:lint` — PASS; no schema errors or notices
- `npm run supabase:stop` — PASS
- `git diff --check` — PASS
- `git diff --cached --check` — PASS
- `git status --short` — clean after commit
- Final automated total: 240/240 Node tests and pgTAP assertions; PASS

## Live catalog protection

- Public runtime unchanged: Yes
- Existing data unchanged: Yes
- Four intake Finds unchanged: Yes
- Product images unchanged: Yes

## Warnings and known limitations

- No remote project
- No Seller Manager UI
- No product migration
- No browser SDK
- No Cloudflare deployment
- Local Supabase uses development-only credentials and network-accessible host bindings; it must never be exposed publicly.

## Git status

- Final branch: `feature/m07b1-supabase-foundation`
- Final commit: the milestone commit containing this report; resolve with `git rev-parse HEAD`
- Working tree: clean after the required local commit
- Push: not performed
- Merge: not performed

## Owner setup deferred

Project creation, credential handling, owner Auth creation and allowlisting, remote linking, and remote migration push were not performed.

## Recommended next step

`MASTER review and acceptance of M07B-1, followed by controlled remote Supabase bootstrap.`

Do not begin M07B-2.
