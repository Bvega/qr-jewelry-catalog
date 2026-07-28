# Controlled Dynamic Publishing

## Goal and review state

M08 Stage A adds a controlled public Supabase read path while preserving the five accepted static Finds and every existing permanent-link, sharing, reservation, QR, and image-fallback contract. The implementation is a local review candidate. It is not complete or accepted until MASTER reviews it, and Stage B must not begin without separate MASTER approval.

No push, deployment, GitHub configuration, remote migration, remote database write, or remote Storage write is part of Stage A. `BU-0006` through `BU-0009` remain hidden and unpublished in the remote project. The next generated public ID remains `BU-0010`.

## Publication state and minimal migration

The existing schema already has the smallest sufficient publication model:

- `is_published = true` means the owner has explicitly made the Find publicly visible.
- `archived_at is null` means the Find is active rather than archived.
- Public visibility requires both conditions.
- Existing table constraints require an immutable public ID, title, established Collection, positive price, supported currency and availability, and nonempty description.
- A primary photograph is optional under the accepted missing-image business rule. If photograph metadata or download fails, the public renderer uses the approved fallback.

No new publication field, table, or workflow state was necessary. Migration `20260728120000_m08_controlled_dynamic_publishing.sql` is required only because the earlier foundation granted whole-table reads and used a public-retrieval image bucket. It replaces those grants with an exact anonymous contract and a narrowly extended authenticated maintenance contract, makes `find-images` private with an RLS-controlled download path, and enforces that each photo path is scoped to its parent Find UUID. It does not alter any Find, Collection, relationship, photograph, user, role, or owner record.

Client-side checks repeat the eligibility and completeness rules before rendering, but they are only a defensive layer. RLS and SQL grants remain the security boundary.

## Approved public data surface

Public requests use explicit column lists; they never request `select *`.

| Relation | Anonymously selectable columns |
| --- | --- |
| `public.collections` | `id`, `label`, `status`, `sort_order`, `description` |
| `public.finds` | `id`, `public_id`, `slug`, `title`, `collection_id`, `price_amount`, `price_currency`, `availability`, `description`, `condition`, `is_published`, `sort_order`, `archived_at` |
| `public.find_photos` | `id`, `find_id`, `storage_path`, `role`, `sequence`, `alt_text`, `width`, `height` |
| `public.find_relations` | `find_id`, `related_find_id`, `sort_order` |

Anonymous callers receive none of the creator/updater identifiers, audit timestamps, publication audit data, feature controls, legacy migration fields, role assignments, or `private` schema data. The authenticated grant additionally retains only `legacy_id`, `is_featured`, and `published_at`, which the accepted M07B migration verifier requires; it still excludes creator/updater identifiers and row audit timestamps. Public row policies apply only to `anon`; separate admin-read policies deny every catalog row and all writes to an authenticated caller who is not an allowlisted owner or editor.

Existing RLS policies additionally restrict rows:

- a Find is readable only when it is published and not archived;
- photograph metadata is readable only through a publicly eligible parent Find;
- a relationship is readable only when both ends are publicly eligible; and
- an authenticated user without an accepted `owner` or `editor` allowlist row cannot publish, unpublish, or otherwise manage catalog data.

## Private image delivery

`find-images` is a private bucket and does not provide durable public object URLs. For an eligible photograph row, the public adapter receives only that public product photograph's Find-scoped locator and sends an authenticated-object Storage download request with the same browser-safe key used for the Data API. Opaque `sb_publishable_...` keys are sent only as `apikey`; a validated legacy `anon` JWT is also sent as its required Bearer value. The anonymous Storage object policy permits only authenticated-object information and download operations, and only when the object path is linked to a photograph whose parent Find is published and not archived. A database constraint also requires the UUID embedded in the path to equal the photograph's parent Find UUID, preventing cross-Find path reassignment.

The response is converted to a page-local `blob:` URL. That URL is used by the existing card and gallery renderers and is revoked when the page is released, except while a page is preserved in the browser back-forward cache. A denied, missing, malformed, or failed download produces the approved missing-image fallback and a neutral partial-availability message. Hidden, unpublished, archived, unrelated, cross-Find, and unregistered object paths remain unreadable. The public client never requests a bucket listing, and the operation-aware anonymous policy rejects listing and unrelated Storage `SELECT` operations. Every anonymous Storage mutation remains denied.

## Hybrid catalog contract

The catalog is static first:

1. `BU-0001` through `BU-0005` are loaded from the protected repository data in their accepted order.
2. Supabase is queried with a bounded timeout and cancellable requests.
3. Eligible remote rows are normalized to the same public Find contract.
4. Any remote row that duplicates a protected public ID or registered static slug is rejected; remote data can never replace a static Find or alias.
5. Accepted remote Finds are ordered by `sort_order`, then immutable public ID, and appended after the five static Finds.
6. Related Finds resolve only through the merged eligible catalog, and malformed relationship rows are omitted independently.
7. Collections are active only when the merged public catalog contains an eligible Find in that Collection; empty Collections remain Coming Soon.

The adapter does not write catalog data to localStorage, IndexedDB, a Service Worker, or any other browser persistence. Direct permanent-ID and registered-slug detail routes wait for the same adapter, so an eligible remote Find works after a fresh load without a prior Home visit. Featured, Latest, and Find of the Week retain their accepted static editorial definitions.

If configuration is absent, Supabase is unavailable or slow, a response is malformed, or all remote rows are rejected, the public catalog installs the five static Finds and shows a neutral accessible partial-availability message when appropriate. A fresh request always begins from the immutable five-Find static snapshot, so a newly unpublished remote Find cannot remain cached in memory. Static detail routes, canonical sharing, Copy Link, Reserve by Message, QR generation, and QR download remain available. Technical errors, credentials, stack traces, and internal database details are not displayed.

## Seller Manager publication workflow

Only an authenticated, allowlisted owner or editor can reach publication controls or pass RLS. The Manager shows Published, Hidden, and Archived states separately.

Publishing is blocked until the persisted Find has:

- a valid, unique immutable public ID;
- a title;
- an established Collection;
- a positive USD price;
- a supported availability value;
- a nonempty description;
- a valid optional slug, when present;
- no archive timestamp; and
- valid primary-photograph metadata when a primary photograph exists.

A photograph is not mandatory, because the public experience has an accepted missing-image fallback. Related Finds are not editable publication inputs in M08; RLS and normalization omit any relationship whose endpoints are not both eligible.

Publish and Unpublish each require a Find-specific confirmation. A shared submission guard prevents a duplicate request. The write includes the expected previous publication state and a non-archived predicate so concurrent publication or archive-state changes fail safely. The Manager verifies both the mutation response and a fresh read before showing success. Session expiration, authorization denial, conflict, request failure, and final-state mismatch produce safe retry guidance. Unpublishing changes only `is_published`; it never deletes the Find, photograph metadata, or Storage objects.

## Validation

The complete local command is:

```bash
npm run m08:check
```

It requires a running Docker-compatible engine, starts or reuses only the local Supabase stack, runs inherited baseline, Manager, migration, M08 public adapter/UI, local database/RLS/Storage, Pages artifact, security-scan, and diff validation, and fails if real database verification is unavailable.

The tracked-only clean-checkout command is:

```bash
npm run m08:check:ci
```

It requires no ignored configuration, owner credential, private photograph, intake asset, remote Supabase access, or remote write. See `docs/VALIDATION.md` for the command matrix and `docs/SUPABASE_LOCAL_DEVELOPMENT.md` for the local-only boundary.

## Rollback

Before Stage B, rollback is entirely local: discard or revert the single M08 implementation commit and reset the local Supabase database from the accepted migrations. No production state exists to unwind.

If a later approved Stage B canary fails:

1. unpublish the canary Find through the authenticated Manager and verify its public route is unavailable;
2. redeploy the last accepted static-only Pages revision;
3. preserve the private image bucket while any dynamic client or private object remains in use; and
4. if the M08 grants or bucket change itself must be reversed, create and review a forward migration that restores the prior grants and bucket setting only after the dynamic client is removed.

Do not repair production through ad hoc dashboard edits. Record the failing revision, public ID, checks, and verified final visibility without recording credentials, sessions, owner identifiers, or private object paths.

## Stage B canary procedure

Stage B requires explicit MASTER approval and a separately authorized operator.

1. Confirm the accepted M08 commit and all local and clean-checkout validation evidence.
2. Confirm `BU-0006` through `BU-0009` are still unpublished and unfeatured before applying anything.
3. Apply only the reviewed M08 migration to the intended remote project.
4. verify anonymous column denial, published-row RLS, private Storage denial, and Manager access without logging private values.
5. Deploy only the accepted Pages artifact.
6. Select one reviewed remote Find as the canary; never bulk publish.
7. In the Manager, resolve displayed blockers, confirm Publish, and verify the returned and refetched state.
8. Verify Explore, Collection count, direct ID and optional slug routes, image/fallback, canonical sharing, Copy Link, reservation, QR, and Related Finds in a fresh anonymous browser.
9. Confirm every other hidden or archived Find remains absent.
10. Confirm Unpublish removes the canary from lists, direct routes, relationships, and Storage access without deleting data.
11. Record the outcome for MASTER before any further publication.

## Known limitations and exclusions

- The dynamic browser path remains a read-only public catalog; catalog writes stay in the authenticated Manager.
- Remote photographs are downloaded as page-local blobs, so they are fetched again after a fresh page load.
- A failed photograph download uses the fallback rather than retrying indefinitely.
- Collections are activated from current eligible content; Collection administration remains out of scope.
- Featured, Latest, and Find of the Week remain static editorial selections.
- The existing external QR-library dependency and two protected static missing-image warnings remain.
- Payments, checkout, automated reservations, buyer accounts, customer-data storage, messaging, analytics, advanced search, Facebook publication or credentials, bulk publication, editorial controls, multi-catalog or multi-tenant architecture, private client catalogs, branding configuration, visual redesign, Service Workers, and remote production migration execution are excluded.
