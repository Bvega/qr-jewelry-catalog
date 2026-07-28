-- M08 Stage A: narrow public column access and make Find images RLS-protected.
--
-- The existing publication model remains authoritative:
--   is_published = true and archived_at is null.
-- Existing table constraints provide the required public-content completeness.

alter table public.find_photos
  add constraint find_photos_find_scoped_storage_path_check
  check (storage_path like ('finds/' || find_id::text || '/%'));

-- Remove the earlier whole-table reads. Anonymous browsers receive only the
-- public contract, while authenticated maintenance retains only the extra
-- legacy/editorial fields required by the accepted M07B migration workflow.
revoke select on public.collections, public.finds, public.find_photos, public.find_relations
  from anon, authenticated;

grant select (id, label, status, sort_order, description)
  on public.collections to anon;

grant select (
  id,
  public_id,
  slug,
  title,
  collection_id,
  price_amount,
  price_currency,
  availability,
  description,
  condition,
  is_published,
  sort_order,
  archived_at
) on public.finds to anon;

grant select (
  id,
  find_id,
  storage_path,
  role,
  sequence,
  alt_text,
  width,
  height
) on public.find_photos to anon;

grant select (find_id, related_find_id, sort_order)
  on public.find_relations to anon;

grant select (id, label, status, sort_order, description)
  on public.collections to authenticated;

grant select (
  id,
  public_id,
  slug,
  legacy_id,
  title,
  collection_id,
  price_amount,
  price_currency,
  availability,
  description,
  condition,
  is_published,
  is_featured,
  sort_order,
  published_at,
  archived_at
) on public.finds to authenticated;

grant select (
  id,
  find_id,
  storage_path,
  role,
  sequence,
  alt_text,
  width,
  height
) on public.find_photos to authenticated;

grant select (find_id, related_find_id, sort_order)
  on public.find_relations to authenticated;

-- Public catalog reads use the raw anonymous browser role. Authenticated
-- catalog reads are reserved for allowlisted Manager/migration users so an
-- unrelated authenticated account cannot observe maintenance-only columns.
alter policy collections_public_read on public.collections to anon;
alter policy finds_public_read on public.finds to anon;
alter policy find_photos_public_read on public.find_photos to anon;
alter policy find_relations_public_read on public.find_relations to anon;

create policy collections_admin_read
on public.collections
for select
to authenticated
using ((select private.is_catalog_admin()));

update storage.buckets
set public = false
where id = 'find-images';

grant select on storage.objects to anon;

create policy find_images_public_read
on storage.objects
for select
to anon
using (
  bucket_id = 'find-images'
  and storage.allow_any_operation(array[
    'object.get_authenticated_info',
    'object.get_authenticated'
  ])
  and exists (
    select 1
    from public.find_photos
    join public.finds on finds.id = find_photos.find_id
    where find_photos.storage_path = objects.name
      and find_photos.storage_path like ('finds/' || finds.id::text || '/%')
      and finds.is_published = true
      and finds.archived_at is null
  )
);
