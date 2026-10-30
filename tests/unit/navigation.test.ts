import { describe, it, expect } from "vitest";
import {
  validPoint,
  illustrativeRoute,
  interpolateRoute,
  DEMO_ORIGIN,
} from "../../src/lib/domain/navigation";
describe("A18 approximate navigation", () => {
  it("rejects unavailable or invalid coordinates rather than treating null as zero", () => {
    expect(validPoint(null, null)).toBe(false);
    expect(validPoint(NaN, 57)).toBe(false);
    expect(validPoint(91, 57)).toBe(false);
    expect(validPoint(19, Infinity)).toBe(false);
    expect(validPoint(0, 0)).toBe(true);
  });
  it("updates its endpoint when the assigned gate changes and keeps endpoints exact", () => {
    const first = { lat: 19.675, lng: 57.704 },
      next = { lat: 19.675, lng: 57.706 };
    const path = illustrativeRoute(DEMO_ORIGIN, first);
    expect(interpolateRoute(path, 0)).toEqual(DEMO_ORIGIN);
    expect(interpolateRoute(path, 1)).toEqual(first);
    expect(illustrativeRoute(DEMO_ORIGIN, next).at(-1)).toEqual(next);
    const mid = interpolateRoute(path, 0.4);
    expect(validPoint(mid.lat, mid.lng)).toBe(true);
    expect(interpolateRoute(path, 2)).toEqual(first);
  });
});
