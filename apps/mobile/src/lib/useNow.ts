import { useEffect, useState } from 'react';

/** Ticks once per interval so timers re-render; returns the (client) clock, to be combined with the SERVER offset. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
