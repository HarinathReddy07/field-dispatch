import { AlertCircle, Inbox, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { CopyButton } from './values';

/** Whole-panel loading indicator for content that has no table or card shape to skeleton. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted">
      <Loader2 aria-hidden size={20} strokeWidth={1.75} className="animate-spin motion-reduce:animate-none" />
      {label}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-sm bg-surface-muted motion-reduce:animate-none', className)}
    />
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3 p-4">
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

export function EmptyState({
  title,
  hint,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Icon aria-hidden size={28} strokeWidth={1.5} className="text-subtle" />
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  correlationId,
}: {
  message: string;
  onRetry?: () => void;
  correlationId?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-md border border-danger/40 bg-surface px-4 py-3 text-sm"
    >
      <AlertCircle aria-hidden size={20} strokeWidth={1.75} className="shrink-0 text-danger" />
      <span className="min-w-0 flex-1 text-ink">{message}</span>
      {correlationId && <CopyButton value={correlationId} label="Copy details" />}
      {onRetry && (
        <Button size="md" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
