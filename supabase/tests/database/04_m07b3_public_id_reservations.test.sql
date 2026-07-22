begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(6);

select ok(
  (
    select last_value > 9 or (last_value = 9 and is_called)
    from public.find_public_id_seq
  ),
  'the public-ID sequence floor is at least 9'
);

-- Earlier RLS rejection fixtures can evaluate a default before rejecting the row.
-- Restore the fresh-reset state for this isolated generator assertion.
select setval('public.find_public_id_seq', 9, true);

insert into public.finds (
  title,
  collection_id,
  price_amount,
  availability,
  description
)
values (
  'Fictional M07B-3 Generated Find',
  'jewelry',
  10.00,
  'available',
  'Fictional sequence fixture used only by the local M07B-3 pgTAP test.'
);

select is(
  (select public_id from public.finds where title = 'Fictional M07B-3 Generated Find'),
  'BU-0010',
  'a fresh local reset generates BU-0010 next'
);

select lives_ok(
  $$
    insert into public.finds (
      public_id,
      slug,
      title,
      collection_id,
      price_amount,
      availability,
      description
    ) values (
      'BU-9009',
      'fictional-explicit-m07b3-find',
      'Fictional Explicit M07B-3 Find',
      'jewelry',
      11.00,
      'reserved',
      'Fictional explicit-ID fixture used only by the local M07B-3 pgTAP test.'
    )
  $$,
  'an explicit valid public ID still satisfies the Find table contract'
);

select is(
  (select count(*) from public.finds where public_id between 'BU-0006' and 'BU-0009'),
  0::bigint,
  'the reservation migration inserts no intake Finds'
);

select is(
  (select count(*) from auth.users),
  0::bigint,
  'the reservation migration inserts no Auth users'
);

select is(
  (select count(*) from public.find_photos),
  0::bigint,
  'the reservation migration inserts no catalog photos'
);

select setval('public.find_public_id_seq', 9, true);
select * from finish();
rollback;
