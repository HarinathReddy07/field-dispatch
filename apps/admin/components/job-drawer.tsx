'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AdminJobDetail, AdminTechnician } from '@dispatch/contracts';
import { ApiError, api } from '@/lib/client';
import { useNow, useQuery } from '@/hooks/use-query';
import { TERMINAL, humanize, timeAgo } from '@/lib/format.ts';
import { EvidenceGrid } from './evidence-grid';
import { useLiveRefresh } from './live-provider';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  Drawer,
  ElapsedTimer,
  EmptyState,
  ErrorState,
  FlagChip,
  KeyValueRow,
  Money,
  PageHeader,
  Select,
  Skeleton,
  StateStepper,
  StatusBadge,
  TabPanel,
  Tabs,
  useToast,
} from './ui';

type Action = 'cancel' | 'reassign' | null;
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'audit', label: 'Audit' },
];

const when = (iso: string) => new Date(iso).toLocaleString();

function ActionError({ error }: { error: ApiError | Error }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {error.message}
      {error instanceof ApiError && error.correlationId && (
        <CopyButton value={error.correlationId} label="Copy details" />
      )}
    </span>
  );
}

type FrameProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** Full-page frame with the same props as Drawer, so the job detail renders in either. */
function PageFrame({ title, subtitle, children, footer }: FrameProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={typeof title === 'string' ? title : 'Job'}
        breadcrumbs={[{ label: 'Live board', href: '/admin/live' }, { label: 'Job details' }]}
        actions={footer ? <div className="flex flex-wrap gap-2">{footer}</div> : undefined}
      />
      {subtitle}
      <Card bodyClassName="p-0">{children}</Card>
    </div>
  );
}

/** Job detail for admins: a right-hand drawer on the live board, or a shareable full page (mode="page"). */
export function JobDrawer({
  id,
  onClose = () => undefined,
  mode = 'drawer',
}: {
  id: string;
  onClose?: () => void;
  mode?: 'drawer' | 'page';
}) {
  const detail = useQuery<AdminJobDetail>(`admin/jobs/${id}`);
  const techs = useQuery<AdminTechnician[]>('admin/technicians');
  const now = useNow(5000);
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [action, setAction] = useState<Action>(null);
  const [technicianId, setTechnicianId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { refetch: refetchDetail } = detail;
  const { refetch: refetchTechs } = techs;
  useLiveRefresh(
    () => {
      refetchDetail();
      refetchTechs();
    },
    (e) => e.requestId === id,
  );

  const close = () => {
    setAction(null);
    setError(null);
    setTechnicianId('');
  };

  const d = detail.data;
  const job = d?.job;
  const open = job ? !TERMINAL.has(job.state) : false;
  const reassignable = job ? ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'REWORK'].includes(job.state) : false;
  const candidates = (techs.data ?? []).filter(
    (t) =>
      job &&
      t.availability_status === 'AVAILABLE' &&
      t.service_categories.includes(job.category) &&
      t.id !== job.technician?.id,
  );

  const confirm = async (reason: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'cancel') await api(`admin/jobs/${id}/cancel`, { method: 'POST', body: { reason } });
      else await api(`admin/jobs/${id}/reassign`, { method: 'POST', body: { technicianId, reason } });
      toast.success(
        action === 'cancel' ? 'Job cancelled' : 'Technician reassigned',
        'Recorded in the audit log.',
      );
      close();
      refetchDetail();
      refetchTechs();
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const footer =
    job && open ? (
      <>
        {reassignable && <Button onClick={() => setAction('reassign')}>Reassign…</Button>}
        <Button variant="danger" onClick={() => setAction('cancel')}>
          Cancel job…
        </Button>
      </>
    ) : undefined;

  const Frame = mode === 'page' ? PageFrame : Drawer;
  const fullPageLink =
    mode === 'drawer' && job ? (
      <Link
        href={`/admin/jobs/${id}`}
        className="mr-auto inline-flex min-h-9 items-center rounded-sm px-2 text-sm font-medium text-primary hover:underline"
      >
        Open full page
      </Link>
    ) : null;

  return (
    <Frame
      title={job ? `${job.assetId}` : 'Job'}
      subtitle={
        job ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge state={job.state} />
              <span className="text-sm text-muted">{humanize(job.category)}</span>
              {job.exceptionFlags.map((f) => (
                <FlagChip key={f} flag={f} />
              ))}
            </div>
            <StateStepper state={job.state} />
          </div>
        ) : undefined
      }
      onClose={onClose}
      footer={
        fullPageLink || footer ? (
          <>
            {fullPageLink}
            {footer}
          </>
        ) : undefined
      }
    >
      {detail.loading && !d ? (
        <div className="space-y-3 p-5" role="status" aria-label="Loading job">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
        </div>
      ) : detail.error && !d ? (
        <div className="p-5">
          {detail.error.status === 404 ? (
            <EmptyState title="Job not found" hint="It may have been removed or the link is wrong." />
          ) : (
            <ErrorState
              message={detail.error.message}
              correlationId={detail.error.correlationId}
              onRetry={detail.refetch}
            />
          )}
        </div>
      ) : d && job ? (
        <>
          <Tabs tabs={TABS} value={tab} onChange={setTab} label="Job sections" />

          <TabPanel id="overview" value={tab}>
            <dl className="divide-y divide-line">
              <KeyValueRow label="Technician">
                {job.technician ? `${job.technician.name} · ${job.technician.rating.toFixed(1)} ★` : '—'}
              </KeyValueRow>
              <KeyValueRow label="Quote">
                <Money minor={job.quoteMinor} />
              </KeyValueRow>
              <KeyValueRow label="Elapsed">
                {job.state === 'IN_PROGRESS' ? (
                  <ElapsedTimer
                    startedAt={job.startedAt}
                    serverTime={job.serverTime}
                    fetchedAt={detail.fetchedAt}
                  />
                ) : (
                  '—'
                )}
              </KeyValueRow>
              <KeyValueRow label="Window">
                {when(job.windowStart)} – {new Date(job.windowEnd).toLocaleTimeString()}
              </KeyValueRow>
              <KeyValueRow label="Last seen">
                {timeAgo(job.technicianLocation?.lastSeenAt ?? null, now)}
              </KeyValueRow>
              <KeyValueRow label="Review deadline">
                {job.reviewDeadlineAt ? new Date(job.reviewDeadlineAt).toLocaleTimeString() : '—'}
              </KeyValueRow>
              <KeyValueRow label="Notes">{job.notes ?? '—'}</KeyValueRow>
              <KeyValueRow label="Version" mono>
                v{job.version} · work cycle {job.workCycle}
              </KeyValueRow>
            </dl>

            <h3 className="mt-5 mb-2 text-sm font-semibold">Assignments</h3>
            {d.assignments.length === 0 ? (
              <p className="text-sm text-muted">No assignments yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {d.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.technician_name}</span>
                    <Badge tone={a.status === 'ACTIVE' ? 'info' : 'neutral'}>{humanize(a.status)}</Badge>
                    <Money minor={a.quote_minor} className="text-muted" />
                    {a.end_reason && <span className="text-muted italic">“{a.end_reason}”</span>}
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>

          <TabPanel id="timeline" value={tab}>
            {d.events.length === 0 ? (
              <EmptyState title="No events yet" />
            ) : (
              <ol className="space-y-4 border-l border-line pl-4">
                {d.events.map((e) => (
                  <li key={e.seq} className="relative text-sm">
                    <span
                      aria-hidden
                      className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-primary"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {e.state_from ? (
                        <StatusBadge state={e.state_from} />
                      ) : (
                        <span className="text-muted">start</span>
                      )}
                      <span aria-hidden className="text-muted">
                        →
                      </span>
                      <StatusBadge state={e.state_to} />
                    </div>
                    <p className="mt-1 text-muted">
                      {humanize(e.action)} by {humanize(e.actor_role)} · {when(e.occurred_at)}
                    </p>
                    {e.reason && <p className="mt-0.5 italic">“{e.reason}”</p>}
                  </li>
                ))}
              </ol>
            )}
          </TabPanel>

          <TabPanel id="evidence" value={tab}>
            <EvidenceGrid items={d.evidence} onExpired={refetchDetail} />
          </TabPanel>

          <TabPanel id="settlement" value={tab}>
            {job.settlement ? (
              <div data-testid="settlement">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Mock settlement</p>
                <dl className="divide-y divide-line">
                  <KeyValueRow label="Amount">
                    <Money minor={job.settlement.amountMinor} />
                  </KeyValueRow>
                  <KeyValueRow label="Status">
                    <Badge tone="success">{humanize(job.settlement.status)}</Badge>
                  </KeyValueRow>
                  <KeyValueRow label="Reference" mono>
                    {job.settlement.providerRef}
                  </KeyValueRow>
                </dl>
              </div>
            ) : (
              <EmptyState
                title="Not settled yet"
                hint="Exactly one mock ledger entry is created when the job completes."
              />
            )}
          </TabPanel>

          <TabPanel id="audit" value={tab}>
            {d.audit.length === 0 ? (
              <EmptyState title="No audit entries" />
            ) : (
              <ul className="space-y-3 text-sm">
                {d.audit.map((a) => (
                  <li key={a.seq}>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-mono text-xs font-medium">{a.action}</span>
                      <span className="text-muted">{humanize(a.actor_role)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      {when(a.created_at)}
                      {a.correlation_id && (
                        <>
                          <span className="font-mono">{a.correlation_id.slice(0, 8)}</span>
                          <CopyButton value={a.correlation_id} label="Copy correlation id" compact />
                        </>
                      )}
                    </div>
                    {typeof a.metadata?.reason === 'string' && (
                      <p className="mt-0.5 italic">“{a.metadata.reason}”</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>
        </>
      ) : null}

      {action === 'cancel' && (
        <ConfirmDialog
          title="Cancel this job?"
          description="The technician is released and everyone involved is notified. This cannot be undone."
          confirmLabel="Cancel job"
          danger
          busy={busy}
          error={error && <ActionError error={error} />}
          onConfirm={confirm}
          onClose={close}
        />
      )}
      {action === 'reassign' && (
        <ConfirmDialog
          title="Reassign technician"
          description="The current technician is replaced; the previous arrival code stops working."
          confirmLabel="Reassign"
          busy={busy}
          error={error && <ActionError error={error} />}
          confirmDisabled={!technicianId}
          onConfirm={confirm}
          onClose={close}
        >
          <Select
            label="New technician"
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            hint={candidates.length === 0 ? 'No other available technician covers this category.' : undefined}
          >
            <option value="">Select…</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.rating.toFixed(1)} ★
              </option>
            ))}
          </Select>
        </ConfirmDialog>
      )}
    </Frame>
  );
}
