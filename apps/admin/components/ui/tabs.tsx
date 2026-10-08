'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

/** Accessible tab list (roving focus, Left/Right/Home/End). Render the panel yourself under `<TabPanel>`. */
export function Tabs({
  tabs,
  value,
  onChange,
  label,
  idPrefix = 'tabs',
}: {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  /** Must match the `idPrefix` of the matching <TabPanel> so aria-controls resolves. */
  idPrefix?: string;
}) {
  const base = idPrefix;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (to: number) => {
    const next = tabs[(to + tabs.length) % tabs.length]!;
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line px-5">
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(i + 1);
              else if (e.key === 'ArrowLeft') move(i - 1);
              else if (e.key === 'Home') move(0);
              else if (e.key === 'End') move(tabs.length - 1);
              else return;
              e.preventDefault();
            }}
            className={cn(
              '-mb-px min-h-10 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150',
              selected ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="tabular ml-1.5 text-xs text-muted">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  value,
  children,
  idPrefix = 'tabs',
}: {
  id: string;
  value: string;
  children: React.ReactNode;
  idPrefix?: string;
}) {
  if (id !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      tabIndex={0}
      className="px-5 py-4"
    >
      {children}
    </div>
  );
}
