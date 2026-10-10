'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RefreshCw, SearchX } from 'lucide-react';
import type { NearbyTechnician } from '@dispatch/contracts';
import { CategoryIcon, categoryLabel } from '@/components/portal/category';
import { CancelRequestButton } from '@/components/portal/cancel-request';
import { SiteMap } from '@/components/portal/site-map-loader';
import { TechnicianCard } from '@/components/portal/technician-card';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { useRequestView } from '@/hooks/use-request';
import { useQuery } from '@/hooks/use-query';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { formatLatLon } from '@/lib/location';
import { cn } from '@/lib/cn';

type Sort = 'nearest' | 'cheapest' | 'rated';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'nearest', label: 'Nearest' },
  { id: 'cheapest', label: 'Lowest price' },
  { id: 'rated', label: 'Top rated' },
];

const BY: Record<Sort, (a: NearbyTechnician, b: NearbyTechnician) => number> = {
  nearest: (a, b) => a.distanceKm - b.distanceKm,
  cheapest: (a, b) => a.quoteMinor - b.quoteMinor,
  rated: (a, b) => b.rating - a.rating,
};

function highlightsFor(list: NearbyTechnician[], t: NearbyTechnician): string[] {
  if (list.length < 2) return [];
  const out: string[] = [];
  if (t.distanceKm === Math.min(...list.map((x) => x.distanceKm))) out.push('Closest');
  if (t.quoteMinor === Math.min(...list.map((x) => x.quoteMinor))) out.push('Lowest price');
  if (t.rating === Math.max(...list.map((x) => x.rating))) out.push('Top rated');
  return out;
}

export default function ChooseTechnicianPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const request = useRequestView(id);
  const job = request.data;

  // Once a technician is booked (or the job is finished) this page has nothing left to do.
  const searching = job ? job.state === 'REQUESTED' || job.state === 'MATCHED' : false;
  useEffect(() => {
    if (job && !searching) router.replace(`/app/requests/${id}`);
  }, [job, searching, id, router]);

  // Searching moves the request from REQUESTED to MATCHED on the server (spec 8.1).
  const nearby = useQuery<NearbyTechnician[]>(searching ? `requests/${id}/nearby-technicians` : null);
  const [sort, setSort] = useState<Sort>('nearest');
  const [booking, setBooking] = useState(false);
  const sorted = useMemo(() => [...(nearby.data ?? [])].sort(BY[sort]), [nearby.data, sort]);

  if (request.error && !job) {
    const missing = request.error.status === 404;
    return (
      <div className="rounded-lg border border-line bg-surface">
        {missing ? (
          <EmptyState title="We couldn’t find that request" hint="It may have been removed." />
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Choose a technician"
        description="Closest first by default. Prices are calculated by the server."
        breadcrumbs={[
          { label: 'My requests', href: '/app' },
          { label: job?.assetId ?? 'Request' },
          { label: 'Technicians' },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section aria-label="Nearby technicians" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Sort technicians"
              className="flex gap-1 rounded-md bg-surface-muted p-1"
            >
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={sort === s.id}
                  onClick={() => setSort(s.id)}
                  className={cn(
                    'min-h-9 rounded-sm px-3 text-sm font-medium transition-colors duration-150',
                    sort === s.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Button
              onClick={nearby.refetch}
              disabled={!searching || nearby.loading}
              icon={<RefreshCw aria-hidden size={16} strokeWidth={1.75} />}
            >
              Search again
            </Button>
          </div>

          {nearby.error && !nearby.data ? (
            <ErrorState
              message={friendlyMessage(nearby.error)}
              correlationId={correlationOf(nearby.error)}
              onRetry={nearby.refetch}
            />
          ) : (nearby.loading && !nearby.data) || (!job && !request.error) ? (
            <div role="status" aria-label="Searching nearby" className="space-y-3">
              <p className="text-sm text-muted">Searching for technicians near your site…</p>
              <Skeleton className="h-36" />
              <Skeleton className="h-36" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface">
              <EmptyState
                icon={SearchX}
                title="No technicians available nearby"
                hint="Everyone close to your site is busy or offline right now. Try again in a moment."
                action={
                  <Button variant="primary" className="mt-2" onClick={nearby.refetch}>
                    Search again
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {sorted.map((t) => (
                <li key={t.technicianId}>
                  <TechnicianCard
                    requestId={id}
                    tech={t}
                    highlights={highlightsFor(sorted, t)}
                    locked={booking}
                    onBookingStart={() => setBooking(true)}
                    onBooked={() => {
                      toast.success(
                        `${t.name} is booked`,
                        'Share the arrival code when they reach your site.',
                      );
                      router.push(`/app/requests/${id}`);
                    }}
                    onFailed={() => {
                      setBooking(false);
                      nearby.refetch(); // the list may be stale, e.g. someone else just booked this technician
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card title="Your request">
            {job ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CategoryIcon category={job.category} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{job.assetId}</p>
                    <p className="text-sm text-muted">{categoryLabel(job.category)}</p>
                  </div>
                </div>
                <StatusBadge state={job.state} />
                <div className="h-40 overflow-hidden rounded-md border border-line">
                  <SiteMap site={job.location} label="Map of your site" />
                </div>
                <p className="tabular text-xs text-muted">Site {formatLatLon(job.location)}</p>
                <p className="text-xs text-muted">
                  {new Date(job.windowStart).toLocaleString()} to {new Date(job.windowEnd).toLocaleString()}
                </p>
                <CancelRequestButton job={job} onDone={() => router.push('/app')} />
              </div>
            ) : (
              <Skeleton className="h-48" />
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
