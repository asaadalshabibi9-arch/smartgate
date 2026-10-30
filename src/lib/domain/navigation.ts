// A18: illustrative coordinates only. This is not a road-routing engine.
export type Point = { lat: number; lng: number };
export const DEMO_ORIGIN: Point = { lat: 19.652, lng: 57.665 };
export function validPoint(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
export function illustrativeRoute(from: Point, to: Point): Point[] {
  const approach = { lat: to.lat - 0.009, lng: to.lng - 0.006 };
  return [
    from,
    { lat: from.lat, lng: approach.lng },
    approach,
    { lat: to.lat - 0.002, lng: to.lng },
    to,
  ];
}
export function interpolateRoute(points: Point[], progress: number): Point {
  const step = Math.min(1, Math.max(0, progress)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(step));
  const fraction = step - index;
  return {
    lat:
      points[index].lat +
      (points[index + 1].lat - points[index].lat) * fraction,
    lng:
      points[index].lng +
      (points[index + 1].lng - points[index].lng) * fraction,
  };
}
