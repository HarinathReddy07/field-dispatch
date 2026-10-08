'use client';

import Link from 'next/link';
import type { AdminJobsResponse, AdminSummary, RequestState } from '@dispatch/contracts';
import { stateStyles } from '@dispatch/ui-tokens';
import {
  Card,
  EmptyState,
  ErrorState,
  FlagChip,
  KpiCard,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { useLiveRefresh } from '@/components/live-provider';
import { useQuery } from '@/hooks/use-query';
import { humanize } from '@/lib/format.ts';

const ORDER: RequestState[] = [
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

  const counts = summary.data?.countsByState ?? {};
  const total = ORDER.reduce((n, s) => n + (counts[s] ?? 0), 0);
  const flagged = (jobs.data?.items ?? []).filter((j) => j.exceptionFlags.length > 0);
  const loading = summary.loading && !summary.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations dashboard"
        description="Live view of requests, technicians and exceptions."
      />

      {summary.error && (
        <ErrorState
          message={summary.error.message}
          correlationId={summary.error.correlationId}
          onRetry={summary.refetch}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px]" />)
        ) : (
          <>
            <KpiCard label="Active requests" value={summary.data?.activeRequests ?? 0} />
            <KpiCard label="Active technicians" value={summary.data?.activeTechnicians ?? 0} />
            <KpiCard
              label="Exceptions"
              value={summary.data?.exceptionCount ?? 0}
              danger={(summary.data?.exceptionCount ?? 0) > 0}
            />
            <KpiCard label="Completed today" value={summary.data?.completedToday ?? 0} />
          </>
        )}
      </div>

      <Card title="Jobs by state">
        {loading ? (
          <Skeleton className="h-10" />
        ) : total === 0 ? (
          <EmptyState title="No requests yet" hint="New requests appear here as soon as they are created." />
        ) : (
          <div className="space-y-4">
            <div
              role="img"
              aria-label={`Jobs by state: ${ORDER.filter((s) => counts[s])
                .map((s) => `${counts[s]} ${stateStyles[s].label}`)
                .join(', ')}`}
              className="flex h-3 w-full overflow-hidden rounded-full bg-surface-muted"
            >
              {ORDER.filter((s) => counts[s]).map((s) => (
                <span
                  key={s}
                  title={`${stateStyles[s].label}: ${counts[s]}`}
                  style={{
                    width: `${((counts[s] ?? 0) / total) * 100}%`,
                    backgroundColor: `var(--state-${s.toLowerCase().replace(/_/g, '-')}-text)`,
                  }}
                />
              ))}
            </div>
            <ul
              aria-label="Counts by state"
              className="grid grid-cols-1 gap-x-6 gap-y-2 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
            >
              {ORDER.map((s) => (
                <li key={s} className="flex items-center justify-between gap-2" data-testid={`count-${s}`}>
                  <StatusBadge state={s} />
                  <span className="tabular text-base font-semibold">{counts[s] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card
        title="Needs attention"
        action={
          <Link href="/live" className="text-sm font-medium text-primary hover:underline">
            Open live board
          </Link>
        }
        bodyClassName="p-0"
      >
        {jobs.loading && !jobs.data ? (
          <div className="p-4">
            <Skeleton className="h-16" />
          </div>
        ) : flagged.length === 0 ? (
          <EmptyState
            title="No exceptions"
            hint="Flags appear here when a job stalls, a technician goes quiet or a review is overdue."
          />
        ) : (
          <ul className="divide-y divide-line">
            {flagged.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/live?job=${j.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-muted"
                >
                  <span className="font-medium">{j.assetId}</span>
                  <span className="text-sm text-muted">{humanize(j.category)}</span>
                  <StatusBadge state={j.state} />
                  <span className="flex flex-wrap gap-1">
                    {j.exceptionFlags.map((f) => (
                      <FlagChip key={f} flag={f} />
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
