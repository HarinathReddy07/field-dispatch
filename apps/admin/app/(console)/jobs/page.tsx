'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import type { AdminJobsResponse } from '@dispatch/contracts';
import { Card, EmptyState, ErrorState, FlagBadge, StateBadge, TableSkeleton } from '@/components/ui';
import { useLiveRefresh } from '@/components/live-provider';
import { useNow, useQuery } from '@/hooks/use-query';
import { elapsedSeconds, formatDuration, formatMoney, haversineKm, humanize, timeAgo } from '@/lib/format.ts';

const JobMap = dynamic(() => import('@/components/job-map'), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-lg bg-[var(--tone-neutral-bg)]" />,
});

const STATES = [
  '',
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

export default function JobsPage() {
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const qs = `admin/jobs?pageSize=25&page=${page}${state ? `&state=${state}` : ''}`;
  const jobs = useQuery<AdminJobsResponse>(qs);
  const now = useNow();
  useLiveRefresh(jobs.refetch);

  const items = jobs.data?.items ?? [];
  const pages = jobs.data ? Math.max(1, Math.ceil(jobs.data.total / jobs.data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Live jobs</h1>
        <label className="flex items-center gap-2 text-sm">
          State
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
            className="min-h-9 rounded-md border border-line bg-surface px-2"
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s ? humanize(s) : 'All'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {jobs.error && <ErrorState message={jobs.error.message} onRetry={jobs.refetch} />}

      <Card title="Map">
        <JobMap jobs={items} selectedId={selected} onSelect={setSelected} />
      </Card>

      <Card title={`Jobs${jobs.data ? ` (${jobs.data.total})` : ''}`}>
        {jobs.loading && !jobs.data ? (
          <TableSkeleton cols={7} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No jobs in this view"
            hint="New requests appear here the moment they are created."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm" data-testid="jobs-table">
              <thead className="text-xs uppercase tracking-wide text-soft">
                <tr>
                  <th className="py-2 pr-3">Request</th>
                  <th className="pr-3">Technician</th>
                  <th className="pr-3">Distance</th>
                  <th className="pr-3">State</th>
                  <th className="pr-3">Last update</th>
                  <th className="pr-3">Elapsed</th>
                  <th className="pr-3">Quote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((j) => {
                  const dist = j.technicianLocation ? haversineKm(j.location, j.technicianLocation) : null;
                  return (
                    <tr
                      key={j.id}
                      data-testid={`job-row-${j.assetId}`}
                      onClick={() => setSelected(j.id)}
                      className={j.id === selected ? 'bg-muted' : undefined}
                    >
                      <td className="py-2 pr-3">
                        <Link href={`/jobs/${j.id}`} className="font-medium underline">
                          {j.assetId}
                        </Link>
                        <div className="text-xs text-soft">{humanize(j.category)}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {j.exceptionFlags.map((f) => (
                            <FlagBadge key={f} flag={f} />
                          ))}
                        </div>
                      </td>
                      <td className="pr-3">
                        {j.technician ? `${j.technician.name} (${j.technician.rating.toFixed(1)}★)` : '—'}
                      </td>
                      <td className="pr-3 tabular-nums">{dist !== null ? `${dist.toFixed(1)} km` : '—'}</td>
                      <td className="pr-3" data-testid={`job-state-${j.assetId}`}>
                        <StateBadge state={j.state} />
                      </td>
                      <td className="pr-3 text-soft">{timeAgo(j.updatedAt, now)}</td>
                      <td className="pr-3 tabular-nums">
                        {j.state === 'IN_PROGRESS'
                          ? formatDuration(elapsedSeconds(j.startedAt, j.serverTime, jobs.fetchedAt, now))
                          : '—'}
                      </td>
                      <td className="pr-3 tabular-nums">{formatMoney(j.quoteMinor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {jobs.data && pages > 1 && (
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-end gap-3 text-sm">
            <button
              className="rounded-md border border-line px-3 py-1 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              className="rounded-md border border-line px-3 py-1 disabled:opacity-40"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </Card>
    </div>
  );
}
