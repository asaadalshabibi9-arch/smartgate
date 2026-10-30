-- A19: initial automatic assignment; shared latest position; re-evaluation within 5 km.
-- Exact positions are restricted to the driver, their company and assigned gate operators.
create table public.trip_locations (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  session_id uuid not null,
  source text not null check(source in ('gps','simulation')),
  sharing_active boolean not null default false,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  observed_at timestamptz,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_trip_location check (
    (latitude is null and longitude is null and accuracy_m is null and observed_at is null)
    or (latitude between -90 and 90 and longitude between -180 and 180
      and accuracy_m between 0 and 100000 and observed_at is not null
      and latitude is not null and longitude is not null and accuracy_m is not null))
);
alter table public.trip_locations enable row level security;
revoke all on public.trip_locations from public,anon,authenticated;
grant select on public.trip_locations to authenticated;

create function private.can_read_trip_location(p_trip uuid,p_source text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.trips t join public.profiles p on p.user_id=auth.uid()
    where t.id=p_trip and t.status<>'completed' and (
      (p.role='driver' and p.id=t.driver_profile_id)
      or (p.role='company_admin' and p.company_id=t.company_id)
      or (p.role='gate_operator' and exists(select 1 from public.operator_gates og where og.profile_id=p.id and og.gate_id=t.gate_id))
      or (p.role='demo_admin' and p_source='simulation' and t.is_simulated)));
$$;
revoke all on function private.can_read_trip_location(uuid,text) from public,anon,authenticated;
grant execute on function private.can_read_trip_location(uuid,text) to authenticated;
create policy authorized_latest_location on public.trip_locations for select to authenticated
using (private.can_read_trip_location(trip_id,source));

create function private.geo_distance_m(a double precision,b double precision,c double precision,d double precision)
returns double precision language sql immutable set search_path='' as $$
 select 6371000*2*asin(sqrt(least(1.0,power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2))));
$$;
revoke all on function private.geo_distance_m(double precision,double precision,double precision,double precision) from public,anon,authenticated;

create function private.is_approaching(p_trip uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select t.status='in_transit' and l.sharing_active
   and l.observed_at>=now()-interval '90 seconds'
   and g.latitude is not null and g.longitude is not null and l.latitude is not null
   and private.geo_distance_m(l.latitude,l.longitude,g.latitude,g.longitude)+l.accuracy_m<=5000
   from public.trips t join public.trip_locations l on l.trip_id=t.id
   join public.gates g on g.id=t.gate_id where t.id=p_trip),false);
$$;
revoke all on function private.is_approaching(uuid) from public,anon,authenticated;
create or replace function private.create_entry_trip(p_input jsonb,p_key uuid)
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
  -- A19: the server assigns the initial gate; incoming gate_id cannot override it.
  select * into target_gate from public.gates
  where is_simulated and status in ('open','busy')
    and (p_input->>'operation_type')=any(eligible_operations)
    and queue_length is not null and service_rate_per_hour is not null
  order by ceil(queue_length*60/service_rate_per_hour),code
  limit 1 for share;
  if driver.id is null or driver.role<>'driver' or driver.company_id is distinct from actor.company_id
     or truck.id is null or truck.company_id is distinct from actor.company_id
     or not driver.is_simulated or not truck.is_simulated then raise exception 'invalid_membership'; end if;
  if target_gate.id is null or not target_gate.is_simulated or target_gate.status not in ('open','busy')
     or not ((p_input->>'operation_type')=any(target_gate.eligible_operations)) then raise exception 'ineligible_gate'; end if;
  if p_input->>'operation_type' not in ('container','general_cargo','refrigerated')
     or nullif(btrim(p_input->>'cargo_type'),'') is null
     or (p_input->>'cargo_weight_kg') is null or (p_input->>'cargo_weight_kg')::numeric<0
     or (p_input->>'appointment_start_at') is null or (p_input->>'appointment_end_at') is null
     or (p_input->>'planned_departure_at') is null
     or (p_input->>'appointment_end_at')::timestamptz <= (p_input->>'appointment_start_at')::timestamptz
     or (p_input->>'travel_minutes') is null or (p_input->>'travel_minutes')::integer not between 0 and 1440
     or (p_input->>'operation_type' in ('container','refrigerated') and nullif(btrim(p_input->>'container_number'),'') is null)
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
  values(result_id,'trip_created',actor.id,target_gate.id,'simulation',p_input||jsonb_build_object('gate_id',target_gate.id,'assignment_phase','initial','assignment_wait_minutes',ceil(target_gate.queue_length*60/target_gate.service_rate_per_hour)),p_key);
  return result_id;
end;
$$;

create or replace function private.record_recommendation(p_trip uuid) returns void
language plpgsql security definer set search_path='' as $$
declare trip public.trips; current_gate public.gates; best public.gates; prior jsonb; details jsonb; eta timestamptz;
begin
 select * into trip from public.trips where id=p_trip and is_simulated for update;
 if trip.id is null or trip.status<>'in_transit' or not private.is_approaching(p_trip) then return; end if;
 eta:=now()+make_interval(mins=>trip.travel_minutes);
 if eta not between trip.appointment_start_at and trip.appointment_end_at then return; end if;
 select * into current_gate from public.gates where id=trip.gate_id;
 if current_gate.queue_length is null or current_gate.service_rate_per_hour is null then return; end if;
 select * into best from public.gates where is_simulated and status in ('open','busy')
 and trip.operation_type=any(eligible_operations) and queue_length is not null and service_rate_per_hour is not null
 order by ceil(queue_length*60/service_rate_per_hour),(id=trip.gate_id) desc,code limit 1;
 if best.id is null or best.id=trip.gate_id or ceil(best.queue_length*60/best.service_rate_per_hour)>=ceil(current_gate.queue_length*60/current_gate.service_rate_per_hour) then return; end if;
 details:=jsonb_build_object('previous_gate_id',trip.gate_id,'gate_id',best.id,'gate_code',best.code,
 'wait_before',ceil(current_gate.queue_length*60/current_gate.service_rate_per_hour),
 'wait_after',ceil(best.queue_length*60/best.service_rate_per_hour),'reason','lower_estimated_wait','phase','approach');
 select payload->'details' into prior from public.trip_events where trip_id=p_trip and event_type::text='recommendation_generated' order by id desc limit 1;
 if prior is not distinct from details then return; end if;
 insert into public.trip_events(trip_id,event_type,actor_profile_id,gate_id,source,reason,payload)
 values(p_trip,'recommendation_generated',private.current_profile_id(),best.id,'simulation','lower_estimated_wait',jsonb_build_object('details',details,'eta',eta));
end; $$;
create or replace function private.apply_trip_command(p_trip uuid,p_command text,p_payload jsonb,p_key uuid)
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
       and (trip.operation_type not in ('container','refrigerated') or p_payload->>'container'=trip.container_number)
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
    if not private.is_approaching(p_trip) then raise exception 'not_approaching'; end if;
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


create function private.track_trip_location(p_trip uuid,p_session uuid,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.trips; actor public.profiles; loc public.trip_locations;
  lat double precision; lng double precision; accuracy double precision;
begin
  select * into actor from public.profiles where user_id=auth.uid();
  select * into t from public.trips where id=p_trip for update;
  if auth.uid() is null or actor.role is distinct from 'driver' or t.driver_profile_id is distinct from actor.id or t.id is null then raise exception 'forbidden'; end if;
  if p_session is null then raise exception 'invalid_input'; end if;
  select * into loc from public.trip_locations where trip_id=p_trip for update;
  if p_action='stop' then
    update public.trip_locations set sharing_active=false,updated_at=now() where trip_id=p_trip and session_id=p_session;
    return jsonb_build_object('active',false);
  end if;
  if t.status<>'in_transit' then raise exception 'invalid_transition'; end if;
  if p_action='start' then
    if p_input->>'source' is null or p_input->>'source' not in ('gps','simulation') then raise exception 'invalid_input'; end if;
    if p_input->>'source'='simulation' and not t.is_simulated then raise exception 'simulation_only'; end if;
    insert into public.trip_locations(trip_id,session_id,source,sharing_active)
      values(p_trip,p_session,p_input->>'source',true)
    on conflict(trip_id) do update set session_id=excluded.session_id,source=excluded.source,sharing_active=true,
      latitude=null,longitude=null,accuracy_m=null,observed_at=null,started_at=now(),updated_at=now();
    return jsonb_build_object('active',true);
  end if;
  if p_action<>'position' or loc.session_id is distinct from p_session or not loc.sharing_active then raise exception 'tracking_inactive'; end if;
  lat:=(p_input->>'latitude')::double precision; lng:=(p_input->>'longitude')::double precision; accuracy:=(p_input->>'accuracy_m')::double precision;
  if lat is null or lng is null or accuracy is null or not(lat between -90 and 90) or not(lng between -180 and 180) or not(accuracy between 0 and 100000) then raise exception 'invalid_input'; end if;
  update public.trip_locations set latitude=lat,longitude=lng,accuracy_m=accuracy,observed_at=now(),updated_at=now() where trip_id=p_trip;
  perform private.record_recommendation(p_trip);
  return jsonb_build_object('active',true,'approaching',private.is_approaching(p_trip),'observed_at',now());
end; $$;
revoke all on function private.track_trip_location(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.track_trip_location(uuid,uuid,text,jsonb) to authenticated;
create function public.track_trip_location(p_trip uuid,p_session uuid,p_action text,p_input jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.track_trip_location(p_trip,p_session,p_action,p_input); $$;
revoke all on function public.track_trip_location(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.track_trip_location(uuid,uuid,text,jsonb) to authenticated;

create function private.end_trip_location() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='completed' then delete from public.trip_locations where trip_id=new.id;
 elsif new.status<>'in_transit' then update public.trip_locations set sharing_active=false,updated_at=now() where trip_id=new.id; end if;
 return new;
end; $$;
revoke all on function private.end_trip_location() from public,anon,authenticated;
create trigger end_trip_location after update of status on public.trips for each row execute function private.end_trip_location();

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.trip_locations;
 end if;
end $$;
