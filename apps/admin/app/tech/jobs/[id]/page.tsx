'use client';

import { useParams } from 'next/navigation';
import { Ban, CheckCircle2, Hourglass, MessageSquareWarning, Navigation } from 'lucide-react';
import { isFinishedState, jobActionsFor, roleHeadline, stateStyles } from '@dispatch/ui-tokens';
import { CategoryIcon, categoryLabel } from '@/components/portal/category';
import { SiteMap } from '@/components/portal/site-map-loader';
import { WorkTimerCard } from '@/components/portal/requester-job';
import { ArrivalPanel, EvidencePanel, StartPanel } from '@/components/portal/technician-job';
import { Timeline } from '@/components/portal/timeline';
import { EvidenceGrid } from '@/components/evidence-grid';
import {
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  KeyValueRow,
  Money,
  PageHeader,
  Skeleton,
  StateStepper,
  StatusBadge,
} from '@/components/ui';
import { useNow } from '@/hooks/use-query';
import { useEvidence, useRequestEvents, useRequestView } from '@/hooks/use-request';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { formatLatLon, mapsUrl } from '@/lib/location';
import { clock, secondsUntilServer } from '@/lib/portal';

export default function TechnicianJobPage() {
  const { id } = useParams<{ id: string }>();
  const request = useRequestView(id);
  const events = useRequestEvents(id);
  const job = request.data;
  const now = useNow();
  const showEvidence = job
    ? ['UNDER_REVIEW', 'PROOF_UPLOADED', 'SETTLED', 'COMPLETED'].includes(job.state)
    : false;
  const evidence = useEvidence(id, showEvidence);

  if (request.error && !job) {
    return (
      <div className="rounded-lg border border-line bg-surface">
        {request.error.status === 404 ? (
          // 404 is also what a job you were removed from looks like (reassigned, released or cancelled)
          <EmptyState
            title="This job is no longer available"
            hint="It may have been reassigned, released or cancelled. Your current jobs are on the jobs page."
            action={
              <ButtonLink href="/tech" variant="primary" className="mt-2">
                Back to my jobs
              </ButtonLink>
            }
          />
        ) : (
          <ErrorState
            message={friendlyMessage(request.error)}
            correlationId={correlationOf(request.error)}
            onRetry={request.refetch}
          />
        )}
      </div>
    );
  }
  if (!job) {
    return (
      <div role="status" aria-label="Loading job" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const sc = { serverTime: job.serverTime, fetchedAt: request.fetchedAt };
  const actions = jobActionsFor('TECHNICIAN', job.state);
  const headline = roleHeadline('TECHNICIAN', job.state) ?? stateStyles[job.state].label;
  const refresh = () => {
    request.refetch();
    events.refetch();
  };
  const reworkReason = [...(events.data?.events ?? [])].reverse().find((e) => e.type === 'review.requested')
    ?.data as { reason?: string } | undefined;
  const left = secondsUntilServer(job.reviewDeadlineAt, sc.serverTime, sc.fetchedAt, now);

  return (
    <div className="space-y-5">
      <PageHeader
        title={job.assetId}
        description={categoryLabel(job.category)}
        breadcrumbs={[{ label: 'My jobs', href: '/tech' }, { label: job.assetId }]}
        actions={<StatusBadge state={job.state} />}
      />

      <section aria-label="Progress" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <StateStepper state={job.state} />
        <p className="mt-4 text-base font-medium">{headline}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {job.state === 'REWORK' && (
            <div
              role="note"
              className="flex items-start gap-3 rounded-lg border border-danger/40 bg-surface p-4 text-sm"
            >
              <MessageSquareWarning
                aria-hidden
                size={20}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-danger"
              />
              <div>
                <p className="font-semibold">The customer asked for rework</p>
                {reworkReason?.reason ? <p className="mt-0.5 italic">“{reworkReason.reason}”</p> : null}
              </div>
            </div>
          )}

          {actions.includes('ENTER_OTP') && <ArrivalPanel job={job} onChanged={refresh} />}
          {actions.includes('START') && <StartPanel job={job} onChanged={refresh} />}
          {job.state === 'IN_PROGRESS' && job.startedAt && <WorkTimerCard job={job} clock={sc} />}
          {actions.includes('UPLOAD_EVIDENCE') && <EvidencePanel job={job} onChanged={refresh} />}

          {(job.state === 'UNDER_REVIEW' || job.state === 'PROOF_UPLOADED') && (
            <Card title="Waiting for review">
              <div className="flex items-start gap-3">
                <Hourglass aria-hidden size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-subtle" />
                <div className="space-y-1 text-sm">
                  <p>The customer is reviewing your photos. You’ll be notified of their decision.</p>
                  {left !== null && (
                    <p className="text-muted">
                      If they don’t respond, the job is approved automatically in{' '}
                      <span className="tabular font-semibold text-ink">{clock(left)}</span>.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {showEvidence && (
            <Card title="Photos you submitted">
              {evidence.loading && !evidence.data ? (
                <Skeleton className="h-24" />
              ) : evidence.error && !evidence.data ? (
                <ErrorState
                  message={friendlyMessage(evidence.error)}
                  correlationId={correlationOf(evidence.error)}
                  onRetry={evidence.refetch}
                />
              ) : (
                <EvidenceGrid items={evidence.data ?? []} onExpired={evidence.refetch} />
              )}
            </Card>
          )}

          {actions.includes('RECEIPT') && (
            <Card>
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CheckCircle2 aria-hidden size={40} strokeWidth={1.5} className="text-success" />
                <p className="text-lg font-semibold">Job complete</p>
                {job.settlement && (
                  <p className="text-muted">
                    Payment recorded <Money minor={job.settlement.amountMinor} className="text-ink" />
                  </p>
                )}
              </div>
            </Card>
          )}

          {job.state === 'CANCELLED' && (
            <Card>
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Ban aria-hidden size={36} strokeWidth={1.5} className="text-subtle" />
                <p className="text-lg font-semibold">This job was cancelled</p>
              </div>
            </Card>
          )}

          <Card title="Activity">
            {events.loading && !events.data ? (
              <Skeleton className="h-24" />
            ) : events.error && !events.data ? (
              <ErrorState
                message={friendlyMessage(events.error)}
                correlationId={correlationOf(events.error)}
                onRetry={events.refetch}
              />
            ) : (
              <Timeline events={events.data?.events ?? []} />
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title="Assignment">
            <div className="flex items-center gap-3">
              <CategoryIcon category={job.category} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{job.assetId}</p>
                <p className="text-sm text-muted">{categoryLabel(job.category)}</p>
              </div>
            </div>
            <dl className="mt-3 divide-y divide-line">
              <KeyValueRow label="Quote">
                <Money minor={job.quoteMinor} />
              </KeyValueRow>
              <KeyValueRow label="From">{new Date(job.windowStart).toLocaleString()}</KeyValueRow>
              <KeyValueRow label="Until">{new Date(job.windowEnd).toLocaleString()}</KeyValueRow>
              <KeyValueRow label="Notes">{job.notes ?? '—'}</KeyValueRow>
            </dl>
            <div className="mt-3 h-44 overflow-hidden rounded-md border border-line">
              <SiteMap site={job.location} label="Map of the job site" />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="tabular text-xs text-muted">Site {formatLatLon(job.location)}</span>
              {!isFinishedState(job.state) && (
                <a
                  href={mapsUrl(job.location)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline"
                >
                  <Navigation aria-hidden size={16} strokeWidth={1.75} />
                  Open in maps
                </a>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
