import { validPoint, type Point } from "./domain/navigation";
export type SharedLocation = {
  trip_id: string;
  session_id: string;
  source: "gps" | "simulation";
  sharing_active: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  observed_at: string | null;
  started_at: string;
  updated_at: string;
};
export function googleNavigationUrl(lat: number | null, lng: number | null) {
  if (!validPoint(lat, lng)) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({
    api: "1",
    destination: `${lat},${lng}`,
    travelmode: "driving",
    dir_action: "navigate",
  }).toString();
  return url.toString();
}
export function googlePositionUrl(lat: number | null, lng: number | null) {
  if (!validPoint(lat, lng)) return null;
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${lat},${lng}` })}`;
}
export function distanceMeters(a: Point, b: Point) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function isFreshLocation(
  location: SharedLocation | null | undefined,
  now = Date.now(),
) {
  return Boolean(
    location?.sharing_active &&
      location.observed_at &&
      now - Date.parse(location.observed_at) <= 90_000 &&
      now >= Date.parse(location.observed_at) - 5000,
  );
}
export function isApproaching(
  location: SharedLocation | null | undefined,
  gate: { latitude: number | null; longitude: number | null } | undefined,
  now = Date.now(),
) {
  if (
    !location ||
    !gate ||
    !isFreshLocation(location, now) ||
    !validPoint(location.latitude, location.longitude) ||
    !validPoint(gate.latitude, gate.longitude) ||
    location.accuracy_m === null
  )
    return false;
  return (
    distanceMeters(
      { lat: location.latitude!, lng: location.longitude! },
      { lat: gate.latitude!, lng: gate.longitude! },
    ) +
      location.accuracy_m <=
    5000
  );
}
