'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client';

export interface QueryState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** Client clock at the time the data arrived (used with the payload's serverTime for elapsed timers). */
  fetchedAt: number;
  refetch: () => void;
}

interface Snapshot<T> {
  path: string;
  data: T | null;
  error: ApiError | null;
  fetchedAt: number;
}

/** Minimal fetch hook: keeps the previous data visible while refetching (no flicker on live updates). */
export function useQuery<T>(path: string): QueryState<T> {
  const [snap, setSnap] = useState<Snapshot<T>>({ path: '', data: null, error: null, fetchedAt: 0 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true; // a newer request (or unmount) supersedes this one
    api<T>(path)
      .then((data) => alive && setSnap({ path, data, error: null, fetchedAt: Date.now() }))
      .catch((e: unknown) => {
        if (!alive) return;
        const error = e instanceof ApiError ? e : new ApiError(0, 'NETWORK', 'Network error');
        setSnap((s) => ({ ...s, path, error }));
      });
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return {
    data: snap.data,
    error: snap.error,
    loading: snap.path !== path,
    fetchedAt: snap.fetchedAt,
    refetch,
  };
}

/** Re-renders every second so elapsed timers tick; returns the current client time. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
