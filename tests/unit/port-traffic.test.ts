import { expect, it } from "vitest";
import {
  entryRoute,
  portTraffic,
  PORT_TRAFFIC,
} from "../../src/lib/domain/port-traffic";

it("faces the direction of travel through both smooth gate approaches", () => {
  for (const alternate of [false, true]) {
    const route = entryRoute(alternate);
    for (let d = 0.01; d < route.endDistance; d += 0.05) {
      const a = route.point(d),
        b = route.point(d + 0.001);
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const alignment =
        (Math.sin(a.heading) * dx + Math.cos(a.heading) * dz) /
        Math.hypot(dx, dz);
      expect(alignment).toBeGreaterThan(0.99999);
    }
  }
});

it("keeps every truck body inside the unchanged model and clear of the convoy through complete cycles", () => {
  for (const alternate of [false, true])
    for (const crossing of [false, true])
      for (let time = 0; time <= 60; time += 0.05) {
        const { trucks } = portTraffic(time, alternate, crossing);
        for (const pose of trucks)
          for (const x of [-0.44, 0.44])
            for (const z of [-1.1, 1.18]) {
              const worldX =
                pose.x +
                Math.cos(pose.heading) * x +
                Math.sin(pose.heading) * z;
              const worldZ =
                pose.z -
                Math.sin(pose.heading) * x +
                Math.cos(pose.heading) * z;
              expect(Math.abs(worldX)).toBeLessThan(14);
              expect(Math.abs(worldZ)).toBeLessThan(11.5);
            }
        for (let i = 0; i < trucks.length - 1; i++)
          expect(
            Math.hypot(
              trucks[i].x - trucks[i + 1].x,
              trucks[i].z - trucks[i + 1].z,
            ),
          ).toBeGreaterThan(2.6);
      }
});

it("holds traffic ahead of a blocked barrier and lets only the lead truck cross", () => {
  for (const alternate of [false, true]) {
    const stopped = portTraffic(100, alternate, false, true);
    expect(stopped.trucks[0].z).toBeCloseTo(PORT_TRAFFIC.stopZ);
    expect(stopped.opacity).toBe(1);
    const route = entryRoute(alternate);
    const arrived = portTraffic(
      (route.endDistance - PORT_TRAFFIC.startDistance) / PORT_TRAFFIC.speed + 1,
      alternate,
      true,
    );
    expect(arrived.trucks[0].z).toBeCloseTo(PORT_TRAFFIC.crossedZ);
    for (const following of arrived.trucks.slice(1))
      expect(following.distance).toBeLessThanOrEqual(
        route.stopDistance - PORT_TRAFFIC.spacing,
      );
  }
});
