-- M07B-3: reserve public IDs assigned through BU-0009 without moving the sequence backwards.

do $$
declare
  current_value bigint;
  current_called boolean;
begin
  select last_value, is_called
  into current_value, current_called
  from public.find_public_id_seq;

  if current_value < 9 or (current_value = 9 and not current_called) then
    perform setval('public.find_public_id_seq', 9, true);
  end if;
end;
$$;
