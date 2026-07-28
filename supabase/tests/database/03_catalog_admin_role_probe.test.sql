begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select no_plan();

select has_function(
  'public',
  'current_catalog_admin_role',
  array[]::text[],
  'the current-role probe exists in the public API schema'
);

select ok(
  (
    select proc.prosecdef
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'current_catalog_admin_role'
      and proc.pronargs = 0
  ),
  'the current-role probe is security definer'
);

select is(
  (
    select proc.proconfig
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'current_catalog_admin_role'
      and proc.pronargs = 0
  ),
  array['search_path=""']::text[],
  'the current-role probe has an explicit empty search path'
);

select function_returns(
  'public',
  'current_catalog_admin_role',
  array[]::text[],
  'text',
  'the probe returns one nullable role value rather than an allowlist row'
);

select is(
  has_function_privilege('anon', 'public.current_catalog_admin_role()', 'execute'),
  false,
  'anon cannot execute the role probe'
);

select is(
  has_function_privilege('authenticated', 'public.current_catalog_admin_role()', 'execute'),
  true,
  'authenticated callers can execute the role probe'
);

set local role anon;

select throws_ok(
  $$ select public.current_catalog_admin_role() $$,
  '42501',
  'permission denied for function current_catalog_admin_role',
  'anon execution of the role probe is denied'
);

reset role;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values
  (
    '11000000-0000-4000-8000-000000000101',
    'authenticated',
    'authenticated',
    'm07b2-owner@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '11000000-0000-4000-8000-000000000102',
    'authenticated',
    'authenticated',
    'm07b2-editor@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '11000000-0000-4000-8000-000000000103',
    'authenticated',
    'authenticated',
    'm07b2-nonadmin@example.test',
    '',
    now(),
    now(),
    now()
  );

insert into private.catalog_admins (user_id, role)
values
  ('11000000-0000-4000-8000-000000000101', 'owner'),
  ('11000000-0000-4000-8000-000000000102', 'editor');

select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000103', true);
set local role authenticated;

select is(
  public.current_catalog_admin_role(),
  null::text,
  'an authenticated non-admin receives no role'
);

select throws_ok(
  $$
    insert into public.finds (
      id, title, collection_id, price_amount, availability, description
    ) values (
      '11000000-0000-4000-8000-000000000203',
      'Rejected M07B-2 Find',
      'jewelry',
      30.00,
      'available',
      'Fictional non-admin record that RLS must reject.'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "finds"',
  'a role-probed non-admin still cannot manage Finds'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values (
      'find-images',
      'finds/11000000-0000-4000-8000-000000000203/nonadmin.jpg'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'a role-probed non-admin still cannot manage Storage'
);

reset role;

select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000101', true);
set local role authenticated;

select is(
  public.current_catalog_admin_role(),
  'owner',
  'an allowlisted owner receives owner'
);

select lives_ok(
  $$
    insert into public.finds (
      id, public_id, title, collection_id, price_amount, availability, description, is_published
    ) values (
      '11000000-0000-4000-8000-000000000201',
      'BU-9101',
      'Fictional Owner Find',
      'jewelry',
      10.00,
      'available',
      'Fictional published record used only by M07B-2 pgTAP.',
      true
    )
  $$,
  'an allowlisted owner can manage approved Find operations'
);

select lives_ok(
  $$
    insert into public.find_photos (
      id, find_id, storage_path, role, sequence, alt_text, width, height
    ) values (
      '11000000-0000-4000-8000-000000000301',
      '11000000-0000-4000-8000-000000000201',
      'finds/11000000-0000-4000-8000-000000000201/owner.jpg',
      'primary',
      1,
      'Fictional owner test object.',
      640,
      480
    )
  $$,
  'an allowlisted owner can manage primary photo metadata'
);

reset role;

select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000102', true);
set local role authenticated;

select is(
  public.current_catalog_admin_role(),
  'editor',
  'an allowlisted editor receives editor'
);

select lives_ok(
  $$
    insert into public.finds (
      id, public_id, title, collection_id, price_amount, availability, description
    ) values (
      '11000000-0000-4000-8000-000000000202',
      'BU-9102',
      'Fictional Editor Find',
      'jewelry',
      20.00,
      'reserved',
      'Fictional draft record used only by M07B-2 pgTAP.'
    )
  $$,
  'an allowlisted editor can create a Find'
);

select lives_ok(
  $$
    update public.finds
    set availability = 'sold'
    where id = '11000000-0000-4000-8000-000000000202'
  $$,
  'an allowlisted editor can update approved Find fields'
);

select lives_ok(
  $$
    update public.find_photos
    set storage_path = 'finds/11000000-0000-4000-8000-000000000201/editor-replacement.webp',
        alt_text = 'Fictional editor replacement test object.'
    where id = '11000000-0000-4000-8000-000000000301'
  $$,
  'an allowlisted editor can replace primary photo metadata'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values (
      'find-images',
      'finds/11000000-0000-4000-8000-000000000202/editor-image.webp'
    )
  $$,
  'an allowlisted editor can manage an approved Storage object path'
);

reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select count(*) from public.finds),
  1::bigint,
  'public reads remain limited to published non-archived Finds'
);

reset role;

select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000101', true);
set local role authenticated;

select lives_ok(
  $$
    update public.finds
    set archived_at = now(), is_published = false
    where id = '11000000-0000-4000-8000-000000000201'
  $$,
  'an allowlisted owner can archive and hide a Find'
);

reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select count(*) from public.finds),
  0::bigint,
  'archive hides a Find publicly'
);

reset role;

select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000102', true);
set local role authenticated;

select lives_ok(
  $$
    update public.finds
    set archived_at = null, is_published = false
    where id = '11000000-0000-4000-8000-000000000201'
  $$,
  'an allowlisted editor can restore a Find while keeping it hidden'
);

reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select count(*) from public.finds),
  0::bigint,
  'a restored Find remains hidden until explicitly published'
);

reset role;

select ok(
  position(
    'email' in (
    select proc.prosrc
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'current_catalog_admin_role'
      and proc.pronargs = 0
    )
  ) = 0,
  'the role probe leaks no email data'
);

select is(
  (
    select proc.proretset
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'current_catalog_admin_role'
      and proc.pronargs = 0
  ),
  false,
  'the role probe cannot enumerate allowlist records'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('collections', 'finds', 'find_photos', 'find_relations')
  ),
  20::bigint,
  'the role probe remains compatible with the complete M08 catalog RLS policy set'
);

select * from finish();
rollback;
