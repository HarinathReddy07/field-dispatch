'use client';

import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { CategoryIcon, categoryLabel } from '@/components/portal/category';
import { ReorderButton } from '@/components/portal/reorder-button';
import { Timeline } from '@/components/portal/timeline';
import {
  Button,
  ButtonLink,
  Card,
  CopyButton,
  EmptyState,
  ErrorState,
  KeyValueRow,
  Money,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { useRequestEvents, useRequestView } from '@/hooks/use-request';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { formatLatLon } from '@/lib/location';

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const request = useRequestView(id);
  const events = useRequestEvents(id);
  const job = request.data;

  if (request.error && !job) {
    return (
      <div className="rounded-lg border border-line bg-surface">
        {request.error.status === 404 ? (
          <EmptyState title="We couldn’t find that receipt" hint="It may belong to another account." />
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
      <div role="status" aria-label="Loading receipt" className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const settlement = job.settlement;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="print:hidden">
        <PageHeader
          title="Receipt"
          breadcrumbs={[
            { label: 'History', href: '/app/history' },
            { label: job.assetId, href: `/app/requests/${job.id}` },
            { label: 'Receipt' },
          ]}
          actions={
            <Button
              onClick={() => window.print()}
              icon={<Printer aria-hidden size={16} strokeWidth={1.75} />}
            >
              Print
            </Button>
          }
        />
      </div>

      <article aria-label="Receipt" className="rounded-lg border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <div className="flex items-center gap-3">
            <CategoryIcon category={job.category} size="lg" />
            <div>
              <h2 className="text-lg font-semibold">{job.assetId}</h2>
              <p className="text-sm text-muted">{categoryLabel(job.category)}</p>
            </div>
          </div>
          <StatusBadge state={job.state} />
        </header>

        {settlement ? (
          <div className="border-b border-line p-5">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Amount paid</p>
            <Money minor={settlement.amountMinor} className="text-4xl font-bold" />
            <p className="mt-1 text-xs text-muted">
              This payment is simulated for the trial, so no real money moved.
            </p>
          </div>
        ) : (
          <EmptyState
            title="No payment record"
            hint={
              job.state === 'CANCELLED'
                ? 'This request was cancelled, so nothing was charged.'
                : 'This job isn’t settled yet.'
            }
          />
        )}

        <dl className="divide-y divide-line px-5">
          <KeyValueRow label="Technician">{job.technician?.name ?? '—'}</KeyValueRow>
          <KeyValueRow label="Date">{new Date(job.updatedAt).toLocaleString()}</KeyValueRow>
          <KeyValueRow label="Site">
            <span className="tabular">{formatLatLon(job.location)}</span>
          </KeyValueRow>
          {settlement && (
            <>
              <KeyValueRow label="Status">{settlement.status.toLowerCase()}</KeyValueRow>
              <KeyValueRow label="Reference" mono>
                {settlement.providerRef}{' '}
                <span className="print:hidden">
                  <CopyButton value={settlement.providerRef} label="Copy reference" compact />
                </span>
              </KeyValueRow>
            </>
          )}
          <KeyValueRow label="Request ID" mono>
            {job.id}
          </KeyValueRow>
        </dl>

        <section aria-label="Timeline" className="border-t border-line p-5">
          <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
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
        </section>
      </article>

      <div className="flex flex-wrap gap-2 print:hidden">
        <ButtonLink href="/app/history">Back to history</ButtonLink>
        <ReorderButton jobId={job.id} variant="primary" />
      </div>

      <Card className="hidden print:block" bodyClassName="text-xs text-muted">
        Field Dispatch · simulated settlement · generated {new Date().toLocaleString()}
      </Card>
    </div>
  );
}
