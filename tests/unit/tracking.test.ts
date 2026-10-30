import { it, expect } from "vitest";
import {
  googleNavigationUrl,
  isApproaching,
  type SharedLocation,
} from "../../src/lib/tracking";
import { initialGate } from "../../src/lib/domain/journey";
it("uses a Google driving-navigation URL with only the destination and rejects absent coordinates", () => {
  const link = new URL(googleNavigationUrl(19.675, 57.704)!);
  expect(link.origin).toBe("https://www.google.com");
  expect(link.searchParams.get("api")).toBe("1");
  expect(link.searchParams.get("dir_action")).toBe("navigate");
  expect(link.searchParams.has("origin")).toBe(false);
  expect(googleNavigationUrl(null, null)).toBeNull();
});
it("requires a fresh authorized sharing session within 5 km including accuracy", () => {
  const point = {
    source: "gps",
    sharing_active: true,
    latitude: 19.665,
    longitude: 57.704,
    accuracy_m: 5,
    observed_at: new Date().toISOString(),
  } as SharedLocation;
  const gate = { latitude: 19.675, longitude: 57.704 };
  expect(isApproaching(point, gate)).toBe(true);
  expect(isApproaching({ ...point, sharing_active: false }, gate)).toBe(false);
  expect(
    isApproaching(
      { ...point, observed_at: new Date(Date.now() - 91000).toISOString() },
      gate,
    ),
  ).toBe(false);
  expect(isApproaching({ ...point, accuracy_m: 6000 }, gate)).toBe(false);
  expect(isApproaching({ ...point, latitude: 19.5 }, gate)).toBe(false);
});
it("initial assignment excludes ineligible, closed and unknown-telemetry gates", () => {
  const gate = {
    id: "a",
    code: "A",
    is_simulated: true,
    status: "open",
    queue_length: 8,
    service_rate_per_hour: 15,
    eligible_operations: ["container"],
  };
  expect(
    initialGate(
      [
        gate,
        { ...gate, id: "b", code: "B", queue_length: 1 },
        { ...gate, id: "closed", status: "closed", queue_length: 0 },
        { ...gate, id: "unknown", queue_length: null },
      ],
      "container",
    )?.id,
  ).toBe("b");
  expect(initialGate([gate], "refrigerated")).toBeNull();
});
