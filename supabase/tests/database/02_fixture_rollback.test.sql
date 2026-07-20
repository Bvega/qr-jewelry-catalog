begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(5);

select is(
  (
    select count(*)
    from auth.users
    where id in (
      '10000000-0000-4000-8000-000000000101',
      '10000000-0000-4000-8000-000000000102'
    )
  ),
  0::bigint,
  'fictional Auth fixtures rolled back'
);

select is(
  (
    select count(*)
    from private.catalog_admins
    where user_id = '10000000-0000-4000-8000-000000000101'
  ),
  0::bigint,
  'fictional admin fixture rolled back'
);

select is(
  (
    select count(*)
    from public.finds
    where id::text like '10000000-0000-4000-8000-0000000002%'
  ),
  0::bigint,
  'fictional Find fixtures rolled back'
);

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'find-images'
      and name like 'finds/10000000-0000-4000-8000-%'
  ),
  0::bigint,
  'fictional Storage fixtures rolled back'
);

select ok(
  (select last_value = 1 and is_called = false from public.find_public_id_seq),
  'the fictional public-ID fixture reset its sequence state'
);

select * from finish();
rollback;
