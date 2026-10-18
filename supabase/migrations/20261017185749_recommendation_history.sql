-- FR05/FR13: preserve a recommendation before acceptance, with the calculation snapshot.
alter type public.trip_event_type add value if not exists 'recommendation_generated';

create function private.record_recommendation(p_trip uuid) returns void
language plpgsql security definer set search_path='' as $$
declare trip public.trips; current_gate public.gates; best public.gates; prior jsonb; details jsonb; eta timestamptz;
begin
 select * into trip from public.trips where id=p_trip and is_simulated for update;
 if trip.id is null or trip.status not in ('planned','in_transit') then return; end if;
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
 'wait_after',ceil(best.queue_length*60/best.service_rate_per_hour),'reason','lower_estimated_wait');
 select payload->'details' into prior from public.trip_events where trip_id=p_trip and event_type::text='recommendation_generated' order by id desc limit 1;
 if prior is not distinct from details then return; end if;
 insert into public.trip_events(trip_id,event_type,actor_profile_id,gate_id,source,reason,payload)
 values(p_trip,'recommendation_generated',private.current_profile_id(),best.id,'simulation','lower_estimated_wait',jsonb_build_object('details',details,'eta',eta));
end; $$;
revoke all on function private.record_recommendation(uuid) from public,anon,authenticated;

create function private.recommend_after_journey_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.event_type in ('trip_created','trip_started') then perform private.record_recommendation(new.trip_id); end if;
 return new;
end; $$;
create trigger recommend_after_journey_event after insert on public.trip_events
for each row execute function private.recommend_after_journey_event();
revoke all on function private.recommend_after_journey_event() from public,anon,authenticated;

create function private.recommend_after_gate_update() returns trigger
language plpgsql security definer set search_path='' as $$
declare trip_id uuid;
begin
 for trip_id in select id from public.trips where is_simulated and status in ('planned','in_transit') order by id
 loop perform private.record_recommendation(trip_id); end loop;
 return new;
end; $$;
create trigger recommend_after_gate_update after update on public.gates
for each row execute function private.recommend_after_gate_update();
revoke all on function private.recommend_after_gate_update() from public,anon,authenticated;

-- Match server/UI bounds at the database boundary, including PostgreSQL numeric NaN.
alter table public.trips add constraint trip_demo_payload_bounds check (
 (cargo_weight_kg is null or cargo_weight_kg between 0 and 999999999)
 and (cargo_type is null or char_length(cargo_type)<=200)
 and (container_number is null or char_length(container_number)<=40));
alter table public.gates add constraint gate_demo_telemetry_bounds check (
 (queue_length is null or queue_length between 0 and 10000)
 and (service_rate_per_hour is null or service_rate_per_hour between 0.000001 and 10000));
