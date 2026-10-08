'use client';

import { stateStyles } from '@dispatch/ui-tokens';
import type { RequestState } from '@dispatch/contracts';
import { useLive } from '@/components/live-provider';
import { FLAG_LABEL, humanize } from '@/lib/format.ts';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-muted border-line',
  info: 'bg-primary-soft text-ink border-transparent',
  success: 'bg-surface-muted text-success border-line',
  warning: 'bg-surface-muted text-warning border-line',
  danger: 'bg-surface-muted text-danger border-line',
};

export function Badge({
  tone = 'neutral',
  children,
  title,
}: {
  tone?: Tone;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/_/g, '-');

/** State badge: tinted background, dark text, leading dot and a text label (never colour alone). */
export function StatusBadge({ state }: { state: RequestState | string }) {
  const known = (stateStyles as Record<string, { label: string } | undefined>)[state];
  const key = known ? slug(state) : 'draft';
  return (
    <span
      data-state={state}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: `var(--state-${key}-bg)`, color: `var(--state-${key}-text)` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {known ? known.label : humanize(state)}
    </span>
  );
}

/** Exception chip (server-computed flag). */
export function FlagChip({ flag }: { flag: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-danger/40 bg-surface px-1.5 py-0.5 text-xs font-medium text-danger">
      <span aria-hidden>!</span>
      {FLAG_LABEL[flag] ?? humanize(flag)}
    </span>
  );
}

const AVAIL: Record<string, { tone: Tone; label: string }> = {
  AVAILABLE: { tone: 'success', label: 'Available' },
  BUSY: { tone: 'warning', label: 'Busy' },
  OFFLINE: { tone: 'neutral', label: 'Offline' },
};

export function AvailabilityPill({ status }: { status: string }) {
  const a = AVAIL[status] ?? { tone: 'neutral' as Tone, label: humanize(status) };
  return (
    <Badge tone={a.tone}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {a.label}
    </Badge>
  );
}

export function ConnectionPill({ status }: { status?: 'connecting' | 'live' | 'offline' }) {
  const live = useLive();
  const s = status ?? live.status;
  const tone: Tone = s === 'live' ? 'success' : s === 'connecting' ? 'warning' : 'danger';
  const label = s === 'live' ? 'Live' : s === 'connecting' ? 'Reconnecting' : 'Offline';
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid={status ? undefined : 'connection-status'}
      data-status={s}
    >
      <Badge tone={tone}>
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full bg-current', s === 'connecting' && 'animate-pulse')}
        />
        {label}
      </Badge>
    </span>
  );
}
