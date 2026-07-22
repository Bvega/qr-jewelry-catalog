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

The plan and local source files are not fetched until the owner gate succeeds. The page has no signup or password-reset request flow and never renders internal identifiers, authentication state, configuration values, or internal intake annotations.

## Mandatory dry-run

Dry-run writes nothing. It rechecks the local plan and images, owner authorization, six Collections, absence of `BU-0001` through `BU-0005`, target IDs and slugs, exact hidden state, photo rows, authenticated Storage contents, and absence of relations. Each target becomes one of:

- `absent` — safe to create;
- `resumable` — exact Find with an incomplete, non-conflicting primary-photo step;
- `complete` — exact Find, photo metadata, and original Storage bytes already exist; or
- `mismatch` — execution is blocked.

Execution requires that current successful dry-run, a checked review control, the exact phrase `IMPORT 4 FINDS`, and a separate action. Dry-runs expire after five minutes, database drift blocks execution, and reopening never executes automatically.

## Idempotency and rollback

Exact complete records are skipped. Resumable records receive only their missing exact photo step. Existing mismatches are never overwritten, and pre-existing rows or objects are never hard-deleted.

For a newly inserted Find, upload or photo-metadata failure triggers removal of only the newly uploaded object and newly inserted Find. For a resume, cleanup is limited to photo artifacts created by that attempt. A cleanup failure stops all remaining records and reports the affected public ID without exposing an internal identifier. A second dry-run after a complete import reports all four already complete and offers no execution action.

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
