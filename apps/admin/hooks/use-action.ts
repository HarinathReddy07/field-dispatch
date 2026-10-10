'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { uuid } from '@/lib/ids';
import { outcomeUnknown } from '@/lib/errors';

export interface ActionState<A extends unknown[], T> {
  /** Runs the action once at a time. Resolves with the result, or `undefined` when it failed (see `error`). */
  run: (...args: A) => Promise<T | undefined>;
  busy: boolean;
  error: unknown;
  reset: () => void;
}

/**
 * One user action that talks to the API, with a stable Idempotency-Key per intent.
 * If the outcome is unknown (network error or 5xx), the NEXT attempt reuses the same key, so the server replays the
 * original result instead of repeating the action. The key is dropped after success or a definite rejection.
 * While busy, further calls are ignored, so a double click can never submit twice.
 */
export function useAction<A extends unknown[], T>(
  fn: (key: string, ...args: A) => Promise<T>,
): ActionState<A, T> {
  const key = useRef<string | null>(null);
  const inFlight = useRef(false);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = useCallback(async (...args: A): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    key.current ??= uuid();
    try {
      const result = await fnRef.current(key.current, ...args);
      key.current = null;
      return result;
    } catch (e) {
      if (!outcomeUnknown(e)) key.current = null;
      setError(e);
      return undefined;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);
  return { run, busy, error, reset };
}
