'use client';

import Link from 'next/link';
import type { AdminJobsResponse, AdminSummary } from '@dispatch/contracts';
import { Card, EmptyState, ErrorState, FlagBadge, Skeleton, Stat, StateBadge } from '@/components/ui';
import { useLiveRefresh } from '@/components/live-provider';
import { useQuery } from '@/hooks/use-query';
import { humanize } from '@/lib/format.ts';

const ORDER = [
  'REQUESTED',
  'MATCHED',
  'CONFIRMED',
  'ARRIVED',
  'IN_PROGRESS',
  'PROOF_UPLOADED',
  'UNDER_REVIEW',
  'REWORK',
  'SETTLED',
  'CANCELLED',
];

export default function DashboardPage() {
  const summary = useQuery<AdminSummary>('admin/summary');
  const jobs = useQuery<AdminJobsResponse>('admin/jobs?pageSize=100');
  useLiveRefresh(() => {
    summary.refetch();
    jobs.refetch();
  });

  const flagged = (jobs.data?.items ?? []).filter((j) => j.exceptionFlags.length > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Operations dashboard</h1>

      {summary.error && <ErrorState message={summary.error.message} onRetry={summary.refetch} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.loading && !summary.data ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Stat label="Active requests" value={summary.data?.activeRequests ?? 0} />
            <Stat label="Active technicians" value={summary.data?.activeTechnicians ?? 0} />
            <Stat
              label="Exceptions"
              value={summary.data?.exceptionCount ?? 0}
              tone={summary.data?.exceptionCount ? 'bad' : undefined}
            />
            <Stat label="Settled" value={summary.data?.countsByState.SETTLED ?? 0} />
          </>
        )}
      </div>

      <Card title="Requests by state">
        {summary.loading && !summary.data ? (
          <Skeleton className="h-10" />
        ) : (
          <ul className="flex flex-wrap gap-3" aria-label="Counts by state">
            {ORDER.map((s) => (
              <li key={s} className="flex items-center gap-2" data-testid={`count-${s}`}>
                <StateBadge state={s} />
                <span className="text-lg font-semibold tabular-nums">
                  {summary.data?.countsByState[s as keyof typeof summary.data.countsByState] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Needs attention"
        action={
          <Link href="/jobs" className="text-sm text-brand underline">
            Open live board
          </Link>
        }
      >
        {jobs.loading && !jobs.data ? (
          <Skeleton className="h-16" />
        ) : flagged.length === 0 ? (
          <EmptyState
            title="No exceptions"
            hint="Flags appear here when a job stalls, a technician goes quiet or a review is overdue."
          />
        ) : (
          <ul className="divide-y divide-line">
            {flagged.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-3 py-2">
                <Link href={`/jobs/${j.id}`} className="font-medium underline">
                  {j.assetId}
                </Link>
                <span className="text-sm text-soft">{humanize(j.category)}</span>
                <StateBadge state={j.state} />
                {j.exceptionFlags.map((f) => (
                  <FlagBadge key={f} flag={f} />
                ))}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
