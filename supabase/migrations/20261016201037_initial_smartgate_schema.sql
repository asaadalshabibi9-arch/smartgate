create extension if not exists pgcrypto;

create type public.app_role as enum (
  'company_admin',
  'driver',
  'gate_operator',
  'demo_admin'
);

create type public.trip_status as enum (
  'planned',
  'in_transit',
  'at_gate',
  'verification_failed',
  'verified',
  'barrier_failed',
  'barrier_open',
  'completed',
  'exception'
);

create type public.gate_status as enum ('open', 'busy', 'closed', 'out_of_service');

create type public.trip_event_type as enum (
  'trip_created',
  'trip_started',
  'arrival_reported',
  'recommendation_accepted',
  'verification_passed',
  'verification_failed',
  'barrier_open_requested',
  'barrier_opened',
  'barrier_failed',
  'crossing_confirmed',
  'exception_recorded'
);

create type public.notification_status as enum ('pending', 'delivered', 'failed');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete restrict,
  full_name text not null check (char_length(trim(full_name)) > 0),
  role public.app_role not null default 'driver',
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_role_membership check (
    role in ('gate_operator', 'demo_admin') or company_id is not null
  )
);

create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  plate_number text not null,
  vehicle_type text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, plate_number)
);

create table public.gates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status public.gate_status not null default 'open',
  eligible_operations text[] not null default '{}',
  queue_length integer check (queue_length is null or queue_length >= 0),
  estimated_wait_minutes integer check (
    estimated_wait_minutes is null or estimated_wait_minutes >= 0
  ),
  is_simulated boolean not null default true,
  telemetry_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  company_id uuid not null references public.companies(id) on delete restrict,
  driver_profile_id uuid not null references public.profiles(id) on delete restrict,
  truck_id uuid not null references public.trucks(id) on delete restrict,
  gate_id uuid references public.gates(id) on delete restrict,
  operation_type text not null,
  cargo_type text,
  cargo_weight_kg numeric(12, 3) check (
    cargo_weight_kg is null or cargo_weight_kg >= 0
  ),
  container_number text,
  planned_departure_at timestamptz,
  appointment_start_at timestamptz not null,
  appointment_end_at timestamptz not null,
  status public.trip_status not null default 'planned',
  is_simulated boolean not null default true,
  crossed_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_appointment_window check (
    appointment_end_at > appointment_start_at
  ),
  constraint completed_after_crossing check (
    status <> 'completed' or (crossed_at is not null and completed_at is not null)
  )
);

create table public.trip_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  event_type public.trip_event_type not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  gate_id uuid references public.gates(id) on delete restrict,
  source text not null default 'app',
  reason text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  purpose text not null,
  channel text not null default 'in_app',
  status public.notification_status not null default 'pending',
  is_simulated boolean not null default true,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_company_id_idx on public.profiles(company_id);
create index trucks_company_id_idx on public.trucks(company_id);
create index trips_company_id_idx on public.trips(company_id);
create index trips_driver_profile_id_idx on public.trips(driver_profile_id);
create index trips_truck_id_idx on public.trips(truck_id);
create index trips_gate_id_idx on public.trips(gate_id);
create index trips_created_by_idx on public.trips(created_by);
create index trips_status_idx on public.trips(status);
create index trip_events_trip_occurred_idx on public.trip_events(trip_id, occurred_at);
create index trip_events_actor_profile_id_idx on public.trip_events(actor_profile_id);
create index trip_events_gate_id_idx on public.trip_events(gate_id);
create index notifications_trip_id_idx on public.notifications(trip_id);
create index notifications_recipient_idx on public.notifications(recipient_profile_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trucks_set_updated_at
before update on public.trucks
for each row execute function public.set_updated_at();

create trigger gates_set_updated_at
before update on public.gates
for each row execute function public.set_updated_at();

create trigger trips_set_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

create schema if not exists private;

create function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where user_id = (select auth.uid());
$$;

create function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select company_id from public.profiles where user_id = (select auth.uid());
$$;

create function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where user_id = (select auth.uid());
$$;

create function private.can_access_trip(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    join public.profiles p on p.user_id = (select auth.uid())
    where t.id = target_trip_id
      and (
        p.role in ('gate_operator', 'demo_admin')
        or t.company_id = p.company_id
        or t.driver_profile_id = p.id
      )
  );
$$;

create function private.guard_trip_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed'
     and old.status <> 'completed'
     and coalesce(
       current_setting('smartgate.crossing_confirmed', true),
       'false'
     ) <> 'true' then
    raise exception 'A trip can only be completed by a crossing confirmation event';
  end if;

  return new;
end;
$$;

create trigger trips_guard_completion
before update on public.trips
for each row execute function private.guard_trip_completion();

create function private.complete_trip_after_crossing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type = 'crossing_confirmed' then
    if (select private.current_role()) not in ('gate_operator', 'demo_admin') then
      raise exception 'Only a gate operator can confirm crossing';
    end if;

    perform set_config('smartgate.crossing_confirmed', 'true', true);

    update public.trips
    set status = 'completed',
        crossed_at = new.occurred_at,
        completed_at = new.occurred_at
    where id = new.trip_id;
  end if;

  return new;
end;
$$;

create trigger trip_crossing_completes_trip
after insert on public.trip_events
for each row execute function private.complete_trip_after_crossing();

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.trucks enable row level security;
alter table public.gates enable row level security;
alter table public.trips enable row level security;
alter table public.trip_events enable row level security;
alter table public.notifications enable row level security;

create policy companies_select on public.companies
for select to authenticated
using (
  id = (select private.current_company_id())
  or (select private.current_role()) in ('gate_operator', 'demo_admin')
);

create policy companies_update on public.companies
for update to authenticated
using (
  id = (select private.current_company_id())
  and (select private.current_role()) = 'company_admin'
)
with check (
  id = (select private.current_company_id())
  and (select private.current_role()) = 'company_admin'
);

create policy profiles_select on public.profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    company_id = (select private.current_company_id())
    and (select private.current_role()) = 'company_admin'
  )
  or (select private.current_role()) in ('gate_operator', 'demo_admin')
);

create policy profiles_update_self on public.profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and role = (select private.current_role())
  and company_id is not distinct from (select private.current_company_id())
);

create policy trucks_select on public.trucks
for select to authenticated
using (
  company_id = (select private.current_company_id())
  or (select private.current_role()) in ('gate_operator', 'demo_admin')
);

create policy trucks_manage on public.trucks
for all to authenticated
using (
  company_id = (select private.current_company_id())
  and (select private.current_role()) = 'company_admin'
)
with check (
  company_id = (select private.current_company_id())
  and (select private.current_role()) = 'company_admin'
);

create policy gates_select on public.gates
for select to authenticated using (true);

create policy gates_update on public.gates
for update to authenticated
using ((select private.current_role()) in ('gate_operator', 'demo_admin'))
with check ((select private.current_role()) in ('gate_operator', 'demo_admin'));

create policy trips_select on public.trips
for select to authenticated using (private.can_access_trip(id));

create policy trips_insert on public.trips
for insert to authenticated
with check (
  (select private.current_role()) in ('company_admin', 'demo_admin')
  and (
    company_id = (select private.current_company_id())
    or (select private.current_role()) = 'demo_admin'
  )
);

create policy trips_update on public.trips
for update to authenticated
using (
  (
    company_id = (select private.current_company_id())
    and (select private.current_role()) = 'company_admin'
  )
  or (select private.current_role()) in ('gate_operator', 'demo_admin')
)
with check (
  (
    company_id = (select private.current_company_id())
    and (select private.current_role()) = 'company_admin'
  )
  or (select private.current_role()) in ('gate_operator', 'demo_admin')
);

create policy trip_events_select on public.trip_events
for select to authenticated using (private.can_access_trip(trip_id));

create policy trip_events_insert on public.trip_events
for insert to authenticated
with check (
  private.can_access_trip(trip_id)
  and actor_profile_id = (select private.current_profile_id())
  and (
    (select private.current_role()) = 'demo_admin'
    or (
      (select private.current_role()) = 'driver'
      and event_type in (
        'trip_started', 'arrival_reported', 'recommendation_accepted'
      )
    )
    or (
      (select private.current_role()) = 'company_admin'
      and event_type in (
        'trip_created', 'recommendation_accepted', 'exception_recorded'
      )
    )
    or (
      (select private.current_role()) = 'gate_operator'
      and event_type in (
        'verification_passed', 'verification_failed',
        'barrier_open_requested', 'barrier_opened', 'barrier_failed',
        'crossing_confirmed', 'exception_recorded'
      )
    )
  )
);

create policy notifications_select on public.notifications
for select to authenticated
using (
  recipient_profile_id = (select private.current_profile_id())
  or private.can_access_trip(trip_id)
);

create policy notifications_insert on public.notifications
for insert to authenticated
with check (
  private.can_access_trip(trip_id)
  and (select private.current_role()) in ('company_admin', 'gate_operator', 'demo_admin')
);

revoke all on all tables in schema public from anon;
grant select, update on public.companies to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.trucks to authenticated;
grant select, update on public.gates to authenticated;
grant select, insert, update on public.trips to authenticated;
grant select, insert on public.trip_events to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke all on schema private from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.current_company_id() to authenticated;
grant execute on function private.current_profile_id() to authenticated;
grant execute on function private.can_access_trip(uuid) to authenticated;

comment on table public.trips is
  'SmartGate entry trips. A trip can only become completed after crossing confirmation.';
comment on column public.trips.is_simulated is
  'True when the trip or its operational data belongs to the declared hackathon simulation.';
comment on table public.trip_events is
  'Append-only operational and audit timeline for each entry trip.';
