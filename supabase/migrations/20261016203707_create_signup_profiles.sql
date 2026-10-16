create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_company_id uuid;
  requested_full_name text;
  requested_company_name text;
begin
  requested_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'SmartGate user'
  );

  requested_company_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'company_name'), ''),
    requested_full_name || ' company'
  );

  insert into public.companies (name)
  values (requested_company_name)
  returning id into created_company_id;

  insert into public.profiles (user_id, company_id, full_name, role)
  values (new.id, created_company_id, requested_full_name, 'company_admin');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

revoke execute on function private.handle_new_user() from public, anon, authenticated;

comment on function private.handle_new_user() is
  'Creates an isolated company and company administrator profile for each self-service signup.';
