# Supabase Architecture

M07B created the authenticated catalog foundation and Manager. M08 Stage A adds a controlled anonymous read path for eligible public catalog data while keeping `BU-0001` through `BU-0005` authoritative static records. Database migrations under `supabase/migrations/` are the source of truth; dashboard edits are not.

## Schema responsibilities

- `private.catalog_admins` is the explicit owner/editor allowlist keyed to `auth.users`. The `private` schema is excluded from the Data API and its table has no `anon` or `authenticated` privileges.
- `public.collections` stores the approved six-record Collection registry and its active/coming-soon state.
- `public.finds` stores canonical catalog records, publication state, availability, archive state, prices, legacy aliases, and audit metadata.
- `public.find_photos` stores ordered photo metadata and Storage object paths. It does not store image bytes.
- `public.find_relations` stores ordered directed relationships between distinct Finds.
- `storage.objects` remains owned by Supabase Storage. M07B-1 adds policies only for the `find-images` bucket.

## Authorization and RLS boundary

Authentication alone does not grant catalog administration. An authenticated user's `auth.uid()` must also exist in `private.catalog_admins` with the constrained role `owner` or `editor`. `private.is_catalog_admin()` is a security-definer helper with an empty explicit search path; only `authenticated` may execute it for policy evaluation.

Every application-facing `public` table has RLS enabled. Anonymous public policies may read the approved Collection columns and a Find only when it is published and not archived. Photo rows inherit that visibility from their parent Find, and relation rows require both Finds to meet the public visibility rule. These public policies apply only to `anon`. Separate authenticated policies allow an allowlisted admin to read Collections and drafts and to manage Collections, Finds, photo metadata, and relations. Authenticated users who are not allowlisted receive no catalog rows or management access.

M08 revokes the earlier whole-table reads and grants only these anonymous public columns:

- Collections: `id`, `label`, `status`, `sort_order`, `description`
- Finds: `id`, `public_id`, `slug`, `title`, `collection_id`, `price_amount`, `price_currency`, `availability`, `description`, `condition`, `is_published`, `sort_order`, `archived_at`
- Photos: `id`, `find_id`, `storage_path`, `role`, `sequence`, `alt_text`, `width`, `height`
- Relations: `find_id`, `related_find_id`, `sort_order`

Creator/updater identifiers, audit timestamps, publication audit data, feature controls, migration fields, roles, and private schema data are not selectable by anonymous callers. The authenticated maintenance grant additionally retains only `legacy_id`, `is_featured`, and `published_at`, which the accepted migration verifier needs; owner identifiers and row audit timestamps remain ungranted. Only allowlisted admins can receive rows through the authenticated policies. Grants provide only the SQL operations that a policy may authorize. RLS remains the row-level decision point; no policy trusts user-editable authentication metadata or grants writes merely because the caller is authenticated.

## Publication, availability, and audit state

Publication, availability, and archival state are separate. Public visibility requires `is_published = true` and `archived_at is null`, regardless of whether availability is `available`, `reserved`, or `sold`. In the M08 public contract, active means not archived; no additional active flag was added. Existing constraints require the immutable public ID, title, Collection, positive supported-currency price, availability, and description needed for public display.

The Finds trigger overwrites client-supplied audit values. It records the authenticated actor, preserves the original creator and creation time, advances the update fields, and records the first transition to published without allowing a later client value to replace it. Collection and photo triggers similarly maintain timestamps, and the photo trigger controls its creator field.

Client-side normalization repeats eligibility and completeness checks but is not the security boundary. A photograph is optional because the accepted public renderer has a missing-image fallback; invalid photograph metadata is rejected rather than exposing an object.

## Public-ID generation

`public.find_public_id_seq` and `private.next_find_public_id()` generate `BU-0001`, `BU-0002`, and later values. The sequence is non-cycling and its values are not rolled back or reused after deletion. The generator also checks for a collision, so later migrations may explicitly insert accepted existing IDs before allowing automatic IDs to continue. The canonical ID is independent of the title and optional slug.

After a controlled migration that explicitly inserts IDs, adjust the sequence in the same reviewed transaction:

```sql
with accepted_ids as (
  select coalesce(max(substring(public_id from 4)::bigint), 0) as maximum_id
  from public.finds
)
select setval(
  'public.find_public_id_seq',
  greatest(maximum_id, 1),
  maximum_id > 0
)
from accepted_ids;
```

The next generated value will be above the highest accepted numeric suffix. The collision loop remains a final safeguard.

## Storage model

`find-images` is a private bucket. Authenticated, allowlisted admins alone may insert, update, or delete its object metadata through RLS. The anonymous role receives only the `select` privilege needed for public-object policy evaluation; the inherited authenticated privilege remains governed by the existing catalog-admin policies, so ordinary authenticated callers receive no rows. The M08 public object policy applies only to `anon` and permits an authenticated-object information or download operation only when its name matches a `find_photos.storage_path` row whose parent Find is published and not archived. A new check constraint requires the path's embedded Find UUID to equal `find_photos.find_id`, preventing cross-Find reassignment.

The public browser downloads an eligible object through the private authenticated-object Storage route using the browser-safe key and converts the response to a page-local `blob:` URL. Opaque publishable keys are never placed in a Bearer header; a validated legacy `anon` JWT retains its required Bearer header. The browser never requests a bucket listing or creates a durable public object URL. The operation-aware anonymous policy permits only authenticated-object information and download operations, so listing and unrelated Storage `SELECT` operations are denied. A hidden, unpublished, archived, unrelated, cross-Find, missing, or malformed image receives no object access and the UI uses the approved fallback.

The bucket accepts JPEG, PNG, and WebP objects up to 10 MiB. HEIC must be converted before upload. Object names follow `finds/{find-uuid}/{unique-filename}`; owner filenames are input labels, never trusted uniqueness keys. A generated unique filename must be used when an upload is implemented later.

## Public hybrid client

The Pages artifact contains only the validated project URL and browser-safe publishable key for public reads; it does not contain a project reference, authenticated session, owner identifier, or privileged value. Requests use explicit column selections and a bounded timeout.

The public adapter installs the five protected static Finds first, rejects a remote duplicate of any protected public ID, orders eligible remote Finds deterministically, and appends them. No remote catalog response is persisted in browser storage. Failed or malformed requests restore the static catalog. Collections are displayed as active only when the merged eligible catalog has content; Featured, Latest, and Find of the Week retain their accepted static editorial definitions.

## Migration ownership

The ordered foundation migrations own schemas, tables, functions, triggers, grants, policies, indexes, and hosted bucket reconciliation. M08 adds one narrow migration for column grants and private image reads; it adds no catalog state and changes no data. `supabase/seed.sql` owns only the six-record local Collection seed. Remote changes must be reviewed as migrations, dry-run before push, and performed only after MASTER acceptance.

See `docs/CONTROLLED_DYNAMIC_PUBLISHING.md` for the Stage A failure, rollback, and controlled Stage B canary procedures.
