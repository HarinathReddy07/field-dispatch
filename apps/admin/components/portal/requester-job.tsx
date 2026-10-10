'use client';

import { useState } from 'react';
import { CheckCircle2, KeyRound, MessageSquareWarning, Navigation } from 'lucide-react';
import type { OtpResponse, RequestView } from '@dispatch/contracts';
import { formatDistanceKm } from '@dispatch/ui-tokens';
import { useAction } from '@/hooks/use-action';
import { useNow } from '@/hooks/use-query';
import { useEvidence } from '@/hooks/use-request';
import { api } from '@/lib/client';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { haversineKm, timeAgo } from '@/lib/format.ts';
import { formatLatLon, type LatLon } from '@/lib/location';
import { clock, etaMinutes, secondsUntilServer } from '@/lib/portal';
import { EvidenceGrid } from '../evidence-grid';
import { useRequestRoom } from '../live-provider';
import { Button, Card, ConfirmDialog, ElapsedTimer, ErrorState, Skeleton } from '../ui';
import { SiteMap } from './site-map-loader';

/** What the clock needs to count against the SERVER time: the payload's serverTime and when it arrived. */
export interface ServerClock {
  serverTime: string;
  fetchedAt: number;
}

/** The one-time arrival code. Shown once; asking again issues a new code and the old one stops working. */
export function ArrivalCodeCard({ jobId, clock: sc }: { jobId: string; clock: ServerClock }) {
  const [code, setCode] = useState<OtpResponse | null>(null);
  const issue = useAction(() => api<OtpResponse>(`requests/${jobId}/otp`, { method: 'POST', body: {} }));
  const now = useNow();
  const left = code ? secondsUntilServer(code.expiresAt, sc.serverTime, sc.fetchedAt, now) : null;
  const live = code !== null && left !== 0;

  const show = async () => {
    const issued = await issue.run();
    if (issued) setCode(issued);
  };

  return (
    <Card title="Arrival code">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Give this code to the technician only when they are at your site. It proves they actually arrived.
        </p>
        {live && code ? (
          <div>
            <div
              role="img"
              aria-label={`Arrival code ${code.otp.split('').join(' ')}`}
              className="flex gap-2"
            >
              {code.otp.split('').map((d, i) => (
                <span
                  key={i}
                  className="flex h-14 w-11 items-center justify-center rounded-md border border-line-strong bg-bg font-mono text-3xl font-semibold sm:w-12"
                >
                  {d}
                </span>
              ))}
            </div>
            <p className="tabular mt-2 text-sm text-muted">Expires in {clock(left)}</p>
          </div>
        ) : code ? (
          <p className="text-sm text-warning">
            That code has expired. Get a new one when the technician arrives.
          </p>
        ) : null}
        {issue.error ? (
          <ErrorState message={friendlyMessage(issue.error)} correlationId={correlationOf(issue.error)} />
        ) : null}
        <Button
          variant={live ? 'secondary' : 'primary'}
          size="lg"
          loading={issue.busy}
          onClick={() => void show()}
          icon={<KeyRound aria-hidden size={18} strokeWidth={1.75} />}
        >
          {live ? 'Get a new code' : 'Show my code'}
        </Button>
      </div>
    </Card>
  );
}

/** Work timer anchored to the server clock: it can't be skewed by the device clock. */
export function WorkTimerCard({ job, clock: sc }: { job: RequestView; clock: ServerClock }) {
  return (
    <Card title="Work timer">
      <div className="flex items-center justify-between gap-3">
        <ElapsedTimer
          startedAt={job.startedAt}
          serverTime={sc.serverTime}
          fetchedAt={sc.fetchedAt}
          className="text-4xl"
        />
        <p className="max-w-[16rem] text-right text-xs text-muted">
          Counted from the moment the technician started, using the server’s clock.
        </p>
      </div>
    </Card>
  );
}

/** Live technician position (from the socket) with a rough ETA while they travel to the site. */
export function LiveLocationCard({ job }: { job: RequestView }) {
  const [pos, setPos] = useState<(LatLon & { at: string }) | null>(null);
  const now = useNow(5000);
  useRequestRoom(job.id, (e) => {
    if (e.type !== 'technician.location.updated') return;
    const d = e.data as { lat?: number; lon?: number; at?: string };
    if (typeof d.lat === 'number' && typeof d.lon === 'number')
      setPos({ lat: d.lat, lon: d.lon, at: d.at ?? e.occurredAt });
  });
  const km = pos ? haversineKm(pos, job.location) : null;

  return (
    <Card title="Technician location">
      <div className="space-y-3">
        <div className="h-52 overflow-hidden rounded-md border border-line">
          <SiteMap site={job.location} technician={pos} label="Map showing your site and the technician" />
        </div>
        {pos && km !== null ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1 font-medium">
              <Navigation aria-hidden size={16} strokeWidth={1.75} className="text-primary" />
              {formatDistanceKm(km)} away
            </span>
            {job.state === 'CONFIRMED' && <span className="text-muted">about {etaMinutes(km)} min</span>}
            <span className="tabular text-xs text-muted">
              {formatLatLon(pos)} · updated {timeAgo(pos.at, now)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted">Waiting for the technician’s position…</p>
        )}
      </div>
    </Card>
  );
}

/** Look at the evidence, then approve or ask for rework (with a reason). The server enforces who may do what. */
export function ReviewPanel({
  job,
  clock: sc,
  onChanged,
}: {
  job: RequestView;
  clock: ServerClock;
  onChanged: () => void;
}) {
  const evidence = useEvidence(job.id, true);
  const now = useNow();
  const left = secondsUntilServer(job.reviewDeadlineAt, sc.serverTime, sc.fetchedAt, now);
  const [dialog, setDialog] = useState<'approve' | 'rework' | null>(null);

  const approve = useAction((key) =>
    api<RequestView>(`requests/${job.id}/review`, {
      method: 'POST',
      body: { decision: 'APPROVE' },
      idempotencyKey: key,
    }),
  );
  const rework = useAction((key, reason: string) =>
    api<RequestView>(`requests/${job.id}/review`, {
      method: 'POST',
      body: { decision: 'REQUEST_REWORK', reason },
      idempotencyKey: key,
    }),
  );

  const close = () => {
    approve.reset();
    rework.reset();
    setDialog(null);
  };

  return (
    <Card title="Review the work">
      <div className="space-y-4">
        {left !== null && (
          <p className="rounded-sm bg-surface-muted px-3 py-2 text-sm">
            If you do nothing, this is approved automatically in{' '}
            <span className="tabular font-semibold">{clock(left)}</span>.
          </p>
        )}
        {evidence.loading && !evidence.data ? (
          <Skeleton className="h-28" />
        ) : evidence.error && !evidence.data ? (
          <ErrorState
            message={friendlyMessage(evidence.error)}
            correlationId={correlationOf(evidence.error)}
            onRetry={evidence.refetch}
          />
        ) : (
          <EvidenceGrid
            items={evidence.data ?? []}
            onlyCycle={job.workCycle}
            onExpired={evidence.refetch}
            emptyHint="The technician’s photos will appear here."
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => setDialog('approve')}
            icon={<CheckCircle2 aria-hidden size={18} strokeWidth={1.75} />}
          >
            Approve work
          </Button>
          <Button
            size="lg"
            onClick={() => setDialog('rework')}
            icon={<MessageSquareWarning aria-hidden size={18} strokeWidth={1.75} />}
          >
            Request rework
          </Button>
        </div>
      </div>

      {dialog === 'approve' && (
        <ConfirmDialog
          title="Approve this work?"
          description="This completes the job and records the payment. It can’t be undone."
          confirmLabel="Approve and pay"
          requireReason={false}
          busy={approve.busy}
          error={approve.error ? friendlyMessage(approve.error) : undefined}
          onConfirm={() =>
            void approve.run().then((v) => {
              if (v) {
                close();
                onChanged();
              }
            })
          }
          onClose={close}
        />
      )}
      {dialog === 'rework' && (
        <ConfirmDialog
          title="Request rework"
          description="Tell the technician what needs to be redone. They’ll upload new photos."
          confirmLabel="Send rework request"
          busy={rework.busy}
          error={rework.error ? friendlyMessage(rework.error) : undefined}
          onConfirm={(reason) =>
            void rework.run(reason).then((v) => {
              if (v) {
                close();
                onChanged();
              }
            })
          }
          onClose={close}
        />
      )}
    </Card>
  );
}
