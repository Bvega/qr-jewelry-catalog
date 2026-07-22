begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select no_plan();

select ok(to_regnamespace('private') is not null, 'private schema exists');
select ok(to_regclass('private.catalog_admins') is not null, 'catalog admin allowlist exists');
select ok(to_regclass('public.collections') is not null, 'collections table exists');
select ok(to_regclass('public.finds') is not null, 'finds table exists');
select ok(to_regclass('public.find_photos') is not null, 'find photos table exists');
select ok(to_regclass('public.find_relations') is not null, 'find relations table exists');

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finds'
      and column_name in (
        'id', 'public_id', 'slug', 'legacy_id', 'title', 'collection_id',
        'price_amount', 'price_currency', 'availability', 'description', 'condition',
        'is_published', 'is_featured', 'sort_order', 'published_at', 'archived_at',
        'created_by', 'updated_by', 'created_at', 'updated_at'
      )
  ),
  20::bigint,
  'finds exposes every required foundation column'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'catalog_admins'
      and column_name in ('user_id', 'role', 'created_at')
  ),
  3::bigint,
  'catalog admins exposes every required column'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'collections'
      and column_name in ('id', 'label', 'status', 'sort_order', 'description', 'created_at', 'updated_at')
  ),
  7::bigint,
  'collections exposes every required column'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'find_photos'
      and column_name in (
        'id', 'find_id', 'storage_path', 'role', 'sequence', 'alt_text',
        'width', 'height', 'created_by', 'created_at', 'updated_at'
      )
  ),
  11::bigint,
  'find photos exposes every required column'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'find_relations'
      and column_name in ('find_id', 'related_find_id', 'sort_order', 'created_at')
  ),
  4::bigint,
  'find relations exposes every required column'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'catalog_admins_role_check'
      and conrelid = 'private.catalog_admins'::regclass
      and contype = 'c'
  ),
  'admin roles are constrained'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'finds_public_id_check'
      and conrelid = 'public.finds'::regclass
      and contype = 'c'
  ),
  'public IDs have a check constraint'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'find_relations_no_self_check'
      and conrelid = 'public.find_relations'::regclass
      and contype = 'c'
  ),
  'self-relations have a check constraint'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conname = any (array[
      'catalog_admins_role_check',
      'collections_id_check',
      'collections_label_check',
      'collections_status_check',
      'collections_sort_order_check',
      'collections_description_check',
      'collections_sort_order_key',
      'finds_public_id_check',
      'finds_slug_check',
      'finds_legacy_id_check',
      'finds_title_check',
      'finds_price_amount_check',
      'finds_price_currency_check',
      'finds_availability_check',
      'finds_description_check',
      'finds_condition_check',
      'find_photos_storage_path_check',
      'find_photos_role_check',
      'find_photos_sequence_check',
      'find_photos_alt_text_check',
      'find_photos_width_check',
      'find_photos_height_check',
      'find_photos_find_sequence_key',
      'find_relations_no_self_check',
      'find_relations_sort_order_check'
    ])
  ),
  25::bigint,
  'all named foundation constraints exist'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid in (
      'private.catalog_admins'::regclass,
      'public.collections'::regclass,
      'public.finds'::regclass,
      'public.find_photos'::regclass,
      'public.find_relations'::regclass
    )
      and contype = 'f'
  ),
  8::bigint,
  'all catalog foreign keys exist'
);

select ok(
  to_regclass('public.find_photos_one_primary_per_find_idx') is not null,
  'a Find can have at most one primary photo'
);

select is(
  (
    select count(*)
    from pg_class
    where oid in (
      'public.collections'::regclass,
      'public.finds'::regclass,
      'public.find_photos'::regclass,
      'public.find_relations'::regclass
    )
      and relrowsecurity
  ),
  4::bigint,
  'RLS is enabled on every exposed catalog table'
);

select ok(
  exists (
    select 1
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'private'
      and proc.proname = 'is_catalog_admin'
      and proc.prosecdef
  ),
  'admin evaluation uses a security-definer helper'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('collections', 'finds', 'find_photos', 'find_relations')
  ),
  19::bigint,
  'catalog tables expose the complete public/admin policy set'
);

select is(
  (select count(*) from public.collections),
  6::bigint,
  'the local seed contains the six approved Collections'
);

select is(
  (select count(*) from public.collections where status = 'active'),
  1::bigint,
  'only Jewelry is active in the local seed'
);

select is(
  (select count(*) from public.finds),
  0::bigint,
  'the local seed contains no Finds'
);

select is(
  (select private.is_catalog_admin()),
  false,
  'an unauthenticated context is not an admin'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000101',
    'authenticated',
    'authenticated',
    'catalog-admin@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000102',
    'authenticated',
    'authenticated',
    'catalog-reader@example.test',
    '',
    now(),
    now(),
    now()
  );

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000102', true);
set local role authenticated;

select is(
  (select private.is_catalog_admin()),
  false,
  'an authenticated non-admin is not an admin'
);

select throws_ok(
  $$
    insert into public.finds (
      id, public_id, title, collection_id, price_amount, availability, description
    ) values (
      '10000000-0000-4000-8000-000000000299',
      'BU-8999',
      'Rejected Test Find',
      'jewelry',
      10.00,
      'available',
      'Fictional row that must be rejected.'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "finds"',
  'an authenticated non-admin cannot create a Find'
);

reset role;

insert into private.catalog_admins (user_id, role)
values ('10000000-0000-4000-8000-000000000101', 'owner');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000101', true);
set local role authenticated;

select is(
  (select private.is_catalog_admin()),
  true,
  'an allowlisted authenticated user is an admin'
);

select lives_ok(
  $$
    insert into public.finds (
      id, title, collection_id, price_amount, availability, description, is_published
    ) values
      (
        '10000000-0000-4000-8000-000000000201',
        'Fictional Draft Find',
        'jewelry',
        10.00,
        'available',
        'Fictional draft used only by the rollback test.',
        false
      ),
      (
        '10000000-0000-4000-8000-000000000202',
        'Fictional Published Find',
        'jewelry',
        20.00,
        'reserved',
        'Fictional published row used only by the rollback test.',
        true
      ),
      (
        '10000000-0000-4000-8000-000000000203',
        'Fictional Archived Find',
        'jewelry',
        30.00,
        'sold',
        'Fictional archived row used only by the rollback test.',
        true
      )
  $$,
  'a catalog admin can create Finds'
);

select lives_ok(
  $$
    insert into public.finds (
      id, public_id, title, collection_id, price_amount, availability, description
    ) values (
      '10000000-0000-4000-8000-000000000204',
      'BU-0004',
      'Fictional Explicit-ID Find',
      'jewelry',
      40.00,
      'available',
      'Fictional explicit ID used only by the rollback test.'
    )
  $$,
  'accepted existing IDs can be inserted explicitly'
);

select lives_ok(
  $$
    insert into public.finds (
      id, title, collection_id, price_amount, availability, description
    ) values (
      '10000000-0000-4000-8000-000000000205',
      'Fictional Collision-Safe Find',
      'jewelry',
      50.00,
      'available',
      'Fictional automatic ID used only by the rollback test.'
    )
  $$,
  'automatic IDs safely advance past an explicit collision'
);

select lives_ok(
  $$
    update public.finds
    set title = 'Fictional Published Find Updated'
    where id = '10000000-0000-4000-8000-000000000202'
  $$,
  'a catalog admin can update a Find'
);

select lives_ok(
  $$
    update public.finds
    set archived_at = now()
    where id = '10000000-0000-4000-8000-000000000203'
  $$,
  'a catalog admin can archive a Find independently of availability'
);

reset role;

select is(
  (
    select count(*)
    from public.finds
    where public_id ~ '^BU-[0-9]{4,}$'
  ),
  5::bigint,
  'automatic and explicit public IDs use the required format'
);

select is(
  (select count(distinct public_id) from public.finds),
  5::bigint,
  'public IDs are unique'
);

select is(
  (
    select public_id
    from public.finds
    where id = '10000000-0000-4000-8000-000000000205'
  ),
  'BU-0013',
  'the generator advances monotonically above the reserved sequence floor'
);

select is(
  (
    select created_by
    from public.finds
    where id = '10000000-0000-4000-8000-000000000202'
  ),
  '10000000-0000-4000-8000-000000000101'::uuid,
  'the audit trigger records the authenticated creator'
);

select ok(
  (
    select published_at is not null
    from public.finds
    where id = '10000000-0000-4000-8000-000000000202'
  ),
  'the audit trigger records first publication'
);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select count(*) from public.finds),
  1::bigint,
  'anon sees only published non-archived Finds'
);

select is(
  (
    select count(*)
    from public.finds
    where id = '10000000-0000-4000-8000-000000000201'
  ),
  0::bigint,
  'an unpublished Find is invisible to anon'
);

select is(
  (
    select count(*)
    from public.finds
    where id = '10000000-0000-4000-8000-000000000202'
  ),
  1::bigint,
  'a published non-archived Find is visible to anon'
);

select is(
  (
    select count(*)
    from public.finds
    where id = '10000000-0000-4000-8000-000000000203'
  ),
  0::bigint,
  'an archived Find is invisible to anon'
);

reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000102', true);
set local role authenticated;

select lives_ok(
  $$
    update public.finds
    set title = 'Unauthorized Update'
    where id = '10000000-0000-4000-8000-000000000202'
  $$,
  'a non-admin update is safely filtered by RLS'
);

reset role;

select is(
  (
    select title
    from public.finds
    where id = '10000000-0000-4000-8000-000000000202'
  ),
  'Fictional Published Find Updated',
  'an authenticated non-admin cannot modify a Find'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000101', true);
set local role authenticated;

select lives_ok(
  $$
    insert into public.find_photos (
      id, find_id, storage_path, role, sequence, alt_text, width, height
    ) values
      (
        '10000000-0000-4000-8000-000000000301',
        '10000000-0000-4000-8000-000000000201',
        'finds/10000000-0000-4000-8000-000000000201/draft-image.jpg',
        'primary',
        1,
        'Fictional draft object on a plain background.',
        800,
        600
      ),
      (
        '10000000-0000-4000-8000-000000000302',
        '10000000-0000-4000-8000-000000000202',
        'finds/10000000-0000-4000-8000-000000000202/published-image.jpg',
        'primary',
        1,
        'Fictional published object on a plain background.',
        800,
        600
      )
  $$,
  'a catalog admin can create photo metadata'
);

select throws_ok(
  $$
    insert into public.find_relations (find_id, related_find_id)
    values (
      '10000000-0000-4000-8000-000000000202',
      '10000000-0000-4000-8000-000000000202'
    )
  $$,
  '23514',
  'new row for relation "find_relations" violates check constraint "find_relations_no_self_check"',
  'a self-relation fails'
);

reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select count(*) from public.find_photos),
  1::bigint,
  'photo visibility follows parent publication state'
);

reset role;

select is(
  (select public from storage.buckets where id = 'find-images'),
  true,
  'find-images is a public-retrieval bucket'
);

select is(
  (select file_size_limit from storage.buckets where id = 'find-images'),
  10485760::bigint,
  'find-images has a 10 MiB limit'
);

select ok(
  (
    select allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
    from storage.buckets
    where id = 'find-images'
  ),
  'find-images permits only JPEG, PNG, and WebP'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000102', true);
set local role authenticated;

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values (
      'find-images',
      'finds/10000000-0000-4000-8000-000000000202/nonadmin-image.jpg'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'a non-admin cannot write a Storage object'
);

reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000101', true);
set local role authenticated;

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values (
      'find-images',
      'finds/10000000-0000-4000-8000-000000000202/admin-image.jpg'
    )
  $$,
  'a catalog admin can write a valid Storage object path'
);

reset role;

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'find-images'
      and name = 'finds/10000000-0000-4000-8000-000000000202/admin-image.jpg'
  ),
  1::bigint,
  'the admin Storage write is present inside the test transaction'
);

select setval('public.find_public_id_seq', 9, true);

select * from finish();
rollback;
