// Coordinates are illustrative and shared by the scene and its traffic paths.
export const PORT_TRAFFIC = {
  startX: 15.5,
  entryEdgeX: 14,
  approachZ: 8.6,
  turnRadius: 1.6,
  stopZ: 3.7,
  exitEdgeZ: -4.25,
  endZ: -5.75,
  speed: 2.5,
  dispatchInterval: 3.5,
} as const;

export const BACKGROUND_GATES = [3, 4, 5, 6, 8] as const;
export const DISPATCH_CYCLE =
  PORT_TRAFFIC.dispatchInterval * (BACKGROUND_GATES.length + 1);

export function portGateX(gate: number) {
  return -10.5 + (gate - 1) * 3;
}

export function entryRoute(gate: number) {
  const gateX = portGateX(gate);
  const p = PORT_TRAFFIC;
  const straight = p.startX - gateX - p.turnRadius;
  const bend = (Math.PI * p.turnRadius) / 2;
  const turnEndZ = p.approachZ - p.turnRadius;
  const stopDistance = straight + bend + turnEndZ - p.stopZ;
  const endDistance = straight + bend + turnEndZ - p.endZ;
  return {
    endDistance,
    turnTime: straight / p.speed,
    stopTime: stopDistance / p.speed,
    releaseTime: stopDistance / p.speed + 1.2,
    endTime: endDistance / p.speed + 1.2,
    point(distance: number) {
      const d = Math.min(endDistance, Math.max(0, distance));
      if (d <= straight)
        return { x: p.startX - d, z: p.approachZ, heading: -Math.PI / 2 };
      if (d < straight + bend) {
        const angle = Math.PI / 2 + (d - straight) / p.turnRadius;
        return {
          x: gateX + p.turnRadius * Math.cos(angle) + p.turnRadius,
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

export function gateTraffic(route: ReturnType<typeof entryRoute>, time: number) {
  const driveTime =
    Math.min(time, route.stopTime) + Math.max(0, time - route.releaseTime);
  return {
    ...route.point(driveTime * PORT_TRAFFIC.speed),
    open: time > route.stopTime && time < route.endTime,
  };
}

const backgroundRoutes = BACKGROUND_GATES.map(entryRoute);

export function backgroundGateTraffic(seconds: number) {
  return backgroundRoutes.map((route, index) => {
    const offset = (index + 1) * PORT_TRAFFIC.dispatchInterval;
    const time = (seconds - offset + DISPATCH_CYCLE) % DISPATCH_CYCLE;
    return { gate: BACKGROUND_GATES[index], ...gateTraffic(route, time) };
  });
}

export function advanceStoryTruck(
  story: { gate: number; elapsed: number; nextDispatch: number },
  clock: number,
  delta: number,
  desiredGate: number,
  crossing: boolean,
) {
  const route = entryRoute(story.gate);
  if (story.elapsed >= route.endTime) {
    if (clock >= story.nextDispatch) {
      story.gate = desiredGate;
      story.elapsed = clock - story.nextDispatch;
      story.nextDispatch += DISPATCH_CYCLE;
    }
    return;
  }

  const desiredRoute = entryRoute(desiredGate);
  // Both routes share the same road until the earlier turn.
  if (story.elapsed < Math.min(route.turnTime, desiredRoute.turnTime))
    story.gate = desiredGate;

  const activeRoute = entryRoute(story.gate);
  const next = story.elapsed + delta;
  // Once released, let the truck clear the barrier before applying another scenario.
  story.elapsed =
    crossing || story.elapsed > activeRoute.stopTime
      ? Math.min(next, activeRoute.endTime)
      : Math.min(next, activeRoute.stopTime);
  if (story.elapsed >= activeRoute.endTime)
    story.nextDispatch = (Math.floor(clock / DISPATCH_CYCLE) + 1) * DISPATCH_CYCLE;
}
