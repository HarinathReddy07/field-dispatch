'use client';

import { useEffect, useRef, useState } from 'react';
import { FLAG_LABEL, STATE_TONE, humanize, type Tone } from '@/lib/format.ts';
import { useLive } from './live-provider';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-[var(--tone-neutral-bg)] text-[var(--tone-neutral-ink)]',
  info: 'bg-[var(--tone-info-bg)] text-[var(--tone-info-ink)]',
  warn: 'bg-[var(--tone-warn-bg)] text-[var(--tone-warn-ink)]',
  good: 'bg-[var(--tone-good-bg)] text-[var(--tone-good-ink)]',
  bad: 'bg-[var(--tone-bad-bg)] text-[var(--tone-bad-ink)]',
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export const StateBadge = ({ state }: { state: string }) => (
  <Badge tone={STATE_TONE[state] ?? 'neutral'}>{humanize(state)}</Badge>
);

export const FlagBadge = ({ flag }: { flag: string }) => (
  <Badge tone="bad">{FLAG_LABEL[flag] ?? humanize(flag)}</Badge>
);

export function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface shadow-sm">
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-soft">{label}</p>
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums ${tone === 'bad' ? 'text-[var(--tone-bad-ink)]' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-[var(--tone-neutral-bg)] ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className="h-5" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-soft">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-lg bg-[var(--tone-bad-bg)] px-4 py-3 text-sm text-[var(--tone-bad-ink)]"
    >
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="rounded-md border border-current px-3 py-1 font-medium">
          Retry
        </button>
      )}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'danger' | 'ghost';
};
export function Button({ variant = 'ghost', className = '', ...props }: ButtonProps) {
  const style =
    variant === 'primary'
      ? 'bg-brand text-brand-ink'
      : variant === 'danger'
        ? 'bg-[var(--tone-bad-ink)] text-white'
        : 'border border-line bg-surface hover:bg-muted';
  return (
    <button
      {...props}
      className={`inline-flex min-h-9 items-center justify-center rounded-md px-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${style} ${className}`}
    />
  );
}

export function ConnectionBadge() {
  const { status } = useLive();
  const tone: Tone = status === 'live' ? 'good' : status === 'connecting' ? 'warn' : 'bad';
  const label = status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline, retrying';
  return (
    <span role="status" aria-live="polite" data-testid="connection-status" data-status={status}>
      <Badge tone={tone}>
        <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </Badge>
    </span>
  );
}

/** Accessible modal with a mandatory-reason field. Esc closes; the confirm button stays disabled until valid. */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  danger,
  children,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  children?: React.ReactNode;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const valid = reason.trim().length >= 5;

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-xl"
      >
        <h2 id="dlg-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-soft">{description}</p>
        <div className="mt-4 space-y-3">
          {children}
          <label className="block text-sm font-medium" htmlFor="reason">
            Reason <span className="text-soft">(required, recorded in the audit log)</span>
          </label>
          <textarea
            id="reason"
            ref={ref}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full rounded-md border border-line bg-surface p-2 text-sm"
          />
          {error && (
            <p role="alert" className="text-sm text-[var(--tone-bad-ink)]">
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!valid || busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
