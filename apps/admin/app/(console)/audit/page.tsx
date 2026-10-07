'use client';

import { useMemo, useState } from 'react';
import type { AuditResponse } from '@dispatch/contracts';
import { Button, Card, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { useLiveRefresh } from '@/components/live-provider';
import { useQuery } from '@/hooks/use-query';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditPage() {
  const [requestId, setRequestId] = useState('');
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const invalid = (requestId && !UUID.test(requestId)) || (actorId && !UUID.test(actorId));
  const path = useMemo(() => {
    const q = new URLSearchParams({ pageSize: '25', page: String(page) });
    if (requestId && UUID.test(requestId)) q.set('requestId', requestId);
    if (actorId && UUID.test(actorId)) q.set('actorId', actorId);
    if (action.trim()) q.set('action', action.trim());
    return `admin/audit?${q.toString()}`;
  }, [requestId, actorId, action, page]);

  const audit = useQuery<AuditResponse>(path);
  useLiveRefresh(audit.refetch);
  const pages = audit.data ? Math.max(1, Math.ceil(audit.data.total / audit.data.pageSize)) : 1;
  const reset = () => setPage(1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <Card title="Filters">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Job ID', requestId, setRequestId, 'uuid'],
            ['Actor ID', actorId, setActorId, 'uuid'],
            ['Action', action, setAction, 'e.g. request.admin_cancel'],
          ].map(([label, value, set, ph]) => (
            <label key={label as string} className="text-sm">
              <span className="font-medium">{label as string}</span>
              <input
                value={value as string}
                onChange={(e) => {
                  (set as (v: string) => void)(e.target.value);
                  reset();
                }}
                placeholder={ph as string}
                className="mt-1 min-h-10 w-full rounded-md border border-line bg-surface px-2"
              />
            </label>
          ))}
        </div>
        {invalid && (
          <p role="alert" className="mt-2 text-sm text-[var(--tone-bad-ink)]">
            Job and actor IDs must be valid UUIDs; invalid filters are ignored.
          </p>
        )}
      </Card>

      {audit.error && <ErrorState message={audit.error.message} onRetry={audit.refetch} />}
      <Card title={`Entries${audit.data ? ` (${audit.data.total})` : ''}`}>
        {audit.loading && !audit.data ? (
          <TableSkeleton cols={5} />
        ) : (audit.data?.items ?? []).length === 0 ? (
          <EmptyState title="No matching audit entries" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm" data-testid="audit-table">
              <thead className="text-xs uppercase tracking-wide text-soft">
                <tr>
                  <th className="py-2 pr-3">When</th>
                  <th className="pr-3">Action</th>
                  <th className="pr-3">Actor</th>
                  <th className="pr-3">Entity</th>
                  <th className="pr-3">Reason / details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.data!.items.map((a) => (
                  <tr key={a.seq}>
                    <td className="py-2 pr-3 whitespace-nowrap text-soft">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="pr-3 font-mono text-xs">{a.action}</td>
                    <td className="pr-3">{a.actor_role.toLowerCase()}</td>
                    <td className="pr-3 text-xs text-soft">
                      {a.entity_type}
                      <br />
                      <span className="font-mono">{a.entity_id.slice(0, 8)}</span>
                    </td>
                    <td className="pr-3">
                      {typeof a.metadata?.reason === 'string' ? a.metadata.reason : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {audit.data && pages > 1 && (
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-end gap-3 text-sm">
            <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </nav>
        )}
      </Card>
    </div>
  );
}
