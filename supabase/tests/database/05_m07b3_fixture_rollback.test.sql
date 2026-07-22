begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(4);

select is(
  (select count(*) from public.finds where public_id in ('BU-0010', 'BU-9009')),
  0::bigint,
  'M07B-3 public-ID fixtures rolled back'
);

select is(
  (select count(*) from public.find_photos),
  0::bigint,
  'M07B-3 photo fixtures rolled back'
);

select is(
  (select count(*) from auth.users),
  0::bigint,
  'M07B-3 Auth state remains free of test users'
);

select ok(
  (select last_value = 9 and is_called = true from public.find_public_id_seq),
  'M07B-3 sequence fixture restored the reserved floor'
);

select * from finish();
rollback;
