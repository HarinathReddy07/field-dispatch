'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { TextArea } from './form';
import { useDialog, useIsClient } from './use-dialog';

/** Right-hand panel (560px; full width on small screens). Esc and the scrim close it; focus is trapped inside. */
export function Drawer({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const titleId = useId();
  const ref = useDialog<HTMLDivElement>(onClose);
  const client = useIsClient();
  if (!client) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      <div aria-hidden className="fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-line bg-surface shadow-popover"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-lg leading-6 font-semibold">
              {title}
            </h2>
            {subtitle && <div className="mt-2">{subtitle}</div>}
          </div>
          <Button variant="ghost" aria-label="Close" onClick={onClose} className="!px-2">
            <X aria-hidden size={20} strokeWidth={1.75} />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

const MIN_REASON = 5;

/**
 * Confirmation modal for destructive/privileged actions. With `requireReason` the confirm button stays disabled
 * until a reason of at least 5 characters is typed (the API enforces the same rule and records it in the audit log).
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger,
  requireReason = true,
  children,
  busy,
  error,
  confirmDisabled,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  requireReason?: boolean;
  children?: React.ReactNode;
  busy?: boolean;
  error?: React.ReactNode;
  confirmDisabled?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const titleId = useId();
  const descId = useId();
  const ref = useDialog<HTMLDivElement>(() => {
    if (!busy) onClose();
  });
  const client = useIsClient();
  const trimmed = reason.trim();
  const valid = !requireReason || trimmed.length >= MIN_REASON;
  if (!client) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <div aria-hidden className="fade-in absolute inset-0 bg-black/50" onClick={() => !busy && onClose()} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={cn(
          'fade-in relative w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-popover',
        )}
      >
        <h2 id={titleId} className="text-lg leading-6 font-semibold">
          {title}
        </h2>
        <p id={descId} className="mt-1 text-sm text-muted">
          {description}
        </p>
        <div className="mt-4 space-y-3">
          {children}
          {requireReason && (
            <TextArea
              label="Reason (required, recorded in the audit log)"
              data-autofocus
              value={reason}
              rows={3}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              error={touched && !valid ? `Enter at least ${MIN_REASON} characters.` : null}
            />
          )}
          {error && (
            <p role="alert" className="rounded-sm bg-surface-muted px-3 py-2 text-sm text-danger">
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
            loading={busy}
            disabled={!valid || confirmDisabled}
            onClick={() => onConfirm(trimmed)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
