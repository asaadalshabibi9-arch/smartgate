// A20: illustrative entry traffic, entirely within the existing 28 × 23 model.
export const PORT_TRAFFIC = {
  startX: 12.2,
  approachZ: 8.6,
  turnRadius: 1.6,
  stopZ: 3.7,
  crossedZ: -2.7,
  spacing: 3.9,
  startDistance: 15,
  speed: 1.25,
} as const;

export function entryRoute(alternate: boolean) {
  const gateX = alternate ? -7.5 : -10.5;
  const p = PORT_TRAFFIC;
  const straight = p.startX - gateX - p.turnRadius;
  const bend = (Math.PI * p.turnRadius) / 2;
  const turnEndZ = p.approachZ - p.turnRadius;
  return {
    gateX,
    straight,
    bend,
    stopDistance: straight + bend + turnEndZ - p.stopZ,
    endDistance: straight + bend + turnEndZ - p.crossedZ,
    point(distance: number) {
      const d = Math.max(0, distance);
      if (d <= straight)
        return { x: p.startX - d, z: p.approachZ, heading: -Math.PI / 2 };
      if (d < straight + bend) {
        const angle = Math.PI / 2 + (d - straight) / p.turnRadius;
        return {
          x: gateX + p.turnRadius + p.turnRadius * Math.cos(angle),
          z: turnEndZ + p.turnRadius * Math.sin(angle),
          heading: Math.atan2(-Math.sin(angle), Math.cos(angle)),
        };
      }
      return {
        x: gateX,
        z: turnEndZ - (d - straight - bend),
        heading: Math.PI,
      };
    },
  };
}

export function portTraffic(
  seconds: number,
  alternate: boolean,
  crossing: boolean,
  blocked = false,
) {
  const route = entryRoute(alternate);
  const p = PORT_TRAFFIC;
  const destination = crossing ? route.endDistance : route.stopDistance;
  const travelTime = (destination - p.startDistance) / p.speed;
  const cycle = travelTime + 3.2;
  const time = blocked ? Math.min(seconds, travelTime + 1) : seconds % cycle;
  const distance = Math.min(destination, p.startDistance + time * p.speed);
  // Fade the whole convoy for a hidden loop reset; no reverse motion/teleport.
  const opacity = blocked
    ? Math.min(1, time / 0.6)
    : Math.min(1, time / 0.6, (cycle - time) / 0.6);
  return {
    route,
    opacity,
    trucks: Array.from({ length: 4 }, (_, index) => {
      const following = index * p.spacing;
      const d =
        index === 0
          ? distance
          : Math.min(distance - following, route.stopDistance - following);
      return { ...route.point(d), distance: d };
    }),
  };
}
