import Link from 'next/link';
import { ArrowRight, User } from 'lucide-react';
import type { RequestView } from '@dispatch/contracts';
import { roleHeadline, stateStyles } from '@dispatch/ui-tokens';
import { jobHref, nextStepLabel } from '@/lib/portal';
import { StateStepper, StatusBadge } from '../ui';
import { Money } from '../ui/values';
import { CategoryIcon, categoryLabel } from './category';

/** One job in a list: the whole card is the link. Used on the requester and technician home pages. */
export function RequestCard({ job, role }: { job: RequestView; role: 'REQUESTER' | 'TECHNICIAN' }) {
  const next = nextStepLabel(role, job.state);
  const headline = roleHeadline(role, job.state) ?? stateStyles[job.state].label;
  return (
    <Link
      href={jobHref(role, job)}
      className="group block rounded-lg border border-line bg-surface p-4 transition-shadow duration-150 hover:shadow-popover focus-visible:shadow-popover"
    >
      <div className="flex items-start gap-3">
        <CategoryIcon category={job.category} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="truncate text-base font-semibold">{job.assetId}</h3>
            <StatusBadge state={job.state} />
          </div>
          <p className="text-sm text-muted">{categoryLabel(job.category)}</p>
        </div>
      </div>

      <StateStepper state={job.state} className="mt-4" />

      <p className="mt-3 text-sm">{headline}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
          {role === 'REQUESTER' && job.technician && (
            <span className="inline-flex items-center gap-1">
              <User aria-hidden size={14} strokeWidth={1.75} />
              {job.technician.name}
            </span>
          )}
          {job.quoteMinor ? (
            <span>
              Quote <Money minor={job.quoteMinor} className="text-ink" />
            </span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-primary">
          {next ?? 'View details'}
          <ArrowRight
            aria-hidden
            size={16}
            strokeWidth={1.75}
            className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
      </div>
    </Link>
  );
}
