'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AdminJobDetail, AdminTechnician } from '@dispatch/contracts';
import { api, ApiError } from '@/lib/client';
import { useNow, useQuery } from '@/hooks/use-query';
import { elapsedSeconds, formatDuration, formatMoney, humanize, TERMINAL, timeAgo } from '@/lib/format.ts';
import { useLiveRefresh } from './live-provider';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FlagBadge,
  ReasonDialog,
  Skeleton,
  StateBadge,
} from './ui';

type Action = 'cancel' | 'reassign' | null;

export function JobDetail({ id }: { id: string }) {
  const detail = useQuery<AdminJobDetail>(`admin/jobs/${id}`);
  const techs = useQuery<AdminTechnician[]>('admin/technicians');
  const now = useNow();
  const [action, setAction] = useState<Action>(null);
  const [technicianId, setTechnicianId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useLiveRefresh(
    () => {
      detail.refetch();
      techs.refetch();
    },
    (e) => e.requestId === id,
  );

  if (detail.loading && !detail.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (detail.error && !detail.data) {
    return detail.error.status === 404 ? (
      <EmptyState title="Job not found" hint="It may have been removed or the link is wrong." />
    ) : (
      <ErrorState message={detail.error.message} onRetry={detail.refetch} />
    );
  }
  const d = detail.data!;
  const job = d.job;
  const open = !TERMINAL.has(job.state);
  const reassignable = ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'REWORK'].includes(job.state);
  const candidates = (techs.data ?? []).filter(
    (t) =>
      t.availability_status === 'AVAILABLE' &&
      t.service_categories.includes(job.category) &&
      t.id !== job.technician?.id,
  );

  const close = () => {
    setAction(null);
    setError(null);
    setTechnicianId('');
  };

  const confirm = async (reason: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'cancel') await api(`admin/jobs/${id}/cancel`, { method: 'POST', body: { reason } });
      else await api(`admin/jobs/${id}/reassign`, { method: 'POST', body: { technicianId, reason } });
      setNotice(
        action === 'cancel'
          ? 'Job cancelled. The change is recorded in the audit log.'
          : 'Technician reassigned. The change is recorded in the audit log.',
      );
      close();
      detail.refetch();
      techs.refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const seconds =
    job.state === 'IN_PROGRESS' ? elapsedSeconds(job.startedAt, job.serverTime, detail.fetchedAt, now) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/jobs" className="text-sm text-soft underline">
            ← Live jobs
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {job.assetId} <span className="text-base font-normal text-soft">{humanize(job.category)}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StateBadge state={job.state} />
            {job.exceptionFlags.map((f) => (
              <FlagBadge key={f} flag={f} />
            ))}
            {seconds !== null && <Badge tone="warn">Working {formatDuration(seconds)}</Badge>}
            <span className="text-sm text-soft">
              v{job.version} · cycle {job.workCycle}
            </span>
          </div>
        </div>
        {open && (
          <div className="flex gap-2">
            {reassignable && <Button onClick={() => setAction('reassign')}>Reassign…</Button>}
            <Button variant="danger" onClick={() => setAction('cancel')}>
              Cancel job…
            </Button>
          </div>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-lg bg-[var(--tone-good-bg)] px-4 py-2 text-sm text-[var(--tone-good-ink)]"
        >
          {notice}
        </p>
      )}
      {detail.error && <ErrorState message={detail.error.message} onRetry={detail.refetch} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Summary">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-soft">Technician</dt>
            <dd>{job.technician ? `${job.technician.name} (${job.technician.rating.toFixed(1)}★)` : '—'}</dd>
            <dt className="text-soft">Quote</dt>
            <dd>{formatMoney(job.quoteMinor)}</dd>
            <dt className="text-soft">Window</dt>
            <dd>
              {new Date(job.windowStart).toLocaleString()} – {new Date(job.windowEnd).toLocaleTimeString()}
            </dd>
            <dt className="text-soft">Technician seen</dt>
            <dd>{timeAgo(job.technicianLocation?.lastSeenAt ?? null, now)}</dd>
            <dt className="text-soft">Review deadline</dt>
            <dd>{job.reviewDeadlineAt ? new Date(job.reviewDeadlineAt).toLocaleTimeString() : '—'}</dd>
            <dt className="text-soft">Notes</dt>
            <dd>{job.notes ?? '—'}</dd>
          </dl>
        </Card>

        <Card title="Settlement">
          {job.settlement ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm" data-testid="settlement">
              <dt className="text-soft">Amount</dt>
              <dd>{formatMoney(job.settlement.amountMinor)}</dd>
              <dt className="text-soft">Status</dt>
              <dd>
                <Badge tone="good">{humanize(job.settlement.status)}</Badge>
              </dd>
              <dt className="text-soft">Reference</dt>
              <dd className="font-mono text-xs">{job.settlement.providerRef}</dd>
            </dl>
          ) : (
            <EmptyState
              title="Not settled yet"
              hint="One mock ledger entry is created when the job completes."
            />
          )}
        </Card>

        <Card title={`Evidence (${d.evidence.length})`}>
          {d.evidence.length === 0 ? (
            <EmptyState title="No evidence yet" />
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {d.evidence.map((e) => (
                <li key={e.id}>
                  {/* short-lived signed URL straight from storage; may be unreachable offline */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={e.url}
                    alt={`Evidence from cycle ${e.workCycle}`}
                    className="aspect-square w-full rounded-md border border-line object-cover"
                  />
                  <p className="mt-1 text-center text-xs text-soft">cycle {e.workCycle}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="State history">
        <ol className="space-y-2 text-sm">
          {d.events.map((e) => (
            <li key={e.seq} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-xs text-soft">{new Date(e.occurred_at).toLocaleTimeString()}</span>
              {e.state_from ? <StateBadge state={e.state_from} /> : <span className="text-soft">start</span>}
              <span aria-hidden>→</span>
              <StateBadge state={e.state_to} />
              <span className="text-soft">
                {humanize(e.action)} by {humanize(e.actor_role)}
              </span>
              {e.reason && <span className="italic">“{e.reason}”</span>}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Assignments">
          {d.assignments.length === 0 ? (
            <EmptyState title="No assignments" />
          ) : (
            <ul className="space-y-2 text-sm">
              {d.assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.technician_name}</span>
                  <Badge tone={a.status === 'ACTIVE' ? 'info' : 'neutral'}>{humanize(a.status)}</Badge>
                  <span className="text-soft">{formatMoney(a.quote_minor)}</span>
                  {a.end_reason && <span className="italic text-soft">“{a.end_reason}”</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Audit trail">
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {d.audit.map((a) => (
              <li key={a.seq} className="flex flex-wrap gap-x-2">
                <span className="text-xs text-soft">{new Date(a.created_at).toLocaleTimeString()}</span>
                <span className="font-mono text-xs">{a.action}</span>
                <span className="text-soft">{humanize(a.actor_role)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {action === 'cancel' && (
        <ReasonDialog
          title="Cancel this job?"
          description="The technician is released and everyone involved is notified. This cannot be undone."
          confirmLabel="Cancel job"
          danger
          busy={busy}
          error={error}
          onConfirm={confirm}
          onClose={close}
        />
      )}
      {action === 'reassign' && (
        <ReasonDialog
          title="Reassign technician"
          description="The current technician is replaced; the previous arrival code stops working."
          confirmLabel="Reassign"
          busy={busy}
          error={error}
          onConfirm={(r) => (technicianId ? void confirm(r) : setError('Choose a technician first'))}
          onClose={close}
        >
          <label className="block text-sm font-medium" htmlFor="tech">
            New technician
          </label>
          <select
            id="tech"
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            className="min-h-10 w-full rounded-md border border-line bg-surface px-2 text-sm"
          >
            <option value="">Select…</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.rating.toFixed(1)}★
              </option>
            ))}
          </select>
          {candidates.length === 0 && (
            <p className="text-sm text-soft">No other available technician covers this category.</p>
          )}
        </ReasonDialog>
      )}
    </div>
  );
}
