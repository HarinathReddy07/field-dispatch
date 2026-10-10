'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ShieldCheck,
  Camera,
  KeyRound,
  MapPin,
  TrendingUp,
  Radio,
  Navigation,
} from 'lucide-react';
import type { RequestView } from '@dispatch/contracts';
import { useLiveRefresh } from '@/components/live-provider';
import { CategoryIcon, categoryLabel } from '@/components/portal/category';
import { RequestCard } from '@/components/portal/request-card';
import { AvailabilityCard, LocationCard } from '@/components/portal/technician-home';
import { SiteMap, type MapRequestItem } from '@/components/portal/site-map-loader';
import { Button, EmptyState, ErrorState, Money, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { DEFAULT_CENTER, PLACES } from '@/lib/location';

const RECENT = 5;

// Sample client inspection sites awaiting field response in Bengaluru
const NEARBY_CLIENT_SITES: MapRequestItem[] = [
  {
    id: 'req-01',
    assetId: 'TECH-PARK-GENSET-01',
    category: 'ELECTRICAL_INSPECTION',
    state: 'MATCHING',
    lat: 12.9748,
    lon: 77.6033,
    quote: 85000,
  },
  {
    id: 'req-02',
    assetId: 'CHILLER-ROOF-UNIT-4',
    category: 'MECHANICAL_INSPECTION',
    state: 'MATCHING',
    lat: 12.9784,
    lon: 77.6408,
    quote: 120000,
  },
  {
    id: 'req-03',
    assetId: 'SUBSTATION-FEEDER-B',
    category: 'ELECTRICAL_INSPECTION',
    state: 'MATCHING',
    lat: 12.9352,
    lon: 77.6245,
    quote: 95000,
  },
];

function CompletedRow({ job }: { job: RequestView }) {
  return (
    <li>
      <Link
        href={`/tech/jobs/${job.id}`}
        className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-shadow duration-150 hover:shadow-md"
      >
        <CategoryIcon category={job.category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{job.assetId}</span>
          <span className="block text-xs text-muted">
            {categoryLabel(job.category)} · {new Date(job.updatedAt).toLocaleDateString()}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {job.settlement ? <Money minor={job.settlement.amountMinor} /> : null}
          <StatusBadge state={job.state} />
        </span>
      </Link>
    </li>
  );
}

function TechDispatchMap({ activeJob }: { activeJob?: RequestView }) {
  const [showMap, setShowMap] = useState(true);
  // Default technician location: Indiranagar
  const techLocation = { lat: 12.9854, lon: 77.6321 };

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-md">
      <div className="flex flex-wrap items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-3.5 gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Navigation size={16} className="text-[var(--color-primary)]" />
          </span>
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">
              Live Field Dispatch & Client Sites Map
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Your location relative to client inspection sites and assigned routes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-[var(--color-primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
            GPS Beacon Active
          </span>
          <button
            onClick={() => setShowMap(!showMap)}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            {showMap ? 'Hide map' : 'Show map'}
          </button>
        </div>
      </div>

      {showMap && (
        <div>
          <div className="h-72 w-full">
            <SiteMap
              site={activeJob?.location ?? null}
              technician={techLocation}
              requestsList={activeJob ? undefined : NEARBY_CLIENT_SITES}
              label="Technician dispatch map"
              className="h-full w-full"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Gold marker: Your GPS location
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-600" /> Blue marker: Client inspection destination
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-600" /> Amber markers: Open client inspection
              sites
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TechnicianHomePage() {
  const active = useQuery<RequestView[]>('requests/active');
  const history = useQuery<RequestView[]>('requests/history?page=1');
  useLiveRefresh(() => {
    active.refetch();
    history.refetch();
  });
  const [all, setAll] = useState(false);
  const hasJob = (active.data?.length ?? 0) > 0;
  const currentJob = active.data?.[0];
  const finished = history.data ?? [];
  const shown = all ? finished : finished.slice(0, RECENT);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technician Portal"
        description="Manage your availability, navigate to client sites, and submit verified photo evidence."
      />

      {/* Protocol & Verification Reminders */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 dark:border-blue-400/20 dark:bg-blue-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-sm">
            <ShieldCheck size={20} strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--color-text)]">Field Engineer Protocol Guarantee</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Enter customer arrival OTP upon arrival to unlock job timer · Upload 2 verified evidence photos
              before review
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1.5">
            <KeyRound size={13} className="text-[var(--color-primary)]" /> 6-Digit OTP Lock
          </span>
          <span className="flex items-center gap-1.5">
            <Camera size={13} className="text-[var(--color-primary)]" /> Mandatory Photos
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <TrendingUp size={13} /> 24h Payout Settlement
          </span>
        </div>
      </div>

      {/* Live Map for Technicians (showing their position & client sites) */}
      <TechDispatchMap activeJob={currentJob} />

      {/* Availability & Location Cards */}
      <div className="grid gap-5 md:grid-cols-2">
        <AvailabilityCard key={hasJob ? 'busy' : 'free'} hasJob={hasJob} />
        <LocationCard />
      </div>

      {/* Active Assignments */}
      <section aria-labelledby="assignments" className="space-y-3">
        <h2 id="assignments" className="text-lg font-bold text-[var(--color-text)]">
          Active Assignments
        </h2>
        {active.error && !active.data ? (
          <ErrorState
            message={friendlyMessage(active.error)}
            correlationId={correlationOf(active.error)}
            onRetry={active.refetch}
          />
        ) : active.loading && !active.data ? (
          <div role="status" aria-label="Loading assignments" className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-52 rounded-xl" />
          </div>
        ) : active.data && active.data.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-sm">
            <EmptyState
              icon={Briefcase}
              title="No active assignment right now"
              hint="Ensure your availability is set to 'Online' above. New inspection requests in your area will appear here immediately."
            />
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {active.data?.map((j) => (
              <li key={j.id}>
                <RequestCard job={j} role="TECHNICIAN" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Completed Work History */}
      {finished.length > 0 && (
        <section aria-labelledby="history" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="history" className="text-lg font-bold text-[var(--color-text)]">
              Finished Work & Settlements ({finished.length})
            </h2>
            {finished.length > RECENT && (
              <Button variant="ghost" size="md" onClick={() => setAll(!all)}>
                {all ? 'Show recent' : 'Show all'}
              </Button>
            )}
          </div>
          <ul className="space-y-2">
            {shown.map((j) => (
              <CompletedRow key={j.id} job={j} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
