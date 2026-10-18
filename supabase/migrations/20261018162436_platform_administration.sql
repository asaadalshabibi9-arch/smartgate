-- A14: administrative authority is an explicit capability, never inferred from
-- editable metadata or the simulation role. Bootstrap grants are privileged SQL.
create table private.platform_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table private.platform_administrators enable row level security;
revoke all on private.platform_administrators from public, anon, authenticated;
create table private.administration_audit (
  operation_key uuid primary key,
  actor_user_id uuid not null references auth.users(id),
  command text not null,
  input jsonb not null,
  result jsonb not null,
  occurred_at timestamptz not null default now()
);
create unique index administration_account_email on private.administration_audit(lower(input->>'email')) where command='reserve_account';
alter table private.administration_audit enable row level security;
revoke all on private.administration_audit from public, anon, authenticated;

create function private.is_platform_administrator() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (select 1 from private.platform_administrators where user_id=auth.uid());
$$;
create function public.is_platform_administrator() returns boolean
language sql stable security invoker set search_path='' as $$select private.is_platform_administrator();$$;
revoke all on function private.is_platform_administrator(), public.is_platform_administrator() from public,anon;
grant execute on function private.is_platform_administrator(), public.is_platform_administrator() to authenticated;

create function private.administration_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_administrator() then raise exception 'forbidden'; end if;
 return jsonb_build_object(
   'companies',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.companies c),'[]'::jsonb),
   'profiles',coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('email',u.email) order by p.full_name) from public.profiles p join auth.users u on u.id=p.user_id),'[]'::jsonb),
   'trucks',coalesce((select jsonb_agg(to_jsonb(t) order by t.plate_number) from public.trucks t),'[]'::jsonb),
   'gates',coalesce((select jsonb_agg(to_jsonb(g) order by g.code) from public.gates g),'[]'::jsonb),
   'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.operator_gates a),'[]'::jsonb),
   'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at desc) from (select command,occurred_at,actor_user_id from private.administration_audit order by occurred_at desc limit 30) a),'[]'::jsonb)
 );
end; $$;
create function public.administration_overview() returns jsonb language sql stable security invoker set search_path='' as $$select private.administration_overview();$$;
revoke all on function private.administration_overview(), public.administration_overview() from public,anon;
grant execute on function private.administration_overview(), public.administration_overview() to authenticated;

create function private.administration_command(p_command text,p_input jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved private.administration_audit; result jsonb; entity_id uuid; company_id uuid; profile_role public.app_role;
begin
 if not private.is_platform_administrator() then raise exception 'forbidden'; end if;
 if p_key is null or p_input is null or jsonb_typeof(p_input)<>'object' or p_input ? 'password' or p_input ? 'account_password' then raise exception 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into saved from private.administration_audit where operation_key=p_key;
 if found then
   if saved.actor_user_id<>auth.uid() or saved.command<>p_command or saved.input<>p_input then raise exception 'idempotency_conflict'; end if;
   return saved.result;
 end if;
 if p_command='reserve_account' then
   -- Keep a retry identity stable even after a route refresh. Never store passwords.
   if length(trim(coalesce(p_input->>'email',''))) not between 3 and 254 or
      p_input->>'email' not like '%@%' or
      p_input ? 'password' or p_input ? 'account_password' or
      coalesce(p_input->>'role','') not in ('company_admin','driver','gate_operator','demo_admin') or
      length(trim(coalesce(p_input->>'full_name',''))) not between 1 and 160 or
      coalesce(p_input->>'locale','') not in ('ar','en','hi','ur','bn','ml','ta','ne') then raise exception 'invalid_input'; end if;
   company_id:=nullif(p_input->>'company_id','')::uuid;
   if (p_input->>'role' in ('company_admin','driver') and (company_id is null or not exists(select 1 from public.companies c where c.id=company_id))) or
      (p_input->>'role' in ('gate_operator','demo_admin') and company_id is not null) then raise exception 'invalid_input'; end if;
   perform pg_advisory_xact_lock(hashtextextended(lower(p_input->>'email'),1));
   select * into saved from private.administration_audit where command='reserve_account' and lower(input->>'email')=lower(p_input->>'email');
   if found then
     if saved.actor_user_id<>auth.uid() or saved.input<>p_input then raise exception 'idempotency_conflict'; end if;
     return saved.result;
   end if;
   if exists(select 1 from auth.users where lower(email)=lower(p_input->>'email')) then raise exception 'invalid_input'; end if;
   entity_id:=gen_random_uuid();
 elsif p_command='company' then
   if length(trim(coalesce(p_input->>'name',''))) not between 1 and 160 then raise exception 'invalid_input'; end if;
   insert into public.companies(name,is_simulated) values(trim(p_input->>'name'),true) returning id into entity_id;
 elsif p_command='truck' then
   company_id:=(p_input->>'company_id')::uuid;
   if not exists(select 1 from public.companies c where c.id=company_id) or length(trim(coalesce(p_input->>'plate_number',''))) not between 1 and 40 then raise exception 'invalid_input'; end if;
   insert into public.trucks(company_id,plate_number,vehicle_type,is_simulated) values(company_id,trim(p_input->>'plate_number'),nullif(trim(p_input->>'vehicle_type'),''),true) returning id into entity_id;
 elsif p_command='profile' then
   entity_id:=(p_input->>'user_id')::uuid;
   profile_role:=(p_input->>'role')::public.app_role;
   company_id:=nullif(p_input->>'company_id','')::uuid;
   if profile_role not in ('company_admin','driver','gate_operator','demo_admin') or
      length(trim(coalesce(p_input->>'full_name',''))) not between 1 and 160 or
      coalesce(p_input->>'locale','') not in ('ar','en','hi','ur','bn','ml','ta','ne') or
      (profile_role in ('company_admin','driver') and (company_id is null or not exists(select 1 from public.companies c where c.id=company_id))) or
      (profile_role in ('gate_operator','demo_admin') and company_id is not null) or
      not exists(select 1 from auth.users u where u.id=entity_id and u.raw_app_meta_data->>'smartgate_managed'='true' and u.raw_app_meta_data->>'provisioning_key'=p_key::text)
   then raise exception 'invalid_input'; end if;
   -- Never overwrite a provisioned identity, its membership or its role on retry.
   insert into public.profiles(user_id,company_id,full_name,role,locale,is_simulated)
   values(entity_id,company_id,trim(p_input->>'full_name'),profile_role,p_input->>'locale',true) returning id into entity_id;
 elsif p_command='gate_coordinates' then
   entity_id:=(p_input->>'gate_id')::uuid;
   if not exists(select 1 from public.gates where id=entity_id) then raise exception 'invalid_input'; end if;
   update public.gates set latitude=nullif(p_input->>'latitude','')::double precision,
     longitude=nullif(p_input->>'longitude','')::double precision where id=entity_id;
 elsif p_command in ('assign_gate','unassign_gate') then
   entity_id:=(p_input->>'profile_id')::uuid;
   if not exists(select 1 from public.profiles where id=entity_id and role='gate_operator') or
      not exists(select 1 from public.gates where id=(p_input->>'gate_id')::uuid) then raise exception 'invalid_input'; end if;
   if p_command='assign_gate' then
     insert into public.operator_gates(profile_id,gate_id) values(entity_id,(p_input->>'gate_id')::uuid) on conflict do nothing;
   else
     delete from public.operator_gates where profile_id=entity_id and gate_id=(p_input->>'gate_id')::uuid;
   end if;
 else raise exception 'invalid_input';
 end if;
 result:=jsonb_build_object('id',entity_id);
 insert into private.administration_audit(operation_key,actor_user_id,command,input,result) values(p_key,auth.uid(),p_command,p_input,result);
 return result;
end; $$;
create function public.administration_command(p_command text,p_input jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.administration_command(p_command,p_input,p_key);$$;
revoke all on function private.administration_command(text,jsonb,uuid), public.administration_command(text,jsonb,uuid) from public,anon;
grant execute on function private.administration_command(text,jsonb,uuid), public.administration_command(text,jsonb,uuid) to authenticated;

-- Public signup cannot set app_metadata. Only the trusted Auth Admin API may
-- create managed identities; server actions separately verify the capability.
create or replace function private.block_public_signup() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('postgres','supabase_admin') then return new; end if;
 if current_user='supabase_auth_admin' and new.raw_app_meta_data->>'smartgate_managed'='true'
    and new.raw_app_meta_data->>'provisioning_key'=new.id::text then return new; end if;
 raise exception 'public_signup_disabled';
end; $$;
