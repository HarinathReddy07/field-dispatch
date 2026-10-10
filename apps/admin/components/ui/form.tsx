import { useId } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';

/**
 * Row that holds a page's filter controls (Input, Select, Toggle). With `onClear` it shows a "Clear filters"
 * button, enabled only while `active` so it is never a dead control.
 */
export function FilterBar({
  label,
  children,
  active = false,
  onClear,
}: {
  label: string;
  children: React.ReactNode;
  active?: boolean;
  onClear?: () => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-end gap-3">
      {children}
      {onClear && (
        <Button variant="ghost" disabled={!active} onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string | null;
  id: string;
  children: React.ReactNode;
}

function FieldShell({ label, hint, error, id, children }: FieldShellProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  'w-full rounded-sm border bg-surface px-3 text-sm text-ink placeholder:text-subtle ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60';

type CommonProps = { label: string; hint?: string; error?: string | null };

export function Input({
  label,
  hint,
  error,
  className,
  id: idProp,
  ...props
}: CommonProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, 'min-h-9', error ? 'border-danger' : 'border-line-strong', className)}
      />
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  className,
  id: idProp,
  ...props
}: CommonProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <textarea
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, 'py-2', error ? 'border-danger' : 'border-line-strong', className)}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  id: idProp,
  children,
  ...props
}: CommonProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <select
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, 'min-h-9', error ? 'border-danger' : 'border-line-strong', className)}
      >
        {children}
      </select>
    </FieldShell>
  );
}

/** Compact on/off switch used for filters. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-5 w-9 rounded-full border border-line-strong bg-surface-muted transition-colors duration-150 peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:top-0.5 after:left-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-subtle after:transition-transform after:duration-150 peer-checked:after:translate-x-4 peer-checked:after:bg-on-primary"
      />
      {label}
    </label>
  );
}
