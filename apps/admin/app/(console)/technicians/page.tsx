'use client';

import Link from 'next/link';
import type { AdminTechnician } from '@dispatch/contracts';
import { Badge, Card, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { useLiveRefresh } from '@/components/live-provider';
import { useNow, useQuery } from '@/hooks/use-query';
import { humanize, timeAgo } from '@/lib/format.ts';

export default function TechniciansPage() {
  const techs = useQuery<AdminTechnician[]>('admin/technicians');
  const now = useNow(5000);
  useLiveRefresh(techs.refetch);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Technicians</h1>
      {techs.error && <ErrorState message={techs.error.message} onRetry={techs.refetch} />}
      <Card>
        {techs.loading && !techs.data ? (
          <TableSkeleton cols={6} />
        ) : (techs.data ?? []).length === 0 ? (
          <EmptyState title="No technicians" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm" data-testid="technicians-table">
              <thead className="text-xs uppercase tracking-wide text-soft">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="pr-3">Availability</th>
                  <th className="pr-3">Current job</th>
                  <th className="pr-3">Last location</th>
                  <th className="pr-3">Rating</th>
                  <th className="pr-3">Categories</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(techs.data ?? []).map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-3 font-medium">{t.name}</td>
                    <td className="pr-3">
                      <Badge
                        tone={
                          t.availability_status === 'AVAILABLE'
                            ? 'good'
                            : t.availability_status === 'BUSY'
                              ? 'warn'
                              : 'neutral'
                        }
                      >
                        {humanize(t.availability_status)}
                      </Badge>
                    </td>
                    <td className="pr-3">
                      {t.current_request_id ? (
                        <Link href={`/jobs/${t.current_request_id}`} className="underline">
                          Open job
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="pr-3">
                      <span className={t.fresh ? '' : 'text-[var(--tone-bad-ink)]'}>
                        {timeAgo(t.last_seen_at, now)}
                      </span>
                    </td>
                    <td className="pr-3 tabular-nums">{t.rating.toFixed(1)}★</td>
                    <td className="pr-3 text-soft">{t.service_categories.map(humanize).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
