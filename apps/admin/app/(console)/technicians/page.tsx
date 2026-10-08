'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminTechnician } from '@dispatch/contracts';
import {
  AvailabilityPill,
  Card,
  Column,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  TableSkeleton,
} from '@/components/ui';
import { useLiveRefresh } from '@/components/live-provider';
import { useNow, useQuery } from '@/hooks/use-query';
import { humanize, timeAgo } from '@/lib/format.ts';

export default function TechniciansPage() {
  const techs = useQuery<AdminTechnician[]>('admin/technicians');
  const now = useNow(5000);
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('');
  useLiveRefresh(techs.refetch);

  const needle = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      (techs.data ?? []).filter(
        (t) =>
          (!availability || t.availability_status === availability) &&
          (!needle || t.name.toLowerCase().includes(needle)),
      ),
    [techs.data, availability, needle],
  );

  const columns: Column<AdminTechnician>[] = [
    { key: 'name', header: 'Technician', cell: (t) => <span className="font-medium">{t.name}</span> },
    {
      key: 'avail',
      header: 'Availability',
      cell: (t) => <AvailabilityPill status={t.availability_status} />,
    },
    {
      key: 'cats',
      header: 'Categories',
      cell: (t) => <span className="text-muted">{t.service_categories.map(humanize).join(', ')}</span>,
    },
    {
      key: 'job',
      header: 'Current job',
      cell: (t) =>
        t.current_request_id ? (
          <Link
            href={`/live?job=${t.current_request_id}`}
            className="font-medium text-primary hover:underline"
          >
            Open job
          </Link>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'seen',
      header: 'Last seen',
      cell: (t) => (
        <span className={t.fresh ? 'text-muted' : 'font-medium text-danger'}>
          {timeAgo(t.last_seen_at, now)}
          {!t.fresh && t.last_seen_at ? ' · stale' : ''}
        </span>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      cell: (t) => <span className="tabular">{t.rating.toFixed(1)} ★</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Technicians"
        description="Availability, current assignment and last trusted location."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <Input
            label="Search"
            type="search"
            placeholder="Technician name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select label="Availability" value={availability} onChange={(e) => setAvailability(e.target.value)}>
            <option value="">All</option>
            <option value="AVAILABLE">Available</option>
            <option value="BUSY">Busy</option>
            <option value="OFFLINE">Offline</option>
          </Select>
        </div>
      </div>

      {techs.error && (
        <ErrorState
          message={techs.error.message}
          correlationId={techs.error.correlationId}
          onRetry={techs.refetch}
        />
      )}
      <Card bodyClassName="p-0">
        {techs.loading && !techs.data ? (
          <TableSkeleton cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={techs.data && techs.data.length > 0 ? 'No technicians match' : 'No technicians'}
            hint={
              techs.data && techs.data.length > 0 ? 'Clear the search or availability filter.' : undefined
            }
          />
        ) : (
          <DataTable
            ariaLabel="Technicians"
            testId="technicians-table"
            columns={columns}
            rows={rows}
            rowKey={(t) => t.id}
            rowVersion={(t) => `${t.availability_status}:${t.current_request_id ?? ''}`}
            minWidth={720}
          />
        )}
      </Card>
    </div>
  );
}
