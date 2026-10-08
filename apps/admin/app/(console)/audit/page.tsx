'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AuditResponse, AuditRow } from '@dispatch/contracts';
import {
  Button,
  Card,
  Column,
  CopyButton,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  TableSkeleton,
} from '@/components/ui';
import { useLiveRefresh } from '@/components/live-provider';
import { useQuery } from '@/hooks/use-query';
import { useDebounced } from '@/hooks/use-debounced';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 25;

export default function AuditPage() {
  const [requestId, setRequestId] = useState('');
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);

  // typing in a filter box must not fire a request per keystroke
  const f = useDebounced({ requestId, actorId, action }, 300);
  const idError = (v: string) => (v && !UUID.test(v) ? 'Must be a valid UUID; ignored until it is.' : null);

  const path = useMemo(() => {
    const q = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(page) });
    if (f.requestId && UUID.test(f.requestId)) q.set('requestId', f.requestId);
    if (f.actorId && UUID.test(f.actorId)) q.set('actorId', f.actorId);
    if (f.action.trim()) q.set('action', f.action.trim());
    return `admin/audit?${q.toString()}`;
  }, [f, page]);

  const audit = useQuery<AuditResponse>(path);
  useLiveRefresh(audit.refetch);

  const columns: Column<AuditRow>[] = [
    {
      key: 'expand',
      header: '',
      className: 'w-8',
      cell: (a) => (
        <Button
          variant="ghost"
          aria-label={open === a.seq ? 'Hide details' : 'Show details'}
          aria-expanded={open === a.seq}
          onClick={() => setOpen(open === a.seq ? null : a.seq)}
          className="!min-h-7 !px-1"
        >
          {open === a.seq ? (
            <ChevronDown aria-hidden size={16} strokeWidth={1.75} />
          ) : (
            <ChevronRight aria-hidden size={16} strokeWidth={1.75} />
          )}
        </Button>
      ),
    },
    {
      key: 'when',
      header: 'Time',
      cell: (a) => (
        <span className="tabular whitespace-nowrap text-muted">
          {new Date(a.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      cell: (a) => <span className="font-mono text-xs font-medium">{a.action}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      cell: (a) => <span className="capitalize">{a.actor_role.toLowerCase()}</span>,
    },
    {
      key: 'entity',
      header: 'Entity',
      cell: (a) => (
        <span className="text-xs text-muted">
          {a.entity_type} <span className="font-mono">{a.entity_id.slice(0, 8)}</span>
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (a) => (typeof a.metadata?.reason === 'string' ? a.metadata.reason : ''),
    },
    {
      key: 'corr',
      header: 'Correlation',
      cell: (a) =>
        a.correlation_id ? (
          <span className="flex items-center gap-1">
            <span className="font-mono text-xs text-muted">{a.correlation_id.slice(0, 8)}</span>
            <CopyButton value={a.correlation_id} label="Copy correlation id" compact />
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  const items = audit.data?.items ?? [];
  const expanded = items.find((a) => a.seq === open);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        description="Append-only record of every state change and privileged action."
      />

      <Card title="Filters">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Job ID"
            value={requestId}
            placeholder="uuid"
            error={idError(requestId)}
            onChange={(e) => {
              setRequestId(e.target.value.trim());
              setPage(1);
            }}
          />
          <Input
            label="Actor ID"
            value={actorId}
            placeholder="uuid"
            error={idError(actorId)}
            onChange={(e) => {
              setActorId(e.target.value.trim());
              setPage(1);
            }}
          />
          <Input
            label="Action"
            value={action}
            placeholder="e.g. request.admin_cancel"
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </Card>

      {audit.error && (
        <ErrorState
          message={audit.error.message}
          correlationId={audit.error.correlationId}
          onRetry={audit.refetch}
        />
      )}
      <Card title={`Entries${audit.data ? ` (${audit.data.total})` : ''}`} bodyClassName="p-0">
        {audit.loading && !audit.data ? (
          <TableSkeleton cols={6} />
        ) : items.length === 0 ? (
          <EmptyState title="No matching audit entries" hint="Try a different job, actor or action." />
        ) : (
          <DataTable
            ariaLabel="Audit entries"
            testId="audit-table"
            columns={columns}
            rows={items}
            rowKey={(a) => String(a.seq)}
            selectedKey={open === null ? null : String(open)}
            minWidth={900}
          />
        )}
        {expanded && (
          <div className="border-t border-line bg-surface-muted px-4 py-3">
            <p className="mb-1 text-xs font-medium text-muted">Metadata (read-only)</p>
            <pre className="max-h-60 overflow-auto font-mono text-xs whitespace-pre-wrap">
              {JSON.stringify(expanded.metadata, null, 2)}
            </pre>
          </div>
        )}
        {audit.data && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={audit.data.total} onPage={setPage} />
        )}
      </Card>
    </div>
  );
}
