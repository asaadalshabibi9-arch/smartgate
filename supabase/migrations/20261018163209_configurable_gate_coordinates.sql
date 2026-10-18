-- A16: reference coordinates are administrator-configured, not GPS telemetry.
set lock_timeout = '5s';
alter table public.gates add column latitude double precision;
alter table public.gates add column longitude double precision;
alter table public.gates add constraint gate_coordinate_pair check (
 (latitude is null and longitude is null) or
 (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
);
reset lock_timeout;
