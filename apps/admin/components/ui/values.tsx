'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatDuration, formatMoney } from '@dispatch/ui-tokens';
import { useNow } from '@/hooks/use-query';
import { elapsedSeconds } from '@/lib/format.ts';
import { cn } from '@/lib/cn';

/** Money in minor units, tabular figures: "₹465.00". */
export function Money({ minor, className }: { minor: number | null | undefined; className?: string }) {
  return <span className={cn('tabular font-medium', className)}>{formatMoney(minor)}</span>;
}

/**
 * Work timer. Ticks locally but is anchored to the SERVER: `serverTime` came with the payload fetched at
 * `fetchedAt` (client clock), so the device clock's absolute value is never trusted.
 */
export function ElapsedTimer({
  startedAt,
  serverTime,
  fetchedAt,
  className,
}: {
  startedAt: string | null;
  serverTime: string;
  fetchedAt: number;
  className?: string;
}) {
  const now = useNow();
  const seconds = elapsedSeconds(startedAt, serverTime, fetchedAt, now);
  return (
    <span className={cn('tabular font-mono font-semibold', className)} aria-label="Elapsed work time">
      {seconds === null ? '—' : formatDuration(seconds)}
    </span>
  );
}

export function CopyButton({
  value,
  label = 'Copy',
  compact,
}: {
  value: string;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement('textarea');
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : `${label}: ${value.slice(0, 8)}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary hover:bg-surface-muted',
        compact ? 'p-0.5' : 'px-1.5 py-1',
      )}
    >
      <Icon aria-hidden size={14} strokeWidth={1.75} />
      {!compact && (copied ? 'Copied' : label)}
      {compact && <span className="sr-only">{label}</span>}
    </button>
  );
}
