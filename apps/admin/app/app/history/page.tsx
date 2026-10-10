'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { History as HistoryIcon, Receipt } from 'lucide-react';
import type { RequestView } from '@dispatch/contracts';
import { CategoryIcon, categoryLabel } from '@/components/portal/category';
import { ReorderButton } from '@/components/portal/reorder-button';
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  FilterBar,
  Input,
  Money,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 50; // the API returns up to 50 finished jobs per page
type Filter = 'all' | 'done' | 'cancelled';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'done', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function Row({ job }: { job: RequestView }) {
  const cancelled = job.state === 'CANCELLED';
  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <CategoryIcon category={job.category} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="truncate font-semibold">{job.assetId}</h3>
            <StatusBadge state={job.state} />
          </div>
          <p className="text-sm text-muted">
            {categoryLabel(job.category)} · {new Date(job.updatedAt).toLocaleDateString()}
            {job.technician ? ` · ${job.technician.name}` : ''}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-sm">
          {job.settlement ? (
            <>
              Paid <Money minor={job.settlement.amountMinor} />
            </>
          ) : (
            <span className="text-muted">{cancelled ? 'No charge' : 'No payment record'}</span>
          )}
        </span>
        <span className="flex flex-wrap gap-2">
          {!cancelled && (
            <ButtonLink
              href={`/app/requests/${job.id}/receipt`}
              icon={<Receipt aria-hidden size={16} strokeWidth={1.75} />}
            >
              Receipt
            </ButtonLink>
          )}
          <ReorderButton jobId={job.id} />
        </span>
      </div>
    </li>
  );
}

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const history = useQuery<RequestView[]>(`requests/history?page=${page}`);

  const needle = search.trim().toLowerCase();
  const shown = useMemo(
    () =>
      (history.data ?? []).filter(
        (j) =>
          (filter === 'all' || (filter === 'cancelled') === (j.state === 'CANCELLED')) &&
          (!needle || j.assetId.toLowerCase().includes(needle)),
      ),
    [history.data, filter, needle],
  );
  const first = history.loading && !history.data;
  const hasNext = (history.data?.length ?? 0) >= PAGE_SIZE;
  const filtered = filter !== 'all' || needle !== '';

  return (
    <div className="space-y-5">
      <PageHeader title="History" description="Completed and cancelled jobs, receipts and re-orders." />

      <FilterBar
        label="History filters"
        active={filtered}
        onClear={() => {
          setFilter('all');
          setSearch('');
        }}
      >
        <div role="group" aria-label="Show" className="flex gap-1 rounded-md bg-surface-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'min-h-9 rounded-sm px-3 text-sm font-medium transition-colors duration-150',
                filter === f.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input
          label="Search by asset"
          placeholder="Asset ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-60"
        />
      </FilterBar>

      {history.error && !history.data ? (
        <ErrorState
          message={friendlyMessage(history.error)}
          correlationId={correlationOf(history.error)}
          onRetry={history.refetch}
        />
      ) : first ? (
        <div role="status" aria-label="Loading history" className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={HistoryIcon}
            title={filtered ? 'No jobs match these filters' : 'Nothing here yet'}
            hint={
              filtered
                ? 'Clear the filters to see every finished job.'
                : 'Finished jobs and their receipts appear here.'
            }
            action={
              !filtered ? (
                <Link href="/app/new" className="mt-2 text-sm font-medium text-primary hover:underline">
                  Book your first inspection
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((j) => (
            <Row key={j.id} job={j} />
          ))}
        </ul>
      )}

      {(page > 1 || hasNext) && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Newer
          </Button>
          <span className="tabular text-sm text-muted">Page {page}</span>
          <Button disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
            Older
          </Button>
        </nav>
      )}
    </div>
  );
}
