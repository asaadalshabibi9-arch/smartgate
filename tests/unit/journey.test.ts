import { describe, it, expect } from "vitest";
import {
  estimateWait,
  recommend,
  tripSchema,
  muscatToISO,
  muscatInput,
  type GateEstimate,
} from "../../src/lib/domain/journey";
import { copy, dateTime } from "../../src/lib/i18n";
const now = new Date("2026-10-17T12:00:00Z");
const gate = (
  id: string,
  queue: number | null,
  status = "open",
  operations = ["container"],
): GateEstimate => ({
  id,
  code: id,
  status,
  queue_length: queue,
  service_rate_per_hour: 15,
  eligible_operations: operations,
  is_simulated: true,
});
const trip = {
  gate_id: "a",
  operation_type: "container",
  travel_minutes: 30,
  appointment_start_at: "2026-10-17T11:00:00Z",
  appointment_end_at: "2026-10-17T14:00:00Z",
};
describe("FR04–FR05 honest estimates and eligible recommendations", () => {
  it("distinguishes empty queues from unavailable or invalid telemetry", () => {
    expect(estimateWait(gate("a", 0))).toBe(0);
    expect(estimateWait(gate("a", 8))).toBe(32);
    for (const q of [null, -1, Infinity, NaN])
      expect(estimateWait(gate("a", q))).toBeNull();
    expect(
      estimateWait({ queue_length: 8, service_rate_per_hour: 0 }),
    ).toBeNull();
  });
  it("never recommends closed, incompatible or unmarked gates", () => {
    const choices = [
      gate("a", 8),
      gate("b", 1, "closed"),
      gate("c", 1, "open", ["general_cargo"]),
      { ...gate("d", 1), is_simulated: false },
      gate("e", 3),
    ];
    expect(recommend(choices, trip, now).gate?.id).toBe("e");
  });
  it("does not invent a baseline with missing telemetry or leave the appointment window", () => {
    expect(recommend([gate("a", null), gate("b", 1)], trip, now).reason).toBe(
      "missingData",
    );
    expect(
      recommend(
        [gate("a", 8), gate("b", 1)],
        { ...trip, travel_minutes: 180 },
        now,
      ).reason,
    ).toBe("outsideWindow");
  });
  it("retains the current gate on a tie and avoids unnecessary change", () => {
    expect(recommend([gate("a", 2), gate("b", 2)], trip, now).gate).toBeNull();
  });
});
describe("validation, timezone and locale completeness", () => {
  it("rejects missing cargo weight, dates and required container identity", () => {
    const valid = {
      driver_profile_id: "00000000-0000-4000-8000-000000000001",
      truck_id: "00000000-0000-4000-8000-000000000002",
      gate_id: "00000000-0000-4000-8000-000000000003",
      operation_type: "container",
      cargo_type: "Synthetic",
      cargo_weight_kg: "12000",
      container_number: "DEMO-1",
      planned_departure_at: now.toISOString(),
      appointment_start_at: now.toISOString(),
      appointment_end_at: "2026-10-17T14:00:00Z",
      travel_minutes: 30,
    };
    expect(tripSchema.safeParse(valid).success).toBe(true);
    for (const changes of [
      { cargo_weight_kg: "" },
      { cargo_weight_kg: " " },
      { cargo_weight_kg: -1 },
      { cargo_weight_kg: "NaN" },
      { container_number: "" },
      { appointment_end_at: "bad" },
      { appointment_end_at: now.toISOString() },
    ])
      expect(tripSchema.safeParse({ ...valid, ...changes }).success).toBe(
        false,
      );
  });
  it("converts Muscat inputs without relying on machine timezone", () => {
    expect(muscatInput(now)).toBe("2026-10-17T16:00");
    expect(muscatToISO("2026-10-17T16:00")).toBe(now.toISOString());
    expect(muscatToISO("bad")).toBe("");
    expect(dateTime("en", null)).toBe("Unavailable");
  });
  it("every UI message has nonempty Arabic and English values", () => {
    for (const [key, pair] of Object.entries(copy)) {
      expect(pair.length, key).toBe(2);
      expect(pair[0].trim(), key).not.toBe("");
      expect(pair[1].trim(), key).not.toBe("");
    }
  });
});
