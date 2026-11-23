import { expect, it } from "vitest";
import {
  advanceStoryTruck,
  backgroundGateTraffic,
  DISPATCH_CYCLE,
  entryRoute,
  gateTraffic,
  PORT_TRAFFIC,
} from "../../src/lib/domain/port-traffic";

const halfTruckLength = 1.2;

function hidden(pose: { x: number; z: number }) {
  return pose.x - halfTruckLength >= PORT_TRAFFIC.entryEdgeX ||
    pose.z + halfTruckLength <= PORT_TRAFFIC.exitEdgeZ;
}

it("aligns trucks to the access road, smooth turns and each gate lane", () => {
  for (let gate = 1; gate <= 8; gate++) {
    const route = entryRoute(gate);
    for (let d = 0.01; d < route.endDistance - 0.001; d += 0.05) {
      const a = route.point(d);
      const b = route.point(d + 0.001);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      expect(
        (Math.sin(a.heading) * dx + Math.cos(a.heading) * dz) / Math.hypot(dx, dz),
      ).toBeGreaterThan(0.99999);
    }
    expect(hidden(gateTraffic(route, 0))).toBe(true);
    expect(hidden(gateTraffic(route, route.endTime))).toBe(true);
    expect(gateTraffic(route, route.stopTime).z).toBeCloseTo(PORT_TRAFFIC.stopZ);
  }
});

it("stays behind the barrier while blocked and waits for a hidden slot before respawning", () => {
  const story = { gate: 1, elapsed: 0, nextDispatch: DISPATCH_CYCLE };
  const route = entryRoute(1);
  for (let clock = 0; clock < 31; clock += 0.025)
    advanceStoryTruck(story, clock, 0.025, 1, false);
  expect(story.elapsed).toBeCloseTo(route.stopTime);
  expect(gateTraffic(route, story.elapsed).open).toBe(false);

  for (let clock = 31; clock < 40; clock += 0.025)
    advanceStoryTruck(story, clock, 0.025, 2, true);
  expect(story.gate).toBe(1);
  expect(hidden(gateTraffic(route, story.elapsed))).toBe(true);
  advanceStoryTruck(story, DISPATCH_CYCLE * 2, 0.025, 2, true);
  expect(story.gate).toBe(2);
  expect(hidden(gateTraffic(entryRoute(2), story.elapsed))).toBe(true);
});

it("dispatches at safe intervals and only resets trucks out of sight", () => {
  for (const gate of [1, 2]) {
    const story = { gate, elapsed: 0, nextDispatch: DISPATCH_CYCLE };
    let previous = [gateTraffic(entryRoute(gate), 0), ...backgroundGateTraffic(0)];
    for (let clock = 0.025; clock < DISPATCH_CYCLE * 3; clock += 0.025) {
      advanceStoryTruck(story, clock, 0.025, gate, true);
      const fleet = [gateTraffic(entryRoute(story.gate), story.elapsed), ...backgroundGateTraffic(clock)];
      for (const [index, pose] of fleet.entries()) {
        const last = previous[index];
        const distance = Math.hypot(pose.x - last.x, pose.z - last.z);
        if (distance > 0.15) expect(hidden(pose) && hidden(last)).toBe(true);
        if (pose.z < 2.95 && pose.z > 0.55) expect(pose.open).toBe(true);
        if (hidden(pose)) continue;
        for (const other of fleet.slice(index + 1)) {
          if (hidden(other)) continue;
          expect(Math.hypot(pose.x - other.x, pose.z - other.z)).toBeGreaterThan(2.6);
        }
      }
      previous = fleet;
    }
  }
});


it("can select a different lane before the turn without changing the truck position", () => {
  const story = { gate: 1, elapsed: 7, nextDispatch: DISPATCH_CYCLE };
  const before = gateTraffic(entryRoute(1), story.elapsed);
  advanceStoryTruck(story, 7, 0, 2, false);
  expect(story.gate).toBe(2);
  expect(gateTraffic(entryRoute(2), story.elapsed)).toEqual(before);
});
