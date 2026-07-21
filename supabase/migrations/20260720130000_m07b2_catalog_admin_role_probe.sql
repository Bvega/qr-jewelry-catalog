-- M07B-2: expose only the current authenticated catalog administrator's role.

create or replace function public.current_catalog_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select admins.role
  from private.catalog_admins as admins
  where (select auth.uid()) is not null
    and admins.user_id = (select auth.uid());
$$;

revoke all on function public.current_catalog_admin_role() from public, anon, authenticated;
grant execute on function public.current_catalog_admin_role() to authenticated;

comment on function public.current_catalog_admin_role() is
  'Returns only the authenticated caller role from the private catalog allowlist, or null.';
