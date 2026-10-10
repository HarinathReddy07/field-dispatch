export interface LatLon {
  lat: number;
  lon: number;
}

/** Quick-pick sites (synthetic Bengaluru landmarks, the same ones the seed data and the mobile app use). */
export const PLACES: { name: string; location: LatLon }[] = [
  { name: 'MG Road', location: { lat: 12.9748, lon: 77.6033 } },
  { name: 'Indiranagar', location: { lat: 12.9784, lon: 77.6408 } },
  { name: 'Koramangala', location: { lat: 12.9352, lon: 77.6245 } },
  { name: 'Jayanagar', location: { lat: 12.925, lon: 77.5938 } },
  { name: 'Malleshwaram', location: { lat: 13.0035, lon: 77.5646 } },
];

export const DEFAULT_CENTER: LatLon = PLACES[0]!.location;

export const isValidLatLon = (p: LatLon): boolean =>
  Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/** Coordinates to a short readable string: "12.9748, 77.6033". */
export const formatLatLon = (p: LatLon): string => `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`;

/** A map link that opens the platform's maps app or the browser. */
export const mapsUrl = (p: LatLon): string =>
  `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=16/${p.lat}/${p.lon}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** Date to the value a `datetime-local` input expects, in the browser's local time. */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` value (local time) to an ISO string, or `null` when empty or invalid. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/** Default booking window: starts at the next quarter hour at least an hour away, lasts two hours. */
export function defaultWindow(now: Date): { start: string; end: string } {
  const start = new Date(now.getTime() + 60 * 60_000);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  return { start: toLocalInput(start), end: toLocalInput(end) };
}
