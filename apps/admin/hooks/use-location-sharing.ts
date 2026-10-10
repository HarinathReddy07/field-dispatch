'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from '@/lib/client';
import { friendlyMessage } from '@/lib/errors';
import type { LatLon } from '@/lib/location';

export type LocationSource = { kind: 'gps' } | { kind: 'place'; name: string; location: LatLon };
export type ShareStatus = 'off' | 'starting' | 'sharing' | 'denied' | 'unsupported' | 'error';

/** Do not send more often than this; the server also throttles and only persists periodically. */
const MIN_INTERVAL_MS = 10_000;
/** A fixed place is re-sent at this interval so the server keeps treating the technician as fresh. */
const PLACE_REPEAT_MS = 20_000;

interface Report {
  key: string;
  status: ShareStatus;
  message?: string;
  last?: LatLon & { at: number };
}

/**
 * Shares the technician's position with the server (`POST technicians/me/location`).
 * "This device" follows the browser's GPS; "a place" repeats a chosen spot, which lets a demo technician stand
 * where the seed data is without leaving the desk. State is derived from the current settings, so switching the
 * switch or the source never shows a stale status.
 */
export function useLocationSharing(enabled: boolean, source: LocationSource) {
  const key = enabled
    ? source.kind === 'gps'
      ? 'gps'
      : `place:${source.location.lat},${source.location.lon}`
    : 'off';
  const [report, setReport] = useState<Report | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (key === 'off') return;
    let cancelled = false;
    const say = (r: Omit<Report, 'key'>) => !cancelled && setReport({ key, ...r });

    const send = async (p: LatLon, force = false) => {
      const now = Date.now();
      if (!force && now - lastSent.current < MIN_INTERVAL_MS) return;
      lastSent.current = now;
      try {
        await api('technicians/me/location', { method: 'POST', body: { lat: p.lat, lon: p.lon } });
        say({ status: 'sharing', last: { ...p, at: Date.now() } });
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) return; // throttled: the next sample will go through
        say({ status: 'error', message: friendlyMessage(e) });
      }
    };

    if (source.kind === 'place') {
      void send(source.location, true);
      const timer = setInterval(() => void send(source.location, true), PLACE_REPEAT_MS);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      const t = setTimeout(() => say({ status: 'unsupported' }), 0);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => void send({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) =>
        say({
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
          message:
            err.code === err.PERMISSION_DENIED
              ? 'Location permission was denied.'
              : 'We couldn’t get a GPS position. Check that location is on and you’re on a secure (HTTPS) connection.',
        }),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watch);
    };
    // `source` is represented by `key`; depending on the object would restart the watch on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (key === 'off') return { status: 'off' as ShareStatus, message: undefined, last: undefined };
  const current = report && report.key === key ? report : null;
  return {
    status: (current?.status ?? 'starting') as ShareStatus,
    message: current?.message,
    last: current?.last,
  };
}
