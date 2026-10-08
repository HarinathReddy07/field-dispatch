'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ApiError } from '@/lib/client';
import { cn } from '@/lib/cn';
import { CopyButton } from './values';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  correlationId?: string;
}

interface ToastApi {
  success: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  /** Accepts an ApiError (message from the envelope + copyable correlation id) or any error. */
  error: (error: unknown, fallback?: string) => void;
}

const ToastContext = createContext<ToastApi>({ success: () => {}, info: () => {}, error: () => {} });
export const useToast = (): ToastApi => useContext(ToastContext);

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info } as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++seq.current;
      setItems((l) => [...l.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.kind === 'error' ? 9000 : 5000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, detail) => push({ kind: 'success', title, detail }),
      info: (title, detail) => push({ kind: 'info', title, detail }),
      error: (error, fallback = 'Something went wrong') =>
        push({
          kind: 'error',
          title: error instanceof ApiError ? error.message : fallback,
          correlationId: error instanceof ApiError ? error.correlationId : undefined,
        }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* polite live region: screen readers announce new toasts without stealing focus */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 bottom-4 z-[1200] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
      >
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="fade-in pointer-events-auto flex items-start gap-3 rounded-md border border-line bg-surface p-3 shadow-popover"
            >
              <Icon
                aria-hidden
                size={20}
                strokeWidth={1.75}
                className={cn(
                  'mt-0.5 shrink-0',
                  t.kind === 'success' && 'text-success',
                  t.kind === 'error' && 'text-danger',
                  t.kind === 'info' && 'text-primary',
                )}
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{t.title}</p>
                {t.detail && <p className="text-muted">{t.detail}</p>}
                {t.correlationId && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <span className="font-mono">{t.correlationId.slice(0, 8)}</span>
                    <CopyButton value={t.correlationId} label="Copy details" compact />
                  </p>
                )}
              </div>
              <button
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="rounded-sm p-1 text-muted hover:bg-surface-muted"
              >
                <X aria-hidden size={16} strokeWidth={1.75} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
