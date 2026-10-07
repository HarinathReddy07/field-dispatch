export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Dev-only simulated GPS: a straight line of `steps + 1` samples from `from` to `to`.
 * (BUILD_SPEC: GPS is a simulated coordinate stream; no background GPS in the trial.)
 */
export function simulateRoute(from: LatLon, to: LatLon, steps: number): LatLon[] {
  const n = Math.max(1, Math.floor(steps));
  return Array.from({ length: n + 1 }, (_, i) => ({
    lat: from.lat + ((to.lat - from.lat) * i) / n,
    lon: from.lon + ((to.lon - from.lon) * i) / n,
  }));
}

export function haversineKm(a: LatLon, b: LatLon): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Rough arrival estimate for display only (assumes 25 km/h urban speed). */
export function etaMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / 25) * 60));
}

/** Simulated "pick a place" presets (synthetic Bengaluru landmarks). */
export const PLACES: { name: string; location: LatLon }[] = [
  { name: 'MG Road', location: { lat: 12.9748, lon: 77.6033 } },
  { name: 'Indiranagar', location: { lat: 12.9784, lon: 77.6408 } },
  { name: 'Koramangala', location: { lat: 12.9352, lon: 77.6245 } },
  { name: 'Jayanagar', location: { lat: 12.925, lon: 77.5938 } },
  { name: 'Malleshwaram', location: { lat: 13.0035, lon: 77.5646 } },
];
