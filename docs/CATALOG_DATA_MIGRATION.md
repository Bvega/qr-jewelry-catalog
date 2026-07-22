# Controlled catalog data migration

## Scope

M07B-3 prepares exactly four accepted intake Finds and their four approved primary images for an owner-controlled import. The public catalog remains backed by static repository data. Stage A performs only local implementation and validation; remote catalog, Auth, Storage, and migration writes are prohibited until MASTER accepts the implementation.

The source contract is:

- `content-intake/finds.csv`;
- `content-intake/photo-manifest.csv`;
- the ignored original files in `content-intake/photos/`;
- `data/collections.js`; and
- `docs/IDENTIFIER_REGISTRY.md`.

`migration/m07b3-catalog-plan.json` is a deterministic derivative, not a new authoring surface. `npm run migration:prepare` regenerates it and `npm run migration:validate` independently recomputes its source hashes, approved fields, identifier assignments, image metadata, and Collection definitions.

## Identifier and initial-state contract

The intake assignments are fixed at `BU-0006` through `BU-0009`, with the intake key reused as the stable slug. They have no legacy numeric IDs. The database sequence-floor migration reserves values through 9 monotonically, so a fresh reset generates `BU-0010` next and an already-higher sequence never moves backwards.

Every imported Find begins hidden and unfeatured, with no archive timestamp, no publication timestamp, USD pricing, deterministic sort order 6 through 9, and no relations. Nothing in M07B-3 changes the five static Finds or assigns a legacy route to a new Find.

## Collection and image integrity

All six repository Collections are checked. Repository status `coming-soon` maps to database status `coming_soon`. A missing Collection may be inserted exactly; any difference in label, status, order, or description blocks before a write. The workflow never updates a mismatched Collection.

Each Find uses exactly one primary image at `finds/{find-id}/{approved-filename}` in `find-images`. The browser verifies the original bytes against the plan's SHA-256, byte size, detected JPEG/PNG/WebP type, width, and height before dry-run and again before upload. The approved alternative text, role `primary`, and sequence `1` are inserted without recompression or renaming. Storage inspection and downloads occur only in an authenticated owner session.

## Owner-only workflow

The temporary, unlinked loopback route is `/admin/migrate-intake.html`. It uses the same ignored browser-safe configuration as the Seller Catalog Manager and supports email/password sign-in or restoration of an existing manager session. After authentication it calls the self-only role probe. Only exact role `owner` proceeds; editor and non-admin accounts are signed out and denied.

The loopback server rejects direct static access to `migration/`, the accepted `content-intake/` files and photos, the identifier registry, `.env.local`, and `admin/config.js`. Migration reads use an exact allowlist under `/__maintenance/m07b3/`. Every allowlisted request carries the current Supabase access token only in the `Authorization: Bearer` header. The server validates the user with Supabase Auth and then requires the exact `owner` result from `current_catalog_admin_role` before returning bytes. It uses only the browser-safe publishable key, exposes no write API, accepts only GET/HEAD, and returns neutral 401/403/404 responses. The token is never put in a URL, page source, response, or log.

The browser configuration is delivered at `/admin/runtime-config.js` from the ignored file after the server validates that it contains only the project URL, publishable key, and project reference. The ignored `admin/config.js` path itself remains inaccessible. The public `data/collections.js` asset remains unchanged and public because the accepted static catalog requires it; migration reads receive the same tracked bytes only through the authenticated maintenance allowlist. The page has no signup or password-reset request flow and never renders internal identifiers, authentication material, configuration values, or internal intake annotations.

## Mandatory dry-run

Dry-run writes nothing. Every click discards prior source verification, reloads the tracked plan, both CSVs, the Collection registry, the identifier registry, and all four photos through the protected owner-only channel, then rechecks source hashes plus every photo's SHA-256, byte size, detected MIME type, width, and height. It also rechecks owner authorization, six Collections, absence of `BU-0001` through `BU-0005`, target IDs and slugs, exact hidden state, photo rows, authenticated Storage contents, and absence of relations. Each target becomes one of:

- `absent` — safe to create;
- `resumable` — exact Find with an incomplete, non-conflicting primary-photo step;
- `complete` — exact Find, photo metadata, and original Storage bytes already exist; or
- `mismatch` — execution is blocked.

Execution requires that current successful dry-run, a checked review control, the exact phrase `IMPORT 4 FINDS`, and a separate action. Dry-runs expire after five minutes, database drift blocks execution, and reopening never executes automatically.

## Idempotency and rollback

Exact complete records are skipped. Resumable records receive only their missing exact photo step. Existing mismatches are never overwritten, and pre-existing rows or objects are never hard-deleted.

Every post-write and final verification is exception-safe. A database, Storage, network, parsing, or verification exception starts rollback for the current attempt; a final batch verification exception rolls back every artifact proven to belong to that execution. Rollback deletes only a positively confirmed attempt-created photo row, object, or new Find and then independently re-reads the database and Storage to verify absence. A successful-looking delete response is not treated as proof.

Upload success is recorded only after the response confirms the exact path. A collision, timeout, or ambiguous upload response triggers fresh Storage inspection. On a resumable pre-existing Find, an object is never deleted unless this execution positively proved it created the object; unresolved ownership stops for manual review. Ambiguous metadata insert/delete responses are likewise reconciled by exact reads. A newly inserted Find and UUID-scoped path may be cleaned up only while their ownership by the attempt is proven. Rollback failure stops all remaining Finds and reports `partial-failure`; it never falls back to a generic no-write blocked state. A second dry-run after a complete import reports all four already complete and offers no execution action.

## Local validation

Use fictional local users only:

```bash
npm ci
npm run migration:prepare
npm run migration:validate
npm run migration:test
npm run admin:build
npm run admin:validate
npm run supabase:start
npm run supabase:reset
npm run supabase:test
npm run supabase:lint
npm run supabase:stop
```

No Stage A command applies a migration or imports catalog data remotely.
