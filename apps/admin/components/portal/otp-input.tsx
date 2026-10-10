'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';

const LENGTH = 6;

/**
 * Six-digit code entry: digits only, auto-advance, Backspace steps back, and a pasted code fills every box.
 * `value` holds only the digits typed so far.
 */
export function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  const setAt = (i: number, digits: string) => {
    const clean = digits.replace(/\D/g, '');
    if (!clean) return;
    const chars = value.padEnd(LENGTH, ' ').split('');
    let at = i;
    for (const d of clean) {
      if (at >= LENGTH) break;
      chars[at++] = d;
    }
    const next = chars.join('').replace(/\s/g, '').slice(0, LENGTH);
    onChange(next);
    focus(Math.min(at, next.length));
  };

  return (
    <div role="group" aria-label="6-digit arrival code" className="flex gap-2">
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ''}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          maxLength={LENGTH} // lets a paste arrive whole; setAt spreads it
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            // typing over a filled box arrives as old+new: keep only the new digit; a paste arrives whole
            const raw = e.target.value.replace(/\D/g, '');
            const old = value[i];
            setAt(i, old && raw.length === 2 ? raw.replace(old, '') : raw);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (value[i]) onChange(value.slice(0, i) + value.slice(i + 1));
              else {
                onChange(value.slice(0, Math.max(0, i - 1)) + value.slice(i));
                focus(i - 1);
              }
            } else if (e.key === 'ArrowLeft') focus(i - 1);
            else if (e.key === 'ArrowRight') focus(i + 1);
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-12 w-10 rounded-sm border bg-surface text-center font-mono text-xl font-semibold text-ink sm:h-14 sm:w-12 sm:text-2xl',
            'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
            invalid ? 'border-danger' : 'border-line-strong',
          )}
        />
      ))}
    </div>
  );
}
