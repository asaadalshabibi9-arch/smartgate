-- A18: eight illustrative gates, three specializations. Existing IDs/trips are preserved.
-- Run once after the schema migration; replay is idempotent, but resets demo telemetry.
insert into public.gates(code,name,eligible_operations,status,queue_length,service_rate_per_hour,latitude,longitude,display_order,is_simulated,telemetry_updated_at)
values
('GATE-A','بوابة الحاويات ١',array['container'],'busy',8,15,19.6750,57.7040,1,true,now()),
('GATE-B','بوابة الحاويات ٢',array['container'],'open',3,15,19.6750,57.7060,2,true,now()),
('GATE-D','بوابة الحاويات ٣',array['container'],'open',5,18,19.6750,57.7080,3,true,now()),
('GATE-C','بوابة البضائع العامة ٤',array['general_cargo'],'closed',null,null,19.6750,57.7100,4,true,now()),
('GATE-E','بوابة البضائع العامة ٥',array['general_cargo'],'open',2,12,19.6750,57.7120,5,true,now()),
('GATE-F','بوابة البضائع العامة ٦',array['general_cargo'],'busy',9,12,19.6750,57.7140,6,true,now()),
('GATE-G','بوابة الشحنات المبردة ٧',array['refrigerated'],'open',2,10,19.6750,57.7160,7,true,now()),
('GATE-H','بوابة الشحنات المبردة ٨',array['refrigerated'],'out_of_service',null,null,19.6750,57.7180,8,true,now())
on conflict(code) do update set name=excluded.name,eligible_operations=excluded.eligible_operations,
status=excluded.status,queue_length=excluded.queue_length,service_rate_per_hour=excluded.service_rate_per_hour,
latitude=excluded.latitude,longitude=excluded.longitude,display_order=excluded.display_order,telemetry_updated_at=excluded.telemetry_updated_at
where public.gates.is_simulated;

insert into public.operator_gates(profile_id,gate_id)
select distinct og.profile_id,target.id from public.operator_gates og
join public.gates source on source.id=og.gate_id
join public.gates target on (source.code in ('GATE-A','GATE-B') and target.code='GATE-D')
or (source.code='GATE-C' and target.code in ('GATE-E','GATE-F','GATE-G','GATE-H'))
where source.is_simulated and target.is_simulated
on conflict do nothing;
