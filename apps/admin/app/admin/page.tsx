'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sliders, Activity, MapPin, Users, Receipt, ShieldAlert, ArrowUpRight } from 'lucide-react';
import type { AdminJobsResponse, AdminSummary, RequestState } from '@dispatch/contracts';
import { stateStyles } from '@dispatch/ui-tokens';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FlagChip,
  Input,
  KpiCard,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { useLiveRefresh } from '@/components/live-provider';
import { useQuery } from '@/hooks/use-query';
import { humanize } from '@/lib/format.ts';

const ORDER: RequestState[] = [
  'REQUESTED',
  'MATCHED',
  'CONFIRMED',
  'ARRIVED',
  'IN_PROGRESS',
  'PROOF_UPLOADED',
  'UNDER_REVIEW',
  'REWORK',
  'SETTLED',
  'CANCELLED',
];

export default function DashboardPage() {
  const summary = useQuery<AdminSummary>('admin/summary');
  const jobs = useQuery<AdminJobsResponse>('admin/jobs?pageSize=100');
  const toast = useToast();

  const [dispatchRadius, setDispatchRadius] = useState('50');
  const [reviewTimeout, setReviewTimeout] = useState('10');
  const [staleThreshold, setStaleThreshold] = useState('10');
  const [otpTtl, setOtpTtl] = useState('5');
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('field_dispatch_ops_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dispatchRadius) setDispatchRadius(String(parsed.dispatchRadius));
        if (parsed.reviewTimeout) setReviewTimeout(String(parsed.reviewTimeout));
        if (parsed.staleThreshold) setStaleThreshold(String(parsed.staleThreshold));
        if (parsed.otpTtl) setOtpTtl(String(parsed.otpTtl));
      }
    } catch {}
  }, []);

  const saveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(
        'field_dispatch_ops_config',
        JSON.stringify({
          dispatchRadius: Number(dispatchRadius),
          reviewTimeout: Number(reviewTimeout),
          staleThreshold: Number(staleThreshold),
          otpTtl: Number(otpTtl),
          updatedAt: new Date().toISOString(),
        }),
      );
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
      toast.success('Configuration saved', 'Operational dispatch and timeout parameters updated.');
    } catch {
      toast.error('Failed to save configuration');
    }
  };

  useLiveRefresh(() => {
    summary.refetch();
    jobs.refetch();
  });

  const counts = summary.data?.countsByState ?? {};
  const total = ORDER.reduce((n, s) => n + (counts[s] ?? 0), 0);
  const flagged = (jobs.data?.items ?? []).filter((j) => j.exceptionFlags.length > 0);
  const loading = summary.loading && !summary.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations dashboard"
        description="Live view of requests, technicians and exceptions."
      />

      {/* Operations Command Visual Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="grid lg:grid-cols-3">
          <div className="relative h-48 lg:h-auto min-h-[160px] bg-slate-900">
            <Image
              src="/operations-command.jpg"
              alt="Operations Command Center"
              fill
              className="object-cover opacity-85"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/50 to-transparent" />
            <div className="absolute bottom-4 left-4 text-white">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/40 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Dispatch Telemetry
              </span>
              <p className="mt-1 text-sm font-bold">24/7 Command Console</p>
            </div>
          </div>
          <div className="p-5 lg:col-span-2 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold text-base text-[var(--color-text)]">
                  Enterprise Dispatch Operations
                </h3>
                <span className="text-xs font-mono text-[var(--color-text-muted)]">
                  PostGIS Proximity Engine · MongoDB Record Store
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                Automated geospatial matching within configured service radii. Real-time arrival verification
                and tamper-proof evidence auditing.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--color-border)]">
              <Link
                href="/admin/live"
                className="flex items-center justify-between rounded-lg bg-[var(--color-surface-muted)] p-2.5 text-xs font-semibold hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] transition-colors"
              >
                <span>Live Board</span>
                <ArrowUpRight size={14} />
              </Link>
              <Link
                href="/admin/technicians"
                className="flex items-center justify-between rounded-lg bg-[var(--color-surface-muted)] p-2.5 text-xs font-semibold hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] transition-colors"
              >
                <span>Fleet Map</span>
                <ArrowUpRight size={14} />
              </Link>
              <Link
                href="/admin/settlements"
                className="flex items-center justify-between rounded-lg bg-[var(--color-surface-muted)] p-2.5 text-xs font-semibold hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] transition-colors"
              >
                <span>Settlements</span>
                <ArrowUpRight size={14} />
              </Link>
              <Link
                href="/admin/audit"
                className="flex items-center justify-between rounded-lg bg-[var(--color-surface-muted)] p-2.5 text-xs font-semibold hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] transition-colors"
              >
                <span>Audit Logs</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {summary.error && (
        <ErrorState
          message={summary.error.message}
          correlationId={summary.error.correlationId}
          onRetry={summary.refetch}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px]" />)
        ) : (
          <>
            <KpiCard label="Active requests" value={summary.data?.activeRequests ?? 0} />
            <KpiCard label="Active technicians" value={summary.data?.activeTechnicians ?? 0} />
            <KpiCard
              label="Exceptions"
              value={summary.data?.exceptionCount ?? 0}
              danger={(summary.data?.exceptionCount ?? 0) > 0}
            />
            <KpiCard label="Completed today" value={summary.data?.completedToday ?? 0} />
          </>
        )}
      </div>

      <Card title="Jobs by state">
        {loading ? (
          <Skeleton className="h-10" />
        ) : total === 0 ? (
          <EmptyState title="No requests yet" hint="New requests appear here as soon as they are created." />
        ) : (
          <div className="space-y-4">
            <div
              role="img"
              aria-label={`Jobs by state: ${ORDER.filter((s) => counts[s])
                .map((s) => `${counts[s]} ${stateStyles[s].label}`)
                .join(', ')}`}
              className="flex h-3 w-full overflow-hidden rounded-full bg-surface-muted"
            >
              {ORDER.filter((s) => counts[s]).map((s) => (
                <span
                  key={s}
                  title={`${stateStyles[s].label}: ${counts[s]}`}
                  style={{
                    width: `${((counts[s] ?? 0) / total) * 100}%`,
                    backgroundColor: `var(--state-${s.toLowerCase().replace(/_/g, '-')}-text)`,
                  }}
                />
              ))}
            </div>
            <ul
              aria-label="Counts by state"
              className="grid grid-cols-1 gap-x-6 gap-y-2 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
            >
              {ORDER.map((s) => (
                <li key={s} className="flex items-center justify-between gap-2" data-testid={`count-${s}`}>
                  <StatusBadge state={s} />
                  <span className="tabular text-base font-semibold">{counts[s] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card
        title="Needs attention"
        action={
          <Link href="/admin/live" className="text-sm font-medium text-primary hover:underline">
            Open live board
          </Link>
        }
        bodyClassName="p-0"
      >
        {jobs.loading && !jobs.data ? (
          <div className="p-4">
            <Skeleton className="h-16" />
          </div>
        ) : flagged.length === 0 ? (
          <EmptyState
            title="No exceptions"
            hint="Flags appear here when a job stalls, a technician goes quiet or a review is overdue."
          />
        ) : (
          <ul className="divide-y divide-line">
            {flagged.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/admin/live?job=${j.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-muted"
                >
                  <span className="font-medium">{j.assetId}</span>
                  <span className="text-sm text-muted">{humanize(j.category)}</span>
                  <StatusBadge state={j.state} />
                  <span className="flex flex-wrap gap-1">
                    {j.exceptionFlags.map((f) => (
                      <FlagChip key={f} flag={f} />
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Operational configuration">
        <p className="text-sm text-muted mb-4">
          Configure dispatch proximity search radius, review deadlines, and safety thresholds.
        </p>
        <form onSubmit={saveConfig} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Dispatch radius (km)"
              type="number"
              min="5"
              max="200"
              required
              value={dispatchRadius}
              onChange={(e) => setDispatchRadius(e.target.value)}
              hint="PostGIS proximity matching range"
            />
            <Select
              label="Review auto-complete timeout"
              value={reviewTimeout}
              onChange={(e) => setReviewTimeout(e.target.value)}
              hint="Gating deadline before auto-approval"
            >
              <option value="1">1 minute (Testing / Demo)</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes (Default trial)</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </Select>
            <Select
              label="Stale location threshold"
              value={staleThreshold}
              onChange={(e) => setStaleThreshold(e.target.value)}
              hint="Flag tech as stale if no GPS update"
            >
              <option value="5">5 minutes</option>
              <option value="10">10 minutes (Standard)</option>
              <option value="15">15 minutes</option>
            </Select>
            <Select
              label="Arrival OTP TTL"
              value={otpTtl}
              onChange={(e) => setOtpTtl(e.target.value)}
              hint="Validity period for arrival codes"
            >
              <option value="5">5 minutes (Standard)</option>
              <option value="10">10 minutes</option>
            </Select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" variant="primary">
              {configSaved ? 'Saved!' : 'Save configuration'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDispatchRadius('50');
                setReviewTimeout('10');
                setStaleThreshold('10');
                setOtpTtl('5');
                localStorage.removeItem('field_dispatch_ops_config');
                toast.info('Defaults restored', 'Operational parameters reset to system defaults.');
              }}
            >
              Reset to defaults
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
