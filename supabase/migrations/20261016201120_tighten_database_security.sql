drop policy trucks_manage on public.trucks;

create policy trucks_insert on public.trucks
for insert to authenticated
with check (
  company_id = (select private.current_company_id())
  and (select private.current_role()) = 'company_admin'
);

create policy trucks_update on public.trucks
for update to authenticated
using (
  company_id = (select private.current_company_id())
  and (select private.current_role()) = 'company_admin'
)
with check (
  company_id = (select private.current_company_id())
  and (select private.current_role()) = 'company_admin'
);

revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;
