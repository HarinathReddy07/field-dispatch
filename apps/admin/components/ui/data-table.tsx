'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** right-align numeric columns */
  align?: 'left' | 'right';
}

/**
 * Table with sticky header, hover and selected rows, keyboard navigation (Up/Down moves between rows,
 * Enter/Space activates) and a brief tint on rows whose `rowVersion` changed because of a live event.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowVersion,
  selectedKey,
  onRowClick,
  ariaLabel,
  testId,
  rowTestId,
  minWidth = 760,
  maxHeight,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowVersion?: (row: T) => string;
  selectedKey?: string | null;
  onRowClick?: (row: T) => void;
  ariaLabel: string;
  testId?: string;
  rowTestId?: (row: T) => string;
  minWidth?: number;
  maxHeight?: number | string;
}) {
  const body = useRef<HTMLTableSectionElement>(null);
  const versions = useRef<Map<string, string>>(new Map());

  // Tint rows that changed since the last render (DOM-only, no state, so keyboard focus is never disturbed).
  useEffect(() => {
    if (!rowVersion) return;
    const previous = versions.current;
    const next = new Map<string, string>();
    for (const r of rows) {
      const key = rowKey(r);
      const v = rowVersion(r);
      next.set(key, v);
      if (previous.size > 0 && previous.get(key) !== v) {
        const el = body.current?.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(key)}"]`);
        if (el) {
          el.classList.remove('row-flash');
          void el.offsetWidth; // restart the animation
          el.classList.add('row-flash');
        }
      }
    }
    versions.current = next;
  }, [rows, rowKey, rowVersion]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
      e.preventDefault();
      onRowClick?.(row);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const sibling =
        e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling;
      (sibling as HTMLElement | null)?.focus();
    }
  };

  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <table
        aria-label={ariaLabel}
        data-testid={testId}
        className="w-full border-collapse text-left text-sm"
        style={{ minWidth }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'sticky top-0 z-10 border-b border-line bg-surface-muted px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase',
                  c.align === 'right' && 'text-right',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={body}>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                data-row-key={key}
                data-testid={rowTestId?.(row)}
                aria-selected={onRowClick ? selected : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => onKeyDown(e, row) : undefined}
                className={cn(
                  'border-b border-line transition-colors duration-150 last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-surface-muted',
                  selected && 'bg-primary-soft hover:bg-primary-soft',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-3 py-2.5 align-middle',
                      c.align === 'right' && 'text-right',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm"
    >
      <span className="tabular text-muted">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="tabular">
          Page {page} of {pages}
        </span>
        <Button disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
