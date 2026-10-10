import type { EventEnvelope } from '@dispatch/contracts';
import { toEntries } from '@/lib/timeline';
import { StatusBadge } from '../ui';

export function Timeline({ events }: { events: EventEnvelope[] }) {
  const entries = toEntries(events);
  if (entries.length === 0) return <p className="text-sm text-muted">No activity recorded yet.</p>;
  return (
    <ol className="space-y-4 border-l border-line pl-5">
      {entries.map((e) => (
        <li key={e.key} className="relative text-sm">
          <span aria-hidden className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full bg-primary" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{e.text}</span>
            {e.state && <StatusBadge state={e.state} />}
          </div>
          {e.detail &&
            (e.detailKind === 'reason' ? (
              <p className="mt-0.5 text-muted italic">“{e.detail}”</p>
            ) : (
              <p className="tabular mt-0.5 text-muted">{e.detail}</p>
            ))}
          <p className="mt-0.5 text-xs text-muted">{new Date(e.at).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}
