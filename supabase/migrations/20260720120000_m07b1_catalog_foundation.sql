-- M07B-1: secure catalog, authorization, and Storage foundation.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.catalog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  constraint catalog_admins_role_check check (role in ('owner', 'editor'))
);

revoke all on private.catalog_admins from public, anon, authenticated;

create or replace function private.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and exists (
      select 1
      from private.catalog_admins
      where user_id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function private.is_catalog_admin() from public;
grant execute on function private.is_catalog_admin() to authenticated;

create table public.collections (
  id text primary key,
  label text not null,
  status text not null,
  sort_order integer not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_id_check check (
    id in ('jewelry', 'vintage', 'home-decor', 'kitchen', 'collectibles', 'new-items')
  ),
  constraint collections_label_check check (char_length(btrim(label)) between 1 and 100),
  constraint collections_status_check check (status in ('active', 'coming_soon')),
  constraint collections_sort_order_check check (sort_order > 0),
  constraint collections_description_check check (
    description is null or char_length(btrim(description)) between 1 and 500
  ),
  constraint collections_sort_order_key unique (sort_order)
);

create sequence public.find_public_id_seq as bigint start with 1 increment by 1 no cycle;

create table public.finds (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  slug text unique,
  legacy_id integer unique,
  title text not null,
  collection_id text not null references public.collections(id),
  price_amount numeric(10, 2) not null,
  price_currency text not null default 'USD',
  availability text not null,
  description text not null,
  condition text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finds_public_id_check check (public_id ~ '^BU-[0-9]{4,}$'),
  constraint finds_slug_check check (
    slug is null or (char_length(slug) between 1 and 160 and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
  ),
  constraint finds_legacy_id_check check (legacy_id is null or legacy_id > 0),
  constraint finds_title_check check (char_length(btrim(title)) between 1 and 200),
  constraint finds_price_amount_check check (price_amount > 0),
  constraint finds_price_currency_check check (price_currency = 'USD'),
  constraint finds_availability_check check (availability in ('available', 'reserved', 'sold')),
  constraint finds_description_check check (char_length(btrim(description)) between 1 and 5000),
  constraint finds_condition_check check (
    condition is null or char_length(btrim(condition)) between 1 and 500
  )
);

create or replace function private.next_find_public_id()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  loop
    candidate := 'BU-' || lpad(nextval('public.find_public_id_seq')::text, 4, '0');
    exit when not exists (
      select 1 from public.finds where public_id = candidate
    );
  end loop;

  return candidate;
end;
$$;

revoke all on function private.next_find_public_id() from public;
grant execute on function private.next_find_public_id() to authenticated;
revoke all on sequence public.find_public_id_seq from public, anon, authenticated;

alter table public.finds
  alter column public_id set default private.next_find_public_id();

create table public.find_photos (
  id uuid primary key default gen_random_uuid(),
  find_id uuid not null references public.finds(id) on delete cascade,
  storage_path text not null unique,
  role text not null,
  sequence integer not null,
  alt_text text not null,
  width integer,
  height integer,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint find_photos_storage_path_check check (
    storage_path ~ '^finds/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$'
  ),
  constraint find_photos_role_check check (role in ('primary', 'additional')),
  constraint find_photos_sequence_check check (sequence > 0),
  constraint find_photos_alt_text_check check (char_length(btrim(alt_text)) between 1 and 500),
  constraint find_photos_width_check check (width is null or width > 0),
  constraint find_photos_height_check check (height is null or height > 0),
  constraint find_photos_find_sequence_key unique (find_id, sequence)
);

create unique index find_photos_one_primary_per_find_idx
  on public.find_photos (find_id)
  where role = 'primary';

create table public.find_relations (
  find_id uuid not null references public.finds(id) on delete cascade,
  related_find_id uuid not null references public.finds(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (find_id, related_find_id),
  constraint find_relations_no_self_check check (find_id <> related_find_id),
  constraint find_relations_sort_order_check check (sort_order >= 0)
);

create or replace function private.set_collection_timestamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := statement_timestamp();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function private.maintain_find_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    new.created_by := actor;
    new.created_at := statement_timestamp();
    new.published_at := case when new.is_published then statement_timestamp() else null end;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.published_at := case
      when old.published_at is not null then old.published_at
      when new.is_published and not old.is_published then statement_timestamp()
      else null
    end;
  end if;

  new.updated_by := actor;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function private.maintain_find_photo_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.created_at := statement_timestamp();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.set_collection_timestamps() from public, anon, authenticated;
revoke all on function private.maintain_find_audit() from public, anon, authenticated;
revoke all on function private.maintain_find_photo_audit() from public, anon, authenticated;

create trigger collections_maintain_timestamps
before insert or update on public.collections
for each row execute function private.set_collection_timestamps();

create trigger finds_maintain_audit
before insert or update on public.finds
for each row execute function private.maintain_find_audit();

create trigger find_photos_maintain_audit
before insert or update on public.find_photos
for each row execute function private.maintain_find_photo_audit();

create index collections_status_sort_idx on public.collections (status, sort_order);
create index finds_collection_id_idx on public.finds (collection_id);
create index finds_availability_idx on public.finds (availability);
create index finds_created_by_idx on public.finds (created_by) where created_by is not null;
create index finds_updated_by_idx on public.finds (updated_by) where updated_by is not null;
create index finds_public_catalog_idx
  on public.finds (is_featured desc, sort_order, published_at desc)
  where is_published and archived_at is null;
create index find_photos_find_id_idx on public.find_photos (find_id);
create index find_photos_created_by_idx on public.find_photos (created_by) where created_by is not null;
create index find_relations_related_find_id_idx on public.find_relations (related_find_id);

alter table public.collections enable row level security;
alter table public.finds enable row level security;
alter table public.find_photos enable row level security;
alter table public.find_relations enable row level security;

revoke all on public.collections, public.finds, public.find_photos, public.find_relations
  from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.collections, public.finds, public.find_photos, public.find_relations
  to anon, authenticated;
grant insert, update, delete on public.collections, public.finds, public.find_photos, public.find_relations
  to authenticated;

create policy collections_public_read
on public.collections
for select
to anon, authenticated
using (true);

create policy collections_admin_insert
on public.collections
for insert
to authenticated
with check ((select private.is_catalog_admin()));

create policy collections_admin_update
on public.collections
for update
to authenticated
using ((select private.is_catalog_admin()))
with check ((select private.is_catalog_admin()));

create policy collections_admin_delete
on public.collections
for delete
to authenticated
using ((select private.is_catalog_admin()));

create policy finds_public_read
on public.finds
for select
to anon, authenticated
using (is_published = true and archived_at is null);

create policy finds_admin_read
on public.finds
for select
to authenticated
using ((select private.is_catalog_admin()));

create policy finds_admin_insert
on public.finds
for insert
to authenticated
with check ((select private.is_catalog_admin()));

create policy finds_admin_update
on public.finds
for update
to authenticated
using ((select private.is_catalog_admin()))
with check ((select private.is_catalog_admin()));

create policy finds_admin_delete
on public.finds
for delete
to authenticated
using ((select private.is_catalog_admin()));

create policy find_photos_public_read
on public.find_photos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.finds
    where finds.id = find_photos.find_id
      and finds.is_published = true
      and finds.archived_at is null
  )
);

create policy find_photos_admin_read
on public.find_photos
for select
to authenticated
using ((select private.is_catalog_admin()));

create policy find_photos_admin_insert
on public.find_photos
for insert
to authenticated
with check ((select private.is_catalog_admin()));

create policy find_photos_admin_update
on public.find_photos
for update
to authenticated
using ((select private.is_catalog_admin()))
with check ((select private.is_catalog_admin()));

create policy find_photos_admin_delete
on public.find_photos
for delete
to authenticated
using ((select private.is_catalog_admin()));

create policy find_relations_public_read
on public.find_relations
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.finds source_find
    where source_find.id = find_relations.find_id
      and source_find.is_published = true
      and source_find.archived_at is null
  )
  and exists (
    select 1
    from public.finds related_find
    where related_find.id = find_relations.related_find_id
      and related_find.is_published = true
      and related_find.archived_at is null
  )
);

create policy find_relations_admin_read
on public.find_relations
for select
to authenticated
using ((select private.is_catalog_admin()));

create policy find_relations_admin_insert
on public.find_relations
for insert
to authenticated
with check ((select private.is_catalog_admin()));

create policy find_relations_admin_update
on public.find_relations
for update
to authenticated
using ((select private.is_catalog_admin()))
with check ((select private.is_catalog_admin()));

create policy find_relations_admin_delete
on public.find_relations
for delete
to authenticated
using ((select private.is_catalog_admin()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'find-images',
  'find-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

revoke all on storage.objects from anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

create policy find_images_admin_list
on storage.objects
for select
to authenticated
using (
  bucket_id = 'find-images'
  and (select private.is_catalog_admin())
);

create policy find_images_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'find-images'
  and (select private.is_catalog_admin())
  and name ~ '^finds/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$'
);

create policy find_images_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'find-images'
  and (select private.is_catalog_admin())
)
with check (
  bucket_id = 'find-images'
  and (select private.is_catalog_admin())
  and name ~ '^finds/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$'
);

create policy find_images_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'find-images'
  and (select private.is_catalog_admin())
);
