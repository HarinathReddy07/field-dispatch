'use client';

import { useEffect, useMemo } from 'react';
import type { EvidenceItem } from '@dispatch/contracts';
import { EmptyState } from './ui';

/**
 * Evidence photos grouped by work cycle (optionally only one cycle). Signed URLs are short-lived: an expired or
 * failed image, or the clock reaching the earliest expiry, triggers `onExpired` so the owner can refetch.
 */
export function EvidenceGrid({
  items,
  onExpired,
  onlyCycle,
  emptyHint = 'Photos appear here as soon as the technician finalizes them.',
}: {
  items: EvidenceItem[];
  onExpired: () => void;
  onlyCycle?: number;
  emptyHint?: string;
}) {
  const shown = useMemo(
    () => (onlyCycle === undefined ? items : items.filter((e) => e.workCycle === onlyCycle)),
    [items, onlyCycle],
  );
  const cycles = useMemo(() => {
    const byCycle = new Map<number, EvidenceItem[]>();
    for (const e of shown) byCycle.set(e.workCycle, [...(byCycle.get(e.workCycle) ?? []), e]);
    return [...byCycle.entries()].sort((a, b) => a[0] - b[0]);
  }, [shown]);

  // refetch shortly before the earliest signed URL expires
  useEffect(() => {
    if (items.length === 0) return;
    const soonest = Math.min(...items.map((e) => Date.parse(e.expiresAt)));
    const ms = Math.max(5_000, soonest - Date.now() - 10_000);
    const t = setTimeout(onExpired, ms);
    return () => clearTimeout(t);
  }, [items, onExpired]);

  if (shown.length === 0) return <EmptyState title="No evidence yet" hint={emptyHint} />;
  return (
    <div className="space-y-5">
      {cycles.map(([cycle, list]) => (
        <section key={cycle} aria-label={`Work cycle ${cycle}`}>
          {onlyCycle === undefined && (
            <h3 className="mb-2 text-sm font-semibold">
              Work cycle {cycle} <span className="font-normal text-muted">({list.length} photos)</span>
            </h3>
          )}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {list.map((e, i) => (
              <li key={e.id}>
                <a href={e.url} target="_blank" rel="noreferrer" className="block">
                  {/* short-lived signed URL straight from storage */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={e.url}
                    alt={`Evidence photo ${i + 1}, work cycle ${cycle}`}
                    loading="lazy"
                    onError={onExpired}
                    className="aspect-square w-full rounded-sm border border-line bg-surface-muted object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
