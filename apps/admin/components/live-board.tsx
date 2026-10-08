'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import type { AdminJobItem, AdminJobsResponse, RequestState } from '@dispatch/contracts';
import { formatDistanceKm, stateStyles } from '@dispatch/ui-tokens';
import { useNow, useQuery } from '@/hooks/use-query';
import { haversineKm, humanize, timeAgo } from '@/lib/format.ts';
import { JobDrawer } from './job-drawer';
import { useLiveRefresh } from './live-provider';
import {
  Card,
  Column,
  DataTable,
  ElapsedTimer,
  EmptyState,
  ErrorState,
  FlagChip,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  TableSkeleton,
  Toggle,
} from './ui';

const JobMap = dynamic(() => import('./job-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[420px] w-full" />,
});

const PAGE_SIZE = 50;

/** States an admin can filter by (DRAFT and the transient COMPLETED never appear on the board). */
const FILTER_STATES: RequestState[] = [
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

export function LiveBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get('job');

  const [state, setState] = useState('');
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const qs = `admin/jobs?pageSize=${PAGE_SIZE}&page=${page}${state ? `&state=${state}` : ''}`;
  const jobs = useQuery<AdminJobsResponse>(qs);
  const now = useNow();
  useLiveRefresh(jobs.refetch);

  const needle = search.trim().toLowerCase();
  const items = useMemo(
    () =>
      (jobs.data?.items ?? []).filter(
        (j) =>
          (!exceptionsOnly || j.exceptionFlags.length > 0) &&
          (!needle ||
            j.assetId.toLowerCase().includes(needle) ||
            j.id.toLowerCase().startsWith(needle) ||
            (j.technician?.name.toLowerCase().includes(needle) ?? false)),
      ),
    [jobs.data, exceptionsOnly, needle],
  );

  const open = useCallback(
    (id: string | null) => router.push(id ? `/live?job=${id}` : '/live', { scroll: false }),
    [router],
  );

  const columns: Column<AdminJobItem>[] = [
    {
      key: 'job',
      header: 'Job',
      cell: (j) => (
        <div className="min-w-0">
          <div className="font-medium whitespace-nowrap">{j.assetId}</div>
          <div className="text-xs text-muted">{humanize(j.category)}</div>
          {j.exceptionFlags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {j.exceptionFlags.map((f) => (
                <FlagChip key={f} flag={f} />
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'state',
      header: 'State',
      cell: (j) => (
        <span data-testid={`job-state-${j.assetId}`}>
          <StatusBadge state={j.state} />
        </span>
      ),
    },
    {
      key: 'tech',
      header: 'Technician',
      cell: (j) => (j.technician ? j.technician.name : <span className="text-muted">—</span>),
    },
    {
      key: 'dist',
      header: 'Dist.',
      align: 'right',
      cell: (j) => (
        <span className="tabular whitespace-nowrap">
          {j.technicianLocation ? formatDistanceKm(haversineKm(j.location, j.technicianLocation)) : '—'}
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      cell: (j) => <span className="text-muted">{timeAgo(j.updatedAt, now)}</span>,
    },
    {
      key: 'elapsed',
      header: 'Elapsed',
      align: 'right',
      cell: (j) =>
        j.state === 'IN_PROGRESS' ? (
          <ElapsedTimer startedAt={j.startedAt} serverTime={j.serverTime} fetchedAt={jobs.fetchedAt} />
        ) : (
          '—'
        ),
    },
  ];

  const filtered = state !== '' || exceptionsOnly || needle !== '';

  return (
    <div className="space-y-4">
      <PageHeader title="Live job board" description="Updates arrive in real time; no reload needed." />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <Input
            label="Search"
            type="search"
            placeholder="Asset, technician or job id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            label="State"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All states</option>
            {FILTER_STATES.map((s) => (
              <option key={s} value={s}>
                {stateStyles[s].label}
              </option>
            ))}
          </Select>
        </div>
        <Toggle label="Exceptions only" checked={exceptionsOnly} onChange={setExceptionsOnly} />
      </div>

      {jobs.error && (
        <ErrorState
          message={jobs.error.message}
          correlationId={jobs.error.correlationId}
          onRetry={jobs.refetch}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card
          bodyClassName="p-0"
          title={`Jobs${jobs.data ? ` (${filtered ? `${items.length} of ` : ''}${jobs.data.total})` : ''}`}
        >
          {jobs.loading && !jobs.data ? (
            <TableSkeleton cols={6} rows={8} />
          ) : items.length === 0 ? (
            <EmptyState
              title={filtered ? 'No jobs match these filters' : 'No jobs yet'}
              hint={
                filtered
                  ? 'Clear the search or filters to see every job.'
                  : 'New requests appear here the moment they are created.'
              }
            />
          ) : (
            <DataTable
              ariaLabel="Jobs"
              testId="jobs-table"
              columns={columns}
              rows={items}
              rowKey={(j) => j.id}
              rowVersion={(j) => `${j.version}:${j.state}:${j.technician?.id ?? ''}`}
              rowTestId={(j) => `job-row-${j.assetId}`}
              selectedKey={selected}
              onRowClick={(j) => open(j.id)}
              minWidth={640}
              maxHeight="calc(100vh - 20rem)"
            />
          )}
          {jobs.data && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={jobs.data.total} onPage={setPage} />
          )}
        </Card>

        <Card title="Map" className="lg:sticky lg:top-20 lg:self-start" bodyClassName="h-[460px] p-2">
          <JobMap jobs={items} selectedId={selected} onSelect={open} />
        </Card>
      </div>

      {selected && <JobDrawer key={selected} id={selected} onClose={() => open(null)} />}
    </div>
  );
}
