/**
 * Source of technician position samples. In the trial the "provider" is the mobile app's simulated
 * GPS (MOCK: no background GPS, no geofencing) posting to POST /technicians/me/location.
 * The interface exists so a real provider can replace it without touching the dispatch domain.
 */
export interface LocationSample {
  lat: number;
  lon: number;
  at: Date;
}

export interface LocationProvider {
  readonly isMock: boolean;
  /** Linear route between two points, used by the simulated GPS playback and tests. */
  route(
    from: { lat: number; lon: number },
    to: { lat: number; lon: number },
    steps: number,
  ): LocationSample[];
}

export class SimulatedLocationProvider implements LocationProvider {
  readonly isMock = true;

  route(
    from: { lat: number; lon: number },
    to: { lat: number; lon: number },
    steps: number,
  ): LocationSample[] {
    const n = Math.max(1, Math.floor(steps));
    const start = Date.now();
    return Array.from({ length: n + 1 }, (_, i) => ({
      lat: from.lat + ((to.lat - from.lat) * i) / n,
      lon: from.lon + ((to.lon - from.lon) * i) / n,
      at: new Date(start + i * 1000),
    }));
  }
}
