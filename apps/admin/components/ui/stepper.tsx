import { Check } from 'lucide-react';
import { JOURNEY_STEPS, journeyOf } from '@dispatch/ui-tokens';
import { cn } from '@/lib/cn';

/**
 * Six-step progress indicator. Completed steps show a check, the current step is filled, and rework/cancelled are
 * annotations next to the stepper instead of extra steps. Position comes from the shared token package.
 */
export function StateStepper({ state, className }: { state: string; className?: string }) {
  const { current, note } = journeyOf(state);
  const cancelled = current === -1;
  const doneAll = current === JOURNEY_STEPS.length - 1;
  return (
    <div className={cn('space-y-1.5', className)}>
      <ol
        aria-label={`Progress: ${cancelled ? 'cancelled' : JOURNEY_STEPS[current]?.label}`}
        className="flex items-center"
      >
        {JOURNEY_STEPS.map((step, i) => {
          const complete = !cancelled && (i < current || doneAll);
          const active = !cancelled && i === current && !doneAll;
          return (
            <li
              key={step.key}
              aria-current={active ? 'step' : undefined}
              className={cn('flex items-center', i < JOURNEY_STEPS.length - 1 && 'flex-1')}
            >
              <span className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold',
                    complete && 'border-primary bg-primary text-on-primary',
                    active && 'border-primary bg-primary-soft text-ink ring-2 ring-primary/30',
                    !complete && !active && 'border-line-strong bg-surface text-subtle',
                    cancelled && 'opacity-50',
                  )}
                >
                  {complete ? <Check aria-hidden size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'hidden text-[11px] leading-3 whitespace-nowrap sm:block',
                    active ? 'font-semibold text-ink' : 'text-muted',
                  )}
                >
                  {step.label}
                </span>
              </span>
              {i < JOURNEY_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'mx-1 mb-4 h-0.5 flex-1 rounded sm:mb-4',
                    complete && i < current ? 'bg-primary' : 'bg-line',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      {note && <p className="text-xs font-medium text-muted">{note}</p>}
    </div>
  );
}
