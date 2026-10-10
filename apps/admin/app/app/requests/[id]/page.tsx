'use client';

import { useParams, useRouter } from 'next/navigation';
import { Ban, CheckCircle2, Receipt, Search } from 'lucide-react';
import type { RequestView } from '@dispatch/contracts';
import { isFinishedState, jobActionsFor, roleHeadline, stateStyles } from '@dispatch/ui-tokens';
import { CancelRequestButton } from '@/components/portal/cancel-request';
import { CategoryIcon, categoryLabel } from '@/components/portal/category';
import { Avatar, Rating } from '@/components/portal/rating';
import { ReorderButton } from '@/components/portal/reorder-button';
import {
  ArrivalCodeCard,
  LiveLocationCard,
  ReviewPanel,
  WorkTimerCard,
} from '@/components/portal/requester-job';
import { SiteMap } from '@/components/portal/site-map-loader';
import { Timeline } from '@/components/portal/timeline';
import {
  ButtonLink,
  Card,
  CopyButton,
  EmptyState,
  ErrorState,
  KeyValueRow,
  Money,
  PageHeader,
  Skeleton,
  StateStepper,
  StatusBadge,
} from '@/components/ui';
import { useRequestEvents, useRequestView } from '@/hooks/use-request';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { formatLatLon } from '@/lib/location';

function Technician({ job }: { job: RequestView }) {
  const t = job.technician;
  if (!t) return null;
  return (
    <Card title="Your technician">
      <div className="flex items-center gap-3">
        <Avatar name={t.name} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{t.name}</p>
          <Rating value={t.rating} />
        </div>
      </div>
      <dl className="mt-3 divide-y divide-line">
        <KeyValueRow label="Quote">
          <Money minor={job.quoteMinor} />
        </KeyValueRow>
        <KeyValueRow label="Booking ID" mono>
          {t.assignmentId.slice(0, 8)} <CopyButton value={t.assignmentId} label="Copy booking ID" compact />
        </KeyValueRow>
      </dl>
    </Card>
  );
}

export default function RequesterJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const request = useRequestView(id);
  const events = useRequestEvents(id);
  const job = request.data;

  if (request.error && !job) {
    return (
      <div className="rounded-lg border border-line bg-surface">
        {request.error.status === 404 ? (
          <EmptyState
            title="We couldn’t find that request"
            hint="It may have been removed. Your current requests are on the home page."
            action={
              <ButtonLink href="/app" variant="primary" className="mt-2">
                Back to my requests
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
      <div role="status" aria-label="Loading request" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const clock = { serverTime: job.serverTime, fetchedAt: request.fetchedAt };
  const actions = jobActionsFor('REQUESTER', job.state);
  const finished = isFinishedState(job.state);
  const headline = roleHeadline('REQUESTER', job.state) ?? stateStyles[job.state].label;

  return (
    <div className="space-y-5">
      <PageHeader
        title={job.assetId}
        description={categoryLabel(job.category)}
        breadcrumbs={[{ label: 'My requests', href: '/app' }, { label: job.assetId }]}
        actions={<StatusBadge state={job.state} />}
      />

      <section aria-label="Progress" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <StateStepper state={job.state} />
        <p className="mt-4 text-base font-medium">{headline}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {(actions.includes('FIND_TECHNICIAN') || actions.includes('PICK_TECHNICIAN')) && (
            <Card title="Next step">
              <p className="text-sm text-muted">Compare nearby technicians by distance, rating and price.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink
                  href={`/app/requests/${job.id}/technicians`}
                  variant="primary"
                  size="lg"
                  icon={<Search aria-hidden size={18} strokeWidth={1.75} />}
                >
                  Choose a technician
                </ButtonLink>
                <CancelRequestButton job={job} onDone={() => router.push('/app')} />
              </div>
            </Card>
          )}

          {actions.includes('SHOW_OTP') && (
            <>
              <ArrivalCodeCard jobId={job.id} clock={clock} />
              <div>
                <CancelRequestButton job={job} onDone={() => request.refetch()} />
              </div>
            </>
          )}

          {job.technician && !finished && <LiveLocationCard job={job} />}
          {job.state === 'IN_PROGRESS' && job.startedAt && <WorkTimerCard job={job} clock={clock} />}

          {actions.includes('REVIEW') && (
            <ReviewPanel job={job} clock={clock} onChanged={() => request.refetch()} />
          )}

          {job.state === 'REWORK' && (
            <Card title="Rework in progress">
              <p className="text-sm text-muted">
                The technician has been asked to redo the inspection and will upload new photos. You’ll be
                asked to review again.
              </p>
            </Card>
          )}

          {actions.includes('RECEIPT') && (
            <Card>
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 aria-hidden size={40} strokeWidth={1.5} className="text-success" />
                <div>
                  <p className="text-lg font-semibold">Job complete</p>
                  {job.settlement && (
                    <p className="text-muted">
                      Payment recorded <Money minor={job.settlement.amountMinor} className="text-ink" />
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink
                    href={`/app/requests/${job.id}/receipt`}
                    variant="primary"
                    icon={<Receipt aria-hidden size={16} strokeWidth={1.75} />}
                  >
                    View receipt
                  </ButtonLink>
                  <ReorderButton jobId={job.id} />
                </div>
              </div>
            </Card>
          )}

          {job.state === 'CANCELLED' && (
            <Card>
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <Ban aria-hidden size={36} strokeWidth={1.5} className="text-subtle" />
                <p className="text-lg font-semibold">This request was cancelled</p>
                <ReorderButton jobId={job.id} label="Book it again" variant="primary" />
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
          <Technician job={job} />
          <Card title="Job details">
            <div className="flex items-center gap-3">
              <CategoryIcon category={job.category} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{job.assetId}</p>
                <p className="text-sm text-muted">{categoryLabel(job.category)}</p>
              </div>
            </div>
            <dl className="mt-3 divide-y divide-line">
              <KeyValueRow label="From">{new Date(job.windowStart).toLocaleString()}</KeyValueRow>
              <KeyValueRow label="Until">{new Date(job.windowEnd).toLocaleString()}</KeyValueRow>
              <KeyValueRow label="Notes">{job.notes ?? '—'}</KeyValueRow>
            </dl>
            <div className="mt-3 h-44 overflow-hidden rounded-md border border-line">
              <SiteMap site={job.location} label="Map of your site" />
            </div>
            <p className="tabular mt-2 text-xs text-muted">Site {formatLatLon(job.location)}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
