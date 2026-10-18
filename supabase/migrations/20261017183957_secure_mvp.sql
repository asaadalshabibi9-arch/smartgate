-- FR07-FR15 / A02-A04: all operational changes are authenticated, atomic commands.
alter table public.gates add column service_rate_per_hour numeric check (service_rate_per_hour > 0);
alter table public.companies add column is_simulated boolean not null default false;
alter table public.profiles add column is_simulated boolean not null default false;
alter table public.trucks add column is_simulated boolean not null default false;
alter table public.trips add column travel_minutes integer not null default 30 check (travel_minutes between 0 and 1440);
alter table public.trips add column creation_key uuid unique;
alter table public.trips add column barrier_requested boolean not null default false;
alter table public.trip_events add column operation_key uuid;
create unique index trip_event_operation_unique on public.trip_events(trip_id, operation_key);
create unique index one_crossing_per_trip on public.trip_events(trip_id) where event_type = 'crossing_confirmed';
create unique index completion_notification_unique on public.notifications(trip_id,recipient_profile_id,purpose);
create table public.operator_gates (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  gate_id uuid not null references public.gates(id) on delete cascade,
  primary key(profile_id,gate_id)
);
create index operator_gates_gate_idx on public.operator_gates(gate_id);
alter table public.operator_gates enable row level security;
create policy operator_gates_read on public.operator_gates for select to authenticated
using (profile_id = (select private.current_profile_id()));
grant select on public.operator_gates to authenticated;

create table private.demo_reset_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  reset_at timestamptz not null default now(),
  snapshot jsonb not null
);
alter table private.demo_reset_audit enable row level security;

create or replace function private.can_access_trip(target_trip_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.trips t join public.profiles p on p.user_id = auth.uid()
    where t.id = target_trip_id and (
      (p.role='company_admin' and t.company_id=p.company_id)
      or (p.role='driver' and t.driver_profile_id=p.id)
      or (p.role='gate_operator' and exists(select 1 from public.operator_gates g where g.profile_id=p.id and g.gate_id=t.gate_id))
      or (p.role='demo_admin' and t.is_simulated)
    )
  );
$$;

-- Avoid exposing another driver's profile or truck through a broader company predicate.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  user_id=(select auth.uid())
  or ((select private.current_role())='company_admin' and company_id=(select private.current_company_id()))
  or ((select private.current_role())='demo_admin' and is_simulated)
);
drop policy trucks_select on public.trucks;
create policy trucks_select on public.trucks for select to authenticated using (
  ((select private.current_role())='company_admin' and company_id=(select private.current_company_id()))
  or exists(select 1 from public.trips t where t.truck_id=trucks.id and private.can_access_trip(t.id))
  or ((select private.current_role())='demo_admin' and is_simulated)
);
drop policy companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated using (
  id=(select private.current_company_id()) or ((select private.current_role())='demo_admin' and is_simulated)
);
drop policy notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (
  recipient_profile_id=(select private.current_profile_id())
  or ((select private.current_role())='demo_admin' and private.can_access_trip(trip_id))
);

-- RLS plus privilege revocation: no direct writes to protected fields, even on INSERT.
revoke insert,update,delete on public.trips,public.trip_events,public.notifications,public.gates,public.profiles,public.companies,public.trucks from authenticated,anon;
drop trigger trip_crossing_completes_trip on public.trip_events;
drop function private.complete_trip_after_crossing();
drop trigger trips_guard_completion on public.trips;
drop function private.guard_trip_completion();

create function private.create_entry_trip(p_input jsonb,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor public.profiles; result_id uuid; target_gate public.gates;
  driver public.profiles; truck public.trucks;
begin
  select * into actor from public.profiles where user_id=auth.uid();
  if auth.uid() is null or actor.role is distinct from 'company_admin' or not actor.is_simulated then raise exception 'forbidden'; end if;
  if p_key is null then raise exception 'invalid_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  select id into result_id from public.trips where creation_key=p_key and created_by=actor.id;
  if result_id is not null then return result_id; end if;
  select * into driver from public.profiles where id=(p_input->>'driver_profile_id')::uuid;
  select * into truck from public.trucks where id=(p_input->>'truck_id')::uuid;
  select * into target_gate from public.gates where id=(p_input->>'gate_id')::uuid;
  if driver.id is null or driver.role<>'driver' or driver.company_id is distinct from actor.company_id
     or truck.id is null or truck.company_id is distinct from actor.company_id
     or not driver.is_simulated or not truck.is_simulated then raise exception 'invalid_membership'; end if;
  if target_gate.id is null or not target_gate.is_simulated or target_gate.status not in ('open','busy')
     or not ((p_input->>'operation_type')=any(target_gate.eligible_operations)) then raise exception 'ineligible_gate'; end if;
  if p_input->>'operation_type' not in ('container','general_cargo')
     or nullif(btrim(p_input->>'cargo_type'),'') is null
     or (p_input->>'cargo_weight_kg') is null or (p_input->>'cargo_weight_kg')::numeric<0
     or (p_input->>'appointment_start_at') is null or (p_input->>'appointment_end_at') is null
     or (p_input->>'planned_departure_at') is null
     or (p_input->>'appointment_end_at')::timestamptz <= (p_input->>'appointment_start_at')::timestamptz
     or (p_input->>'travel_minutes') is null or (p_input->>'travel_minutes')::integer not between 0 and 1440
     or (p_input->>'operation_type'='container' and nullif(btrim(p_input->>'container_number'),'') is null)
  then raise exception 'invalid_input'; end if;
  result_id:=gen_random_uuid();
  insert into public.trips(id,request_number,company_id,driver_profile_id,truck_id,gate_id,operation_type,
    cargo_type,cargo_weight_kg,container_number,planned_departure_at,appointment_start_at,appointment_end_at,
    created_by,creation_key,travel_minutes,is_simulated)
  values(result_id,'SG-'||upper(replace(result_id::text,'-','')),actor.company_id,driver.id,truck.id,target_gate.id,
    p_input->>'operation_type',btrim(p_input->>'cargo_type'),(p_input->>'cargo_weight_kg')::numeric,
    nullif(btrim(p_input->>'container_number'),''),(p_input->>'planned_departure_at')::timestamptz,
    (p_input->>'appointment_start_at')::timestamptz,(p_input->>'appointment_end_at')::timestamptz,
    actor.id,p_key,(p_input->>'travel_minutes')::integer,true);
  insert into public.trip_events(trip_id,event_type,actor_profile_id,gate_id,source,payload,operation_key)
  values(result_id,'trip_created',actor.id,target_gate.id,'simulation',p_input,p_key);
  return result_id;
end;
$$;

create function private.apply_trip_command(p_trip uuid,p_command text,p_payload jsonb,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor public.profiles; trip public.trips; gate public.gates; truck public.trucks;
  event public.trip_event_type; prior public.trip_events; recipient uuid; current_wait numeric;
  original_payload jsonb := p_payload;
begin
  select * into actor from public.profiles where user_id=auth.uid();
  if auth.uid() is null or actor.id is null or not private.can_access_trip(p_trip) then raise exception 'forbidden'; end if;
  select * into trip from public.trips where id=p_trip for update;
  if not trip.is_simulated then raise exception 'simulation_only'; end if;
  if p_key is null then raise exception 'invalid_input'; end if;
  select * into prior from public.trip_events where trip_id=p_trip and operation_key=p_key;
  if prior.id is not null then
    if prior.actor_profile_id<>actor.id or prior.payload->>'command' is distinct from p_command
       or prior.payload->'input' is distinct from p_payload then raise exception 'idempotency_conflict'; end if;
    return trip.id;
  end if;
  if p_command in ('start','arrive','accept_recommendation') then
    if actor.role<>'driver' or trip.driver_profile_id<>actor.id then raise exception 'forbidden'; end if;
  elsif p_command='request_open' then
    if actor.role<>'gate_operator' then raise exception 'forbidden'; end if;
  elsif actor.role<>'demo_admin' then raise exception 'forbidden'; end if;
  select * into gate from public.gates where id=trip.gate_id;
  if p_command='start' then
    if trip.status<>'planned' then raise exception 'invalid_transition'; end if;
    update public.trips set status='in_transit' where id=p_trip;
    event:='trip_started';
    insert into public.notifications(trip_id,recipient_profile_id,purpose,status,delivered_at)
    values(p_trip,trip.driver_profile_id,'trip_started','delivered',now());
  elsif p_command='arrive' then
    if trip.status<>'in_transit' then raise exception 'invalid_transition'; end if;
    update public.trips set status='at_gate' where id=p_trip; event:='arrival_reported';
  elsif p_command='verify' then
    if trip.status not in ('at_gate','verification_failed') then raise exception 'invalid_transition'; end if;
    select * into truck from public.trucks where id=trip.truck_id;
    if p_payload->>'qr'=trip.id::text and p_payload->>'plate'=truck.plate_number
       and (trip.operation_type<>'container' or p_payload->>'container'=trip.container_number)
       and gate.status in ('open','busy') and trip.operation_type=any(gate.eligible_operations)
       and now() between trip.appointment_start_at and trip.appointment_end_at then
      event:='verification_passed'; update public.trips set status='verified' where id=p_trip;
    else
      event:='verification_failed'; update public.trips set status='verification_failed' where id=p_trip;
    end if;
  elsif p_command='request_open' then
    if trip.status not in ('verified','barrier_failed') or trip.barrier_requested
       or gate.status not in ('open','busy') or not (trip.operation_type=any(gate.eligible_operations))
       or now() not between trip.appointment_start_at and trip.appointment_end_at then raise exception 'invalid_transition'; end if;
    update public.trips set barrier_requested=true,status='verified' where id=p_trip; event:='barrier_open_requested';
  elsif p_command in ('barrier_opened','barrier_failed') then
    if trip.status<>'verified' or not trip.barrier_requested then raise exception 'invalid_transition'; end if;
    update public.trips set barrier_requested=false,status=(case when p_command='barrier_opened' then 'barrier_open' else 'barrier_failed' end)::public.trip_status where id=p_trip;
    event:=p_command::public.trip_event_type;
    if p_command='barrier_failed' then
      insert into public.trip_events(trip_id,event_type,actor_profile_id,gate_id,source,reason,payload)
      values(p_trip,'exception_recorded',actor.id,trip.gate_id,'simulation','barrier_failure_escalated','{"escalated":true}');
      insert into public.notifications(trip_id,recipient_profile_id,purpose,status,delivered_at)
      select p_trip,profile_id,'barrier_failure','delivered',now() from public.operator_gates where gate_id=trip.gate_id;
    end if;
  elsif p_command='crossing_confirmed' then
    if trip.status='completed' then return trip.id; end if;
    if trip.status<>'barrier_open' then raise exception 'invalid_transition'; end if;
    event:='crossing_confirmed';
    update public.trips set status='completed',crossed_at=now(),completed_at=now() where id=p_trip;
    insert into public.notifications(trip_id,recipient_profile_id,purpose,status,delivered_at)
    select p_trip,id,'entry_completed','delivered',now() from public.profiles
    where id=trip.driver_profile_id or (company_id=trip.company_id and role='company_admin')
    on conflict do nothing;
  elsif p_command='notification_failed' then
    if trip.status<>'completed' then raise exception 'invalid_transition'; end if;
    recipient:=(p_payload->>'recipient')::uuid;
    update public.notifications set status='failed',delivered_at=null
    where trip_id=p_trip and recipient_profile_id=recipient and purpose='entry_completed';
    if not found then raise exception 'invalid_input'; end if;
    event:='exception_recorded';
  elsif p_command='accept_recommendation' then
    if trip.status<>'in_transit' then raise exception 'invalid_transition'; end if;
    if now()+make_interval(mins=>trip.travel_minutes) not between trip.appointment_start_at and trip.appointment_end_at then raise exception 'outside_appointment'; end if;
    select * into gate from public.gates where id=trip.gate_id;
    if gate.queue_length is null or gate.service_rate_per_hour is null then raise exception 'missing_telemetry'; end if;
    current_wait:=ceil(gate.queue_length*60/gate.service_rate_per_hour);
    select * into gate from public.gates where is_simulated and status in ('open','busy')
      and trip.operation_type=any(eligible_operations) and queue_length is not null and service_rate_per_hour is not null
    order by ceil(queue_length*60/service_rate_per_hour), (id=trip.gate_id) desc,code limit 1;
    if gate.id is null or gate.id=trip.gate_id or gate.id::text is distinct from p_payload->>'gate_id' then raise exception 'recommendation_changed'; end if;
    if ceil(gate.queue_length*60/gate.service_rate_per_hour)>=current_wait then raise exception 'recommendation_changed'; end if;
    p_payload:=p_payload||jsonb_build_object('previous_gate_id',trip.gate_id,'wait_before',current_wait,'wait_after',ceil(gate.queue_length*60/gate.service_rate_per_hour),'reason','lower_estimated_wait');
    update public.trips set gate_id=gate.id where id=p_trip;
    event:='recommendation_accepted';
    insert into public.notifications(trip_id,recipient_profile_id,purpose,status,delivered_at)
    values(p_trip,trip.driver_profile_id,'gate_changed','delivered',now());
  else raise exception 'invalid_command'; end if;
  insert into public.trip_events(trip_id,event_type,actor_profile_id,gate_id,source,reason,payload,operation_key)
  values(p_trip,event,actor.id,gate.id,'simulation',case when event='verification_failed' then 'identity_or_eligibility_mismatch' else null end,
    jsonb_build_object('command',p_command,'input',original_payload,'details',p_payload),p_key);
  return p_trip;
end;
$$;

create function private.update_demo_gate(p_gate uuid,p_input jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or private.current_role() is distinct from 'demo_admin' then raise exception 'forbidden'; end if;
  update public.gates set status=(p_input->>'status')::public.gate_status,
    queue_length=nullif(p_input->>'queue_length','')::integer,
    service_rate_per_hour=nullif(p_input->>'service_rate_per_hour','')::numeric,
    estimated_wait_minutes=case when nullif(p_input->>'queue_length','') is not null and nullif(p_input->>'service_rate_per_hour','')::numeric>0 then ceil((p_input->>'queue_length')::numeric*60/(p_input->>'service_rate_per_hour')::numeric) end,
    telemetry_updated_at=now() where id=p_gate and is_simulated;
  if not found then raise exception 'simulation_only'; end if;
end;
$$;

create function private.reset_demo_trip(p_trip uuid)
returns void language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
  if auth.uid() is null or private.current_role() is distinct from 'demo_admin' then raise exception 'forbidden'; end if;
  perform 1 from public.trips where id=p_trip and is_simulated for update;
  if not found then raise exception 'simulation_only'; end if;
  select jsonb_build_object('trip',to_jsonb(t),'events',(select jsonb_agg(e) from public.trip_events e where e.trip_id=t.id),
    'notifications',(select jsonb_agg(n) from public.notifications n where n.trip_id=t.id)) into snapshot from public.trips t where id=p_trip;
  insert into private.demo_reset_audit(actor_id,snapshot) values(private.current_profile_id(),snapshot);
  delete from public.trips where id=p_trip and is_simulated;
end;
$$;

-- Public wrappers remain INVOKER; privileged implementations live outside the exposed schema.
create function public.create_entry_trip(p_input jsonb,p_key uuid) returns uuid language sql security invoker set search_path='' as $$ select private.create_entry_trip(p_input,p_key); $$;
create function public.apply_trip_command(p_trip uuid,p_command text,p_payload jsonb,p_key uuid) returns uuid language sql security invoker set search_path='' as $$ select private.apply_trip_command(p_trip,p_command,p_payload,p_key); $$;
create function public.update_demo_gate(p_gate uuid,p_input jsonb) returns void language sql security invoker set search_path='' as $$ select private.update_demo_gate(p_gate,p_input); $$;
create function public.reset_demo_trip(p_trip uuid) returns void language sql security invoker set search_path='' as $$ select private.reset_demo_trip(p_trip); $$;
revoke all on function public.create_entry_trip(jsonb,uuid),public.apply_trip_command(uuid,text,jsonb,uuid),public.update_demo_gate(uuid,jsonb),public.reset_demo_trip(uuid) from public,anon;
revoke all on function private.create_entry_trip(jsonb,uuid),private.apply_trip_command(uuid,text,jsonb,uuid),private.update_demo_gate(uuid,jsonb),private.reset_demo_trip(uuid) from public,anon;
grant execute on function public.create_entry_trip(jsonb,uuid),public.apply_trip_command(uuid,text,jsonb,uuid),public.update_demo_gate(uuid,jsonb),public.reset_demo_trip(uuid) to authenticated;
grant execute on function private.create_entry_trip(jsonb,uuid),private.apply_trip_command(uuid,text,jsonb,uuid),private.update_demo_gate(uuid,jsonb),private.reset_demo_trip(uuid) to authenticated;
update public.gates set service_rate_per_hour=15 where is_simulated;
