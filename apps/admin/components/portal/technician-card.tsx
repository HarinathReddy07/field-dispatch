'use client';

import { Clock, MapPin } from 'lucide-react';
import type { NearbyTechnician, RequestView } from '@dispatch/contracts';
import { formatDistanceKm } from '@dispatch/ui-tokens';
import { useAction } from '@/hooks/use-action';
import { api } from '@/lib/client';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { etaMinutes } from '@/lib/portal';
import { AvailabilityPill, Badge, Button, ErrorState } from '../ui';
import { Money } from '../ui/values';
import { Avatar, Rating } from './rating';

/**
 * One bookable technician. Owns its own Idempotency-Key (one per technician), so retrying "Book A" after a dropped
 * connection replays the first attempt, and choosing "B" afterwards can never collide with A's key.
 */
export function TechnicianCard({
  requestId,
  tech,
  highlights,
  locked,
  onBookingStart,
  onBooked,
  onFailed,
}: {
  requestId: string;
  tech: NearbyTechnician;
  highlights: string[];
  /** Another technician is being booked right now. */
  locked: boolean;
  onBookingStart: () => void;
  onBooked: (view: RequestView) => void;
  /** The booking did not go through; the card shows the reason itself. */
  onFailed: () => void;
}) {
  const book = useAction((key) =>
    api<RequestView>(`requests/${requestId}/confirm`, {
      method: 'POST',
      body: { technicianId: tech.technicianId },
      idempotencyKey: key,
    }),
  );
  const first = tech.name.split(' ')[0] ?? tech.name;

  const confirm = async () => {
    onBookingStart();
    const view = await book.run();
    if (view) onBooked(view);
    else onFailed();
  };

  return (
    <article className="rounded-lg border border-line bg-surface p-4" aria-label={`${tech.name}, technician`}>
      <div className="flex items-start gap-3">
        <Avatar name={tech.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{tech.name}</h3>
            {highlights.map((h) => (
              <Badge key={h} tone="info">
                {h}
              </Badge>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <Rating value={tech.rating} />
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden size={14} strokeWidth={1.75} />
              {formatDistanceKm(tech.distanceKm)} away
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden size={14} strokeWidth={1.75} />~{etaMinutes(tech.distanceKm)} min
            </span>
            <AvailabilityPill status={tech.availability} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div>
          <p className="text-xs text-muted">Quote</p>
          <Money minor={tech.quoteMinor} className="text-xl" />
        </div>
        <Button
          variant="primary"
          size="lg"
          loading={book.busy}
          disabled={locked && !book.busy}
          onClick={() => void confirm()}
        >
          Book {first}
        </Button>
      </div>

      {book.error ? (
        <div className="mt-3">
          <ErrorState message={friendlyMessage(book.error)} correlationId={correlationOf(book.error)} />
        </div>
      ) : null}
    </article>
  );
}
