'use client';

import { useState } from 'react';
import { CircleDot, MapPinned, Power } from 'lucide-react';
import { useAction } from '@/hooks/use-action';
import { useLocationSharing, type LocationSource } from '@/hooks/use-location-sharing';
import { useNow } from '@/hooks/use-query';
import { api } from '@/lib/client';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format.ts';
import { PLACES, formatLatLon } from '@/lib/location';
import { Badge, Button, Card, ErrorState, Select, Toggle } from '../ui';

type Availability = 'AVAILABLE' | 'OFFLINE';

/**
 * Go online or offline. The API does not expose the technician's current availability to themselves, so the card
 * shows what they set here; while they have a job it shows "Busy" instead (the server blocks changes then).
 * Remount with a new `key` when the job state changes so a stale choice never lingers.
 */
export function AvailabilityCard({ hasJob }: { hasJob: boolean }) {
  const [status, setStatus] = useState<Availability | null>(null);
  const set = useAction((key, next: Availability) =>
    api<{ status: string }>('technicians/me/availability', { method: 'PATCH', body: { status: next } }).then(
      () => next,
    ),
  );

  const change = async (next: Availability) => {
    const done = await set.run(next);
    if (done) setStatus(done);
  };

  return (
    <Card title="Availability">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge tone={hasJob ? 'warning' : status === 'AVAILABLE' ? 'success' : 'neutral'}>
            <CircleDot aria-hidden size={12} strokeWidth={2.25} />
            {hasJob
              ? 'Busy'
              : status === 'AVAILABLE'
                ? 'Online'
                : status === 'OFFLINE'
                  ? 'Offline'
                  : 'Not set'}
          </Badge>
          <p className="text-sm text-muted">
            {hasJob
              ? 'You’re on a job. New bookings are paused until it’s finished.'
              : status === 'AVAILABLE'
                ? 'Customers nearby can book you.'
                : status === 'OFFLINE'
                  ? 'You won’t receive new bookings.'
                  : 'Go online to start receiving nearby bookings.'}
          </p>
        </div>
        {set.error ? (
          <ErrorState message={friendlyMessage(set.error)} correlationId={correlationOf(set.error)} />
        ) : null}
        {!hasJob && (
          <Button
            variant={status === 'AVAILABLE' ? 'secondary' : 'primary'}
            size="lg"
            loading={set.busy}
            onClick={() => void change(status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE')}
            icon={<Power aria-hidden size={18} strokeWidth={1.75} />}
          >
            {status === 'AVAILABLE' ? 'Go offline' : 'Go online'}
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Share a live position so nearby customers can find you. Needs a recent position to appear in searches. */
export function LocationCard() {
  const [on, setOn] = useState(false);
  const [sourceId, setSourceId] = useState('gps');
  const source: LocationSource =
    sourceId === 'gps'
      ? { kind: 'gps' }
      : (() => {
          const p = PLACES.find((x) => x.name === sourceId) ?? PLACES[0]!;
          return { kind: 'place', name: p.name, location: p.location };
        })();
  const share = useLocationSharing(on, source);
  const now = useNow(5000);

  return (
    <Card title="Location">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Customers only see technicians whose location was updated recently, so keep this on while you’re
          online.
        </p>
        <Toggle label="Share my location" checked={on} onChange={setOn} />
        <Select
          label="Location source"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          hint="Pick a place to stand in for your position, for example when testing at a desk."
        >
          <option value="gps">This device (GPS)</option>
          {PLACES.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} (demo location)
            </option>
          ))}
        </Select>
        <p role="status" aria-live="polite" className="flex items-start gap-2 text-sm">
          <MapPinned aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" />
          <span>
            {share.status === 'off' && 'Not sharing.'}
            {share.status === 'starting' && 'Getting your position…'}
            {share.status === 'sharing' && share.last && (
              <>
                Sharing · sent {timeAgo(new Date(share.last.at).toISOString(), now)}
                <span className="tabular block text-xs text-muted">{formatLatLon(share.last)}</span>
              </>
            )}
            {share.status === 'unsupported' &&
              'This browser can’t share its location. Pick a demo location instead.'}
            {share.status === 'denied' && (share.message ?? 'Location permission was denied.')}
            {share.status === 'error' && (
              <span className="text-danger">
                {share.message ?? 'Something went wrong sharing your location.'}
              </span>
            )}
          </span>
        </p>
      </div>
    </Card>
  );
}
