'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import type { AdminJobItem, AdminJobsResponse } from '@dispatch/contracts';
import { formatMoney } from '@dispatch/ui-tokens';
import { useLiveRefresh } from '@/components/live-provider';
import {
  Badge,
  Button,
  Card,
  CopyButton,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  Input,
  KpiCard,
  Money,
  PageHeader,
  Pagination,
  Skeleton,
  TableSkeleton,
  type Column,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { toCsv } from '@/lib/csv';
import { humanize } from '@/lib/format.ts';

const PAGE_SIZE = 25;

type Row = AdminJobItem & { settlement: NonNullable<AdminJobItem['settlement']> };
const hasSettlement = (j: AdminJobItem): j is Row => j.settlement !== null;

const when = (iso: string) => new Date(iso).toLocaleString();

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Ledger of settled jobs. There is exactly one mock settlement per job (UNIQUE request_id), so the ledger is the
 * settled-jobs list with each job's settlement. Totals cover the page shown; the count covers every settlement.
 */
export default function SettlementsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const jobs = useQuery<AdminJobsResponse>(`admin/jobs?state=SETTLED&page=${page}&pageSize=${PAGE_SIZE}`);
  const { refetch } = jobs;
  useLiveRefresh(refetch, (e) => e.type === 'settlement.created');

  const rows = useMemo(() => (jobs.data?.items ?? []).filter(hasSettlement), [jobs.data]);
  const needle = search.trim().toLowerCase();
  const shown = useMemo(
    () =>
      needle
        ? rows.filter((r) =>
            [r.settlement.providerRef, r.assetId, r.technician?.name ?? ''].some((v) =>
              v.toLowerCase().includes(needle),
            ),
          )
        : rows,
    [rows, needle],
  );
  const pageTotal = rows.reduce((n, r) => n + r.settlement.amountMinor, 0);
  const first = jobs.loading && !jobs.data;

  const columns: Column<Row>[] = [
    {
      key: 'ref',
      header: 'Reference',
      cell: (r) => (
        <span className="inline-flex items-center gap-1">
          <span className="font-mono text-xs">{r.settlement.providerRef}</span>
          <CopyButton value={r.settlement.providerRef} label="Copy reference" compact />
        </span>
      ),
    },
    {
      key: 'asset',
      header: 'Job',
      cell: (r) => (
        <Link href={`/admin/jobs/${r.id}`} className="font-medium text-primary hover:underline">
          {r.assetId}
        </Link>
      ),
    },
    { key: 'tech', header: 'Technician', cell: (r) => r.technician?.name ?? '—' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => <Money minor={r.settlement.amountMinor} />,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge tone={r.settlement.status === 'SETTLED' ? 'success' : 'warning'}>
          {humanize(r.settlement.status)}
        </Badge>
      ),
    },
    { key: 'at', header: 'Settled', cell: (r) => <span className="text-muted">{when(r.updatedAt)}</span> },
  ];

  const exportCsv = () =>
    download(
      `settlements-page-${page}.csv`,
      toCsv([
        ['Reference', 'Job', 'Technician', 'Amount (INR)', 'Status', 'Settled at'],
        ...shown.map((r) => [
          r.settlement.providerRef,
          r.assetId,
          r.technician?.name ?? '',
          (r.settlement.amountMinor / 100).toFixed(2),
          r.settlement.status,
          r.updatedAt,
        ]),
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settlement ledger"
        description="One simulated settlement is recorded per completed job."
        actions={
          <Button
            onClick={exportCsv}
            disabled={shown.length === 0}
            icon={<Download aria-hidden size={16} strokeWidth={1.75} />}
          >
            Export this page (CSV)
          </Button>
        }
      />

      {jobs.error && (
        <ErrorState
          message={jobs.error.message}
          correlationId={jobs.error.correlationId}
          onRetry={jobs.refetch}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {first ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[104px]" />)
        ) : (
          <>
            <KpiCard label="Settlements" value={jobs.data?.total ?? 0} hint="All time" />
            <KpiCard
              label="Amount on this page"
              value={formatMoney(pageTotal)}
              hint={`${rows.length} entries`}
            />
            <KpiCard
              label="Average on this page"
              value={rows.length ? formatMoney(Math.round(pageTotal / rows.length)) : '—'}
            />
          </>
        )}
      </div>

      <Card bodyClassName="p-0">
        <div className="border-b border-line p-4">
          <FilterBar label="Settlement filters" active={search !== ''} onClear={() => setSearch('')}>
            <Input
              label="Search this page"
              placeholder="Reference, job or technician"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:w-72"
            />
          </FilterBar>
        </div>
        {first ? (
          <TableSkeleton rows={6} cols={6} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={search ? 'No settlements match' : 'No settlements yet'}
            hint={
              search
                ? 'Clear the search to see every settlement on this page.'
                : 'A settlement appears here the moment a job is approved.'
            }
          />
        ) : (
          <DataTable
            ariaLabel="Settlements"
            columns={columns}
            rows={shown}
            rowKey={(r) => r.id}
            minWidth={720}
          />
        )}
        {jobs.data && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={jobs.data.total} onPage={setPage} />
        )}
      </Card>
    </div>
  );
}
