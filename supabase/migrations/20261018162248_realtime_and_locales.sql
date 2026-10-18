-- A15/A17: preserve RLS and closed account provisioning; do not publish DELETE
-- events, which cannot be authorized using a deleted row. Clients use INSERT/UPDATE.
set lock_timeout = '5s';
alter table public.profiles drop constraint profiles_locale_check;
alter table public.profiles add constraint profiles_locale_check
  check (locale in ('ar', 'en', 'hi', 'ur', 'bn', 'ml', 'ta', 'ne')) not valid;
alter table public.profiles validate constraint profiles_locale_check;

-- Supabase provides this publication. Plain PostgreSQL test environments do not.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['trips', 'trip_events', 'gates', 'notifications'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
reset lock_timeout;
