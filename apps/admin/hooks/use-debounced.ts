'use client';

import { useEffect, useState } from 'react';

/** Returns `value` after it has stayed unchanged for `ms`; filters use it so typing does not fire a request per keystroke. */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
