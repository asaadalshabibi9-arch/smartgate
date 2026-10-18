-- A09-A10 / FR11-FR15: repeatable exceptions, readable references, scoped reporting.
drop index public.completion_notification_unique;
create unique index completion_notification_unique
on public.notifications(trip_id, recipient_profile_id, purpose)
where purpose = 'entry_completed';

create sequence private.request_number_seq start 1001;
create function private.assign_request_number() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.request_number := 'SG-' || nextval('private.request_number_seq')::text;
  return new;
end; $$;
create trigger assign_request_number before insert on public.trips
for each row execute function private.assign_request_number();
revoke all on function private.assign_request_number() from public, anon, authenticated;

-- Snapshot the independent checks and original identity for an auditable report (FR07, FR13).
create function private.enrich_trip_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare t public.trips; g public.gates; v public.trucks; p public.profiles; a public.profiles;
begin
  select * into t from public.trips where id=new.trip_id;
  select * into g from public.gates where id=t.gate_id;
  select * into v from public.trucks where id=t.truck_id;
  select * into p from public.profiles where id=t.driver_profile_id;
  select * into a from public.profiles where id=new.actor_profile_id;
  new.payload := new.payload || jsonb_build_object('actor_role', a.role);
  if new.event_type='trip_created' then
    new.payload := new.payload || jsonb_build_object('identity', jsonb_build_object(
      'driver',p.full_name,'plate',v.plate_number,'company',(select name from public.companies where id=t.company_id)));
  end if;
  if new.event_type in ('verification_passed','verification_failed') then
    new.payload := new.payload || jsonb_build_object('checks',jsonb_build_object(
      'qr', coalesce(new.payload->'input'->>'qr'=t.id::text,false),
      'plate', coalesce(new.payload->'input'->>'plate'=v.plate_number,false),
      'container', case when t.operation_type='container' then coalesce(new.payload->'input'->>'container'=t.container_number,false) else null end,
      'eligibility',coalesce(g.status in ('open','busy') and t.operation_type=any(g.eligible_operations),false),
      'appointment',now() between t.appointment_start_at and t.appointment_end_at));
  end if;
  return new;
end; $$;
create trigger enrich_trip_event before insert on public.trip_events
for each row execute function private.enrich_trip_event();
revoke all on function private.enrich_trip_event() from public, anon, authenticated;

create table public.gate_events (
  id bigint generated always as identity primary key,
  gate_id uuid not null references public.gates(id),
  actor_profile_id uuid references public.profiles(id),
  occurred_at timestamptz not null default now(),
  source text not null default 'simulation' check(source='simulation'),
  before_data jsonb not null,
  after_data jsonb not null
);
create index gate_events_gate_time_idx on public.gate_events(gate_id,occurred_at);
create index gate_events_actor_idx on public.gate_events(actor_profile_id);
alter table public.gate_events enable row level security;
create policy gate_events_read on public.gate_events for select to authenticated
using ((select private.current_role())='demo_admin');
grant select on public.gate_events to authenticated;
revoke all on public.gate_events from anon;
create function private.audit_gate_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then
    insert into public.gate_events(gate_id,actor_profile_id,before_data,after_data)
    values(new.id,private.current_profile_id(),to_jsonb(old),to_jsonb(new));
  end if;
  return new;
end; $$;
create trigger audit_gate_change after update on public.gates
for each row execute function private.audit_gate_change();
revoke all on function private.audit_gate_change() from public, anon, authenticated;

-- Only authorized trip readers receive the two delivery outcomes; no cross-company data.
create function private.entry_report(p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.can_access_trip(p_trip) then raise exception 'forbidden'; end if;
  return (select jsonb_build_object('trip',to_jsonb(t),
    'driver_name',p.full_name,'plate_number',v.plate_number,'company_name',c.name,
    'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'recipient_profile_id',n.recipient_profile_id,
      'recipient_role',r.role,'purpose',n.purpose,'status',n.status,'delivered_at',n.delivered_at,'created_at',n.created_at))
      from public.notifications n join public.profiles r on r.id=n.recipient_profile_id
      where n.trip_id=t.id and n.purpose='entry_completed'),'[]'::jsonb))
    from public.trips t join public.profiles p on p.id=t.driver_profile_id
    join public.trucks v on v.id=t.truck_id join public.companies c on c.id=t.company_id where t.id=p_trip);
end; $$;
create function public.entry_report(p_trip uuid) returns jsonb language sql security invoker set search_path=''
as $$ select private.entry_report(p_trip); $$;
revoke all on function private.entry_report(uuid), public.entry_report(uuid) from public,anon;
grant execute on function private.entry_report(uuid), public.entry_report(uuid) to authenticated;

-- No self-service provisioning, even if a hosting Auth setting is accidentally enabled (A10).
-- Preprovisioned accounts are created by the administrator, not via signup or editable metadata.
create function private.block_public_signup() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user not in ('postgres','supabase_admin') then raise exception 'public_signup_disabled'; end if;
  return new;
end; $$;
revoke all on function private.block_public_signup() from public,anon,authenticated;
create trigger smartgate_preprovisioned_accounts_only before insert on auth.users
for each row execute function private.block_public_signup();
