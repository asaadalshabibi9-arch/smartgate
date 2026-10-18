insert into public.gates (
  code,
  name,
  status,
  eligible_operations,
  queue_length,
  service_rate_per_hour,
  estimated_wait_minutes,
  is_simulated,
  telemetry_updated_at
)
values
  ('GATE-A', 'البوابة أ', 'busy', array['container', 'general_cargo'], 8, 15, 32, true, now()),
  ('GATE-B', 'البوابة ب', 'open', array['container', 'general_cargo'], 3, 15, 12, true, now()),
  ('GATE-C', 'البوابة ج', 'closed', array['general_cargo'], null, null, null, true, now())
on conflict (code) do update
set name = excluded.name,
    status = excluded.status,
    eligible_operations = excluded.eligible_operations,
    queue_length = excluded.queue_length,
    service_rate_per_hour = excluded.service_rate_per_hour,
    estimated_wait_minutes = excluded.estimated_wait_minutes,
    is_simulated = excluded.is_simulated,
    telemetry_updated_at = excluded.telemetry_updated_at;
