'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Camera,
  CheckCircle,
  ClipboardList,
  Clock,
  Compass,
  Cpu,
  KeyRound,
  MapPin,
  Navigation,
  Plus,
  Radio,
  ShieldCheck,
  Star,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import type { RequestView } from '@dispatch/contracts';
import { useLiveRefresh } from '@/components/live-provider';
import { RequestCard } from '@/components/portal/request-card';
import { SiteMap, type MapTechItem } from '@/components/portal/site-map-loader';
import { ButtonLink, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { DEFAULT_CENTER, PLACES } from '@/lib/location';

const CLIENT_SERVICES = [
  {
    title: 'Electrical Inspection',
    tag: 'High & Low Voltage',
    desc: 'Panels, switchgears, transformers, MCB diagnostics, and safety compliance certification.',
    price: 'from ₹800',
    image: '/service-electrical.jpg',
    eta: '15-25 min',
    categoryParam: 'ELECTRICAL_INSPECTION',
    icon: Zap,
  },
  {
    title: 'Mechanical & Machinery',
    tag: 'Turbines & Motors',
    desc: 'Industrial pumps, bearings, rotating machinery, vibration analysis, and preventive maintenance.',
    price: 'from ₹1,200',
    image: '/service-mechanical.jpg',
    eta: '20-30 min',
    categoryParam: 'MECHANICAL_INSPECTION',
    icon: Wrench,
  },
  {
    title: 'Commercial HVAC & Climate',
    tag: 'Chillers & AHU',
    desc: 'Rooftop chiller units, refrigeration compressors, building airflow balancing, and diagnostics.',
    price: 'from ₹1,100',
    image: '/service-hvac.jpg',
    eta: '25-35 min',
    categoryParam: 'MECHANICAL_INSPECTION',
    icon: Cpu,
  },
  {
    title: 'Solar PV & Clean Power',
    tag: 'Inverters & Arrays',
    desc: 'Photovoltaic panels, string inverters, battery backup diagnostics, and rooftop electrical checks.',
    price: 'from ₹950',
    image: '/service-solar.jpg',
    eta: '20-30 min',
    categoryParam: 'ELECTRICAL_INSPECTION',
    icon: Compass,
  },
];

const NEARBY_TECH_FLEET: MapTechItem[] = [
  {
    id: 't-1',
    name: 'Anil Kumar (T1)',
    lat: 12.9716,
    lon: 77.5946,
    rating: 4.9,
    availability: 'AVAILABLE',
    categories: ['Electrical', 'High Voltage'],
  },
  {
    id: 't-2',
    name: 'Arjun Verma (T2)',
    lat: 12.9854,
    lon: 77.6321,
    rating: 4.8,
    availability: 'AVAILABLE',
    categories: ['Mechanical', 'Turbines'],
  },
  {
    id: 't-3',
    name: 'Priya Sharma (T3)',
    lat: 12.9352,
    lon: 77.6245,
    rating: 4.9,
    availability: 'AVAILABLE',
    categories: ['HVAC', 'Refrigeration'],
  },
  {
    id: 't-4',
    name: 'Vikram Rao (T4)',
    lat: 12.925,
    lon: 77.5938,
    rating: 4.7,
    availability: 'AVAILABLE',
    categories: ['Solar PV', 'Inverters'],
  },
  {
    id: 't-5',
    name: 'Suresh Nair (T5)',
    lat: 13.0035,
    lon: 77.5646,
    rating: 4.8,
    availability: 'BUSY',
    categories: ['Electrical', 'Substations'],
  },
];

function ClientFleetMap({ clientLocation }: { clientLocation: { lat: number; lon: number } }) {
  const [showMap, setShowMap] = useState(true);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-md">
      <div className="flex flex-wrap items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-3.5 gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Radio size={16} className="animate-pulse" />
          </span>
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">Nearby Technicians Live Map</h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Showing active certified technicians in proximity to your facility (Bengaluru Hub)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />4 Techs Online
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
              site={clientLocation}
              techniciansList={NEARBY_TECH_FLEET}
              label="Live nearby technicians map"
              className="h-full w-full"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-600" /> Blue marker: Your site
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Green markers: Online technicians
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> Slate markers: Currently busy on job
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ServicesShowcase() {
  return (
    <section aria-labelledby="services-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Specialized Services
          </span>
          <h2 id="services-title" className="text-xl font-extrabold text-[var(--color-text)]">
            All Field Engineering Services
          </h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Choose a service category to match with certified specialists and receive fixed server-locked
            quotes.
          </p>
        </div>
        <ButtonLink
          href="/app/new"
          variant="primary"
          size="md"
          icon={<Plus aria-hidden size={16} strokeWidth={2.5} />}
        >
          New Custom Request
        </ButtonLink>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CLIENT_SERVICES.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.title}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[var(--color-primary)]/50"
            >
              <div className="relative h-40 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <Image
                  src={s.image}
                  alt={s.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute bottom-2 left-2.5 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-slate-900 backdrop-blur-sm">
                  {s.tag}
                </span>
                <span className="absolute top-2 right-2.5 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  <Clock size={10} /> {s.eta}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <Icon size={14} strokeWidth={2} />
                  </span>
                  <h3 className="font-bold text-sm text-[var(--color-text)] leading-tight">{s.title}</h3>
                </div>

                <p className="flex-1 text-[11px] leading-relaxed text-[var(--color-text-muted)] mb-3">
                  {s.desc}
                </p>

                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2.5 mt-auto">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-[var(--color-text-muted)]">
                      Fixed quote
                    </span>
                    <span className="text-xs font-black text-[var(--color-primary)]">{s.price}</span>
                  </div>
                  <Link
                    href={`/app/new?category=${s.categoryParam}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm"
                  >
                    Request <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrustBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 dark:border-blue-400/20 dark:bg-blue-950/20">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-sm">
          <ShieldCheck size={20} strokeWidth={2} />
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--color-text)]">
            Protected by FieldDispatch Trust Protocol
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Arrival verified via 6-digit cryptographic OTP · Work starts only with handshake · Photo proof
            required before payment
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs font-semibold text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <KeyRound size={13} className="text-[var(--color-primary)]" /> Secure OTP
        </span>
        <span className="flex items-center gap-1.5">
          <Camera size={13} className="text-[var(--color-primary)]" /> Photo Audits
        </span>
        <span className="flex items-center gap-1.5">
          <Star size={13} className="text-amber-500 fill-amber-500" /> 4.8★ Rated Pros
        </span>
      </div>
    </div>
  );
}

export default function RequesterHomePage() {
  const active = useQuery<RequestView[]>('requests/active');
  useLiveRefresh(active.refetch);
  const first = active.loading && !active.data;

  // Primary site location: if client has an active job, use its location, else MG Road default
  const activeLocation = active.data?.[0]?.location ?? DEFAULT_CENTER;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customer Dashboard"
        description="Book on-demand certified field inspections, follow active jobs live on map, and inspect photo evidence."
      />

      <TrustBanner />

      {/* Live Map of Nearby Available Technicians */}
      <ClientFleetMap clientLocation={activeLocation} />

      {/* All Services Showcase with High-Res Images */}
      <ServicesShowcase />

      {/* Active Job Requests */}
      <section aria-labelledby="active-title" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="active-title" className="text-lg font-bold text-[var(--color-text)]">
              Active Job Requests
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Live tracking for ongoing dispatches and inspections.
            </p>
          </div>
          <Link
            href="/app/history"
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            View Completed Jobs History →
          </Link>
        </div>

        {active.error && !active.data ? (
          <ErrorState
            message={friendlyMessage(active.error)}
            correlationId={correlationOf(active.error)}
            onRetry={active.refetch}
          />
        ) : first ? (
          <div role="status" aria-label="Loading requests" className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : active.data && active.data.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-sm">
            <EmptyState
              icon={ClipboardList}
              title="No active inspections right now"
              hint="Select any service above or click 'New custom request' to dispatch a certified technician to your site."
              action={
                <ButtonLink href="/app/new" variant="primary" className="mt-4">
                  Book an inspection now
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {active.data?.map((j) => (
              <li key={j.id}>
                <RequestCard job={j} role="REQUESTER" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
