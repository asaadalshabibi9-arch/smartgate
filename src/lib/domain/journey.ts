import { z } from "zod";

export const tripSchema = z
  .object({
    driver_profile_id: z.uuid(),
    truck_id: z.uuid(),
    gate_id: z.uuid(),
    operation_type: z.enum(["container", "general_cargo"]),
    cargo_type: z.string().trim().min(1).max(200),
    cargo_weight_kg: z
      .union([z.number(), z.string().trim().min(1)])
      .transform(Number)
      .pipe(z.number().min(0).max(999999999)),
    container_number: z.string().trim().max(40),
    planned_departure_at: z.iso.datetime({ offset: true }),
    appointment_start_at: z.iso.datetime({ offset: true }),
    appointment_end_at: z.iso.datetime({ offset: true }),
    travel_minutes: z.coerce.number().int().min(0).max(1440),
  })
  .refine(
    (x) => x.operation_type !== "container" || x.container_number.length > 0,
    { path: ["container_number"], message: "invalid_input" },
  )
  .refine(
    (x) => new Date(x.appointment_end_at) > new Date(x.appointment_start_at),
    { path: ["appointment_end_at"], message: "invalid_input" },
  );

export type GateEstimate = {
  id: string;
  code: string;
  status: string;
  eligible_operations: string[];
  queue_length: number | null;
  service_rate_per_hour: number | null;
  is_simulated: boolean;
};
export function estimateWait(
  gate: Pick<GateEstimate, "queue_length" | "service_rate_per_hour">,
) {
  const { queue_length: q, service_rate_per_hour: r } = gate;
  return q !== null &&
    r !== null &&
    Number.isFinite(q) &&
    Number.isFinite(r) &&
    q >= 0 &&
    r > 0
    ? Math.ceil((q * 60) / r)
    : null;
}
export function recommend(
  gates: GateEstimate[],
  trip: {
    gate_id: string | null;
    operation_type: string;
    travel_minutes: number;
    appointment_start_at: string;
    appointment_end_at: string;
  },
  now: Date,
) {
  const eta = new Date(now.getTime() + trip.travel_minutes * 60000);
  if (
    eta < new Date(trip.appointment_start_at) ||
    eta > new Date(trip.appointment_end_at)
  )
    return { gate: null, reason: "outsideWindow", eta };
  const current = gates.find((g) => g.id === trip.gate_id);
  if (!current || estimateWait(current) === null)
    return { gate: null, reason: "missingData", eta };
  const candidates = gates
    .filter(
      (g) =>
        g.is_simulated &&
        ["open", "busy"].includes(g.status) &&
        g.eligible_operations.includes(trip.operation_type) &&
        estimateWait(g) !== null,
    )
    .sort(
      (a, b) =>
        estimateWait(a)! - estimateWait(b)! ||
        Number(b.id === trip.gate_id) - Number(a.id === trip.gate_id) ||
        a.code.localeCompare(b.code),
    );
  const best = candidates[0];
  return {
    gate:
      best &&
      best.id !== current.id &&
      estimateWait(best)! < estimateWait(current)!
        ? best
        : null,
    reason: "noAlternative",
    eta,
  };
}

// datetime-local inputs are explicitly displayed as Muscat time (UTC+4), never host-local time.
export function muscatToISO(value: string) {
  const date = new Date(`${value}+04:00`);
  return value && Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
export function muscatInput(value: Date) {
  return new Date(value.getTime() + 4 * 3600000).toISOString().slice(0, 16);
}
