-- A18 / FR01, FR05, FR07: three operation types; refrigerated identity checks remain independent.
alter table public.gates add column display_order integer not null default 999;
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
  select * into target_gate from public.gates where id=(p_input->>'gate_id')::uuid;
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
  values(result_id,'trip_created',actor.id,target_gate.id,'simulation',p_input,p_key);
  return result_id;
end;
$$;

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

create or replace function private.enrich_trip_event() returns trigger
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
      'container', case when t.operation_type in ('container','refrigerated') then coalesce(new.payload->'input'->>'container'=t.container_number,false) else null end,
      'eligibility',coalesce(g.status in ('open','busy') and t.operation_type=any(g.eligible_operations),false),
      'appointment',now() between t.appointment_start_at and t.appointment_end_at));
  end if;
  return new;
end; $$;
