begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select no_plan();

select is(
  (select public from storage.buckets where id = 'find-images'),
  false,
  'M08 keeps the Find image bucket private'
);

select is(
  (
    select array_to_string(roles, ',')
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'find_images_public_read'
  ),
  'anon',
  'public Storage eligibility policy applies only to anon'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'find_images_public_read'
      and position('allow_any_operation' in qual::text) > 0
      and position('object.get_authenticated_info' in qual::text) > 0
      and position('object.get_authenticated' in qual::text) > 0
      and position('object.list' in qual::text) = 0
  ),
  'anonymous Storage policy permits only authenticated-object information and downloads'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finds'
      and policyname = 'finds_public_read'
      and 'anon' = any (roles)
      and not ('authenticated' = any (roles))
  ),
  'public catalog reads use only the anonymous browser role'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'find_photos_find_scoped_storage_path_check'
      and conrelid = 'public.find_photos'::regclass
      and contype = 'c'
  ),
  'photo metadata must remain scoped to its parent Find path'
);

select ok(
  has_column_privilege('anon', 'public.finds', 'public_id', 'select')
  and has_column_privilege('anon', 'public.finds', 'title', 'select')
  and has_column_privilege('anon', 'public.finds', 'is_published', 'select')
  and has_column_privilege('anon', 'public.finds', 'archived_at', 'select'),
  'anonymous readers have the approved public Find columns'
);

select ok(
  not has_column_privilege('anon', 'public.finds', 'created_by', 'select')
  and not has_column_privilege('anon', 'public.finds', 'updated_by', 'select')
  and not has_column_privilege('anon', 'public.finds', 'created_at', 'select')
  and not has_column_privilege('anon', 'public.finds', 'updated_at', 'select')
  and not has_column_privilege('anon', 'public.finds', 'published_at', 'select')
  and not has_column_privilege('anon', 'public.finds', 'is_featured', 'select'),
  'anonymous readers cannot select Find owner, audit, or editorial columns'
);

select ok(
  not has_column_privilege('anon', 'public.find_photos', 'created_by', 'select')
  and not has_column_privilege('anon', 'public.find_photos', 'created_at', 'select')
  and not has_column_privilege('anon', 'public.find_photos', 'updated_at', 'select')
  and not has_column_privilege('anon', 'public.find_relations', 'created_at', 'select')
  and not has_column_privilege('anon', 'public.collections', 'created_at', 'select')
  and not has_column_privilege('anon', 'public.collections', 'updated_at', 'select'),
  'anonymous readers cannot select other catalog audit columns'
);

select ok(
  has_column_privilege('authenticated', 'public.finds', 'is_featured', 'select')
  and has_column_privilege('authenticated', 'public.finds', 'published_at', 'select')
  and has_column_privilege('authenticated', 'public.finds', 'legacy_id', 'select')
  and not has_column_privilege('authenticated', 'public.finds', 'created_by', 'select')
  and not has_column_privilege('authenticated', 'public.finds', 'updated_by', 'select')
  and not has_column_privilege('authenticated', 'public.finds', 'created_at', 'select')
  and not has_column_privilege('authenticated', 'public.finds', 'updated_at', 'select'),
  'authenticated maintenance retains required fields without owner or audit columns'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values
  (
    '20000000-0000-4000-8000-000000000101',
    'authenticated',
    'authenticated',
    'm08-owner@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000102',
    'authenticated',
    'authenticated',
    'm08-editor@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000103',
    'authenticated',
    'authenticated',
    'm08-reader@example.test',
    '',
    now(),
    now(),
    now()
  );

insert into private.catalog_admins (user_id, role)
values
  ('20000000-0000-4000-8000-000000000101', 'owner'),
  ('20000000-0000-4000-8000-000000000102', 'editor');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000101', true);
set local role authenticated;

insert into public.finds (
  id, public_id, slug, title, collection_id, price_amount, availability,
  description, is_published, archived_at
)
values
  (
    '20000000-0000-4000-8000-000000000201',
    'BU-9101',
    'fictional-m08-public-find',
    'Fictional M08 Public Find',
    'jewelry',
    11.00,
    'available',
    'Fictional published fixture used only inside a rolled-back local test.',
    true,
    null
  ),
  (
    '20000000-0000-4000-8000-000000000202',
    'BU-9102',
    'fictional-m08-hidden-find',
    'Fictional M08 Hidden Find',
    'jewelry',
    12.00,
    'available',
    'Fictional hidden fixture used only inside a rolled-back local test.',
    false,
    null
  ),
  (
    '20000000-0000-4000-8000-000000000203',
    'BU-9103',
    'fictional-m08-archived-find',
    'Fictional M08 Archived Find',
    'jewelry',
    13.00,
    'reserved',
    'Fictional archived fixture used only inside a rolled-back local test.',
    true,
    now()
  );

select throws_ok(
  $$
    insert into public.find_photos (
      id, find_id, storage_path, role, sequence, alt_text, width, height
    )
    values (
      '20000000-0000-4000-8000-000000000399',
      '20000000-0000-4000-8000-000000000201',
      'finds/20000000-0000-4000-8000-000000000202/cross-find.jpg',
      'additional',
      9,
      'Fictional cross-Find object that must be rejected.',
      800,
      600
    )
  $$,
  '23514',
  'new row for relation "find_photos" violates check constraint "find_photos_find_scoped_storage_path_check"',
  'photo metadata cannot expose an object belonging to a different Find'
);

insert into public.find_photos (
  id, find_id, storage_path, role, sequence, alt_text, width, height
)
values
  (
    '20000000-0000-4000-8000-000000000301',
    '20000000-0000-4000-8000-000000000201',
    'finds/20000000-0000-4000-8000-000000000201/public.jpg',
    'primary',
    1,
    'Fictional published object.',
    800,
    600
  ),
  (
    '20000000-0000-4000-8000-000000000302',
    '20000000-0000-4000-8000-000000000202',
    'finds/20000000-0000-4000-8000-000000000202/hidden.jpg',
    'primary',
    1,
    'Fictional hidden object.',
    800,
    600
  ),
  (
    '20000000-0000-4000-8000-000000000303',
    '20000000-0000-4000-8000-000000000203',
    'finds/20000000-0000-4000-8000-000000000203/archived.jpg',
    'primary',
    1,
    'Fictional archived object.',
    800,
    600
  );

insert into public.find_relations (find_id, related_find_id, sort_order)
values
  (
    '20000000-0000-4000-8000-000000000201',
    '20000000-0000-4000-8000-000000000202',
    1
  );

insert into storage.objects (bucket_id, name, owner_id)
values
  (
    'find-images',
    'finds/20000000-0000-4000-8000-000000000201/public.jpg',
    '20000000-0000-4000-8000-000000000101'
  ),
  (
    'find-images',
    'finds/20000000-0000-4000-8000-000000000202/hidden.jpg',
    '20000000-0000-4000-8000-000000000101'
  ),
  (
    'find-images',
    'finds/20000000-0000-4000-8000-000000000203/archived.jpg',
    '20000000-0000-4000-8000-000000000101'
  ),
  (
    'find-images',
    'finds/20000000-0000-4000-8000-000000000201/orphan.jpg',
    '20000000-0000-4000-8000-000000000101'
  );

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select array_agg(public_id order by public_id) from public.finds),
  array['BU-9101']::text[],
  'anonymous role can read only publicly eligible records'
);

select is(
  (select count(*) from public.finds where public_id = 'BU-9102'),
  0::bigint,
  'anonymous role cannot read hidden or unpublished records'
);

select is(
  (select count(*) from public.finds where public_id = 'BU-9103'),
  0::bigint,
  'anonymous role cannot read inactive or archived records'
);

select throws_ok(
  $$ select created_by from public.finds $$,
  '42501',
  'permission denied for table finds',
  'anonymous role cannot read protected administrative columns'
);

select is(
  (select count(*) from public.find_photos),
  1::bigint,
  'anonymous photo metadata follows public eligibility'
);

select is(
  (
    select count(*)
    from public.find_photos
    where find_id = '20000000-0000-4000-8000-000000000201'
  ),
  1::bigint,
  'published image metadata is eligible'
);

select is(
  (
    select count(*)
    from public.find_photos
    where find_id = '20000000-0000-4000-8000-000000000202'
  ),
  0::bigint,
  'hidden image metadata is denied'
);

select is(
  (
    select count(*)
    from public.find_photos
    where find_id = '20000000-0000-4000-8000-000000000203'
  ),
  0::bigint,
  'archived image metadata is denied'
);

select is(
  (select count(*) from public.find_relations),
  0::bigint,
  'anonymous relations require both Finds to be eligible'
);

select set_config('storage.operation', 'object.get_authenticated', true);

select is(
  (
    select array_agg(name order by name)
    from storage.objects
    where bucket_id = 'find-images'
  ),
  array['finds/20000000-0000-4000-8000-000000000201/public.jpg']::text[],
  'authenticated-object download access matches public eligibility'
);

select is(
  (
    select count(*)
    from storage.objects
    where name = 'finds/20000000-0000-4000-8000-000000000202/hidden.jpg'
  ),
  0::bigint,
  'hidden object download is denied'
);

select is(
  (
    select count(*)
    from storage.objects
    where name = 'finds/20000000-0000-4000-8000-000000000203/archived.jpg'
  ),
  0::bigint,
  'archived object download is denied'
);

select is(
  (
    select count(*)
    from storage.objects
    where name = 'finds/20000000-0000-4000-8000-000000000201/orphan.jpg'
  ),
  0::bigint,
  'orphan object download is denied'
);

select set_config('storage.operation', 'object.get_authenticated_info', true);

select is(
  (
    select count(*)
    from storage.objects
    where name = 'finds/20000000-0000-4000-8000-000000000201/public.jpg'
  ),
  1::bigint,
  'authenticated-object information is permitted for an eligible image'
);

select set_config('storage.operation', 'object.list', true);

select is(
  (select count(*) from storage.objects where bucket_id = 'find-images'),
  0::bigint,
  'anonymous bucket listing is denied'
);

reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000103', true);
set local role authenticated;
select set_config('storage.operation', 'object.get_authenticated', true);

select is(
  (select count(*) from public.finds),
  0::bigint,
  'an authenticated non-admin cannot read catalog rows or maintenance fields'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'find-images'),
  0::bigint,
  'an unrelated authenticated user gains no administrative Storage access'
);

select lives_ok(
  $$
    update public.finds
    set is_published = true
    where public_id = 'BU-9102'
  $$,
  'an authenticated unauthorized publication attempt is safely filtered'
);

reset role;

select is(
  (select is_published from public.finds where public_id = 'BU-9102'),
  false,
  'an authenticated unauthorized user cannot publish'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000102', true);
set local role authenticated;
select set_config('storage.operation', 'object.list', true);

select is(
  (select count(*) from storage.objects where bucket_id = 'find-images'),
  4::bigint,
  'an accepted catalog admin retains Manager image access'
);

select lives_ok(
  $$
    update public.finds
    set is_published = true
    where public_id = 'BU-9102'
  $$,
  'accepted editor role can publish'
);

select lives_ok(
  $$
    update public.finds
    set is_published = false
    where public_id = 'BU-9102'
  $$,
  'accepted editor role can unpublish'
);

reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000101', true);
set local role authenticated;

select lives_ok(
  $$
    update public.finds
    set is_published = false
    where public_id = 'BU-9101'
  $$,
  'accepted owner role can unpublish'
);

select is(
  (select count(*) from public.finds where public_id between 'BU-9101' and 'BU-9103'),
  3::bigint,
  'publication changes do not delete Finds'
);

select is(
  (select count(*) from public.find_photos where find_id in (
    '20000000-0000-4000-8000-000000000201',
    '20000000-0000-4000-8000-000000000202',
    '20000000-0000-4000-8000-000000000203'
  )),
  3::bigint,
  'publication changes do not delete photo metadata'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'find-images'),
  4::bigint,
  'publication changes do not delete Storage objects'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select set_config('storage.operation', 'object.get_authenticated', true);

select is(
  (select count(*) from public.finds where public_id = 'BU-9101'),
  0::bigint,
  'an unpublished Find disappears from anonymous reads immediately'
);

select is(
  (select count(*) from public.find_photos where find_id = '20000000-0000-4000-8000-000000000201'),
  0::bigint,
  'an unpublished Find photo disappears from anonymous reads immediately'
);

select is(
  (
    select count(*)
    from storage.objects
    where name = 'finds/20000000-0000-4000-8000-000000000201/public.jpg'
  ),
  0::bigint,
  'an unpublished Find object disappears from anonymous Storage reads immediately'
);

reset role;
select setval('public.find_public_id_seq', 9, true);
select * from finish();
rollback;
