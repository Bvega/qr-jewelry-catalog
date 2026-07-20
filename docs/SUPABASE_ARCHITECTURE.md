# Supabase Architecture

M07B-1 adds a non-public backend foundation for a future Seller Catalog Manager. The existing public catalog remains static and no products are migrated by this milestone. Database migrations under `supabase/migrations/` are the source of truth; dashboard edits are not.

## Schema responsibilities

- `private.catalog_admins` is the explicit owner/editor allowlist keyed to `auth.users`. The `private` schema is excluded from the Data API and its table has no `anon` or `authenticated` privileges.
- `public.collections` stores the approved six-record Collection registry and its active/coming-soon state.
- `public.finds` stores canonical catalog records, publication state, availability, archive state, prices, legacy aliases, and audit metadata.
- `public.find_photos` stores ordered photo metadata and Storage object paths. It does not store image bytes.
- `public.find_relations` stores ordered directed relationships between distinct Finds.
- `storage.objects` remains owned by Supabase Storage. M07B-1 adds policies only for the `find-images` bucket.

## Authorization and RLS boundary

Authentication alone does not grant catalog administration. An authenticated user's `auth.uid()` must also exist in `private.catalog_admins` with the constrained role `owner` or `editor`. `private.is_catalog_admin()` is a security-definer helper with an empty explicit search path; only `authenticated` may execute it for policy evaluation.

Every application-facing `public` table has RLS enabled. `anon` and `authenticated` may read all Collection metadata. They may read a Find only when it is published and not archived. Photo rows inherit that visibility from their parent Find, and relation rows require both Finds to meet the public visibility rule. Separate authenticated policies allow an allowlisted admin to read drafts and manage Collections, Finds, photo metadata, and relations. Authenticated users who are not allowlisted receive no management access.

Grants provide only the SQL operations that a policy may authorize. RLS remains the row-level decision point; no policy trusts user-editable authentication metadata or grants writes merely because the caller is authenticated.

## Publication, availability, and audit state

Publication, availability, and archival state are separate. Public visibility requires `is_published = true` and `archived_at is null`, regardless of whether availability is `available`, `reserved`, or `sold`.

The Finds trigger overwrites client-supplied audit values. It records the authenticated actor, preserves the original creator and creation time, advances the update fields, and records the first transition to published without allowing a later client value to replace it. Collection and photo triggers similarly maintain timestamps, and the photo trigger controls its creator field.

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

`find-images` is a public-retrieval bucket, so an object URL may serve a published product image without a signed request. Public retrieval does not grant listing or mutation rights. Authenticated, allowlisted admins alone may list, insert, update, or delete its object metadata through RLS.

The bucket accepts JPEG, PNG, and WebP objects up to 10 MiB. HEIC must be converted before upload. Object names follow `finds/{find-uuid}/{unique-filename}`; owner filenames are input labels, never trusted uniqueness keys. A generated unique filename must be used when an upload is implemented later.

## Migration ownership

The ordered foundation migration owns schemas, tables, functions, triggers, grants, policies, indexes, and hosted bucket reconciliation. `supabase/seed.sql` owns only the six-record local Collection seed. Remote changes must be reviewed as migrations, dry-run before push, and performed only after MASTER acceptance.
