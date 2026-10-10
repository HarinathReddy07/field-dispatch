'use client';

import { useId, useState } from 'react';
import { Check, KeyRound, Play, Send } from 'lucide-react';
import { ArriveSchema, type RequestView } from '@dispatch/contracts';
import { useAction } from '@/hooks/use-action';
import { useEvidence } from '@/hooks/use-request';
import { api } from '@/lib/client';
import { correlationOf, friendlyMessage } from '@/lib/errors';
import { REQUIRED_PHOTOS } from '@/lib/evidence';
import { cn } from '@/lib/cn';
import { EvidenceGrid } from '../evidence-grid';
import { Button, Card, ErrorState, Skeleton } from '../ui';
import { OtpInput } from './otp-input';
import { PhotoUploader } from './photo-uploader';

/** Enter the customer's six-digit code. The server answers with one uniform message, so nothing is revealed. */
export function ArrivalPanel({ job, onChanged }: { job: RequestView; onChanged: () => void }) {
  const [otp, setOtp] = useState('');
  const [local, setLocal] = useState<string | null>(null);
  const errId = useId();
  const arrive = useAction((key, code: string) =>
    api<RequestView>(`requests/${job.id}/arrive`, {
      method: 'POST',
      body: { otp: code },
      idempotencyKey: key,
    }),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ArriveSchema.safeParse({ otp });
    if (!parsed.success) {
      setLocal('Enter the 6-digit code.');
      return;
    }
    setLocal(null);
    const done = await arrive.run(parsed.data.otp);
    if (done) {
      setOtp('');
      onChanged();
    }
  };

  const message = local ?? (arrive.error ? friendlyMessage(arrive.error) : null);
  return (
    <Card title="Arrival code">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-muted">
          When you reach the site, ask the customer for their 6-digit arrival code.
        </p>
        <OtpInput
          value={otp}
          onChange={(v) => {
            setOtp(v);
            setLocal(null);
            arrive.reset();
          }}
          disabled={arrive.busy}
          invalid={message !== null}
          describedBy={message ? errId : undefined}
          autoFocus
        />
        {message && (
          <p id={errId} role="alert" className="text-sm text-danger">
            {message}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={arrive.busy}
          icon={<KeyRound aria-hidden size={18} strokeWidth={1.75} />}
        >
          Confirm arrival
        </Button>
      </form>
    </Card>
  );
}

export function StartPanel({ job, onChanged }: { job: RequestView; onChanged: () => void }) {
  const start = useAction((key) =>
    api<RequestView>(`requests/${job.id}/start`, { method: 'POST', body: {}, idempotencyKey: key }),
  );
  const go = async () => {
    if (await start.run()) onChanged();
  };
  return (
    <Card title="Ready to begin?">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Starting begins the work timer. It runs on the server clock, so it can’t be changed from this
          device.
        </p>
        {start.error ? (
          <ErrorState message={friendlyMessage(start.error)} correlationId={correlationOf(start.error)} />
        ) : null}
        <Button
          variant="primary"
          size="lg"
          loading={start.busy}
          onClick={() => void go()}
          icon={<Play aria-hidden size={18} strokeWidth={1.75} />}
        >
          Start work
        </Button>
      </div>
    </Card>
  );
}

/** Progress toward the required photos: filled segments plus a text count (never colour alone). */
function PhotoProgress({ done }: { done: number }) {
  const shown = Math.min(done, REQUIRED_PHOTOS);
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: REQUIRED_PHOTOS }, (_, i) => (
          <span
            key={i}
            className={cn('h-2 flex-1 rounded-full', i < shown ? 'bg-primary' : 'bg-surface-muted')}
          />
        ))}
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-sm font-medium" role="status">
        {shown >= REQUIRED_PHOTOS && (
          <Check aria-hidden size={16} strokeWidth={2.25} className="text-success" />
        )}
        {shown} of {REQUIRED_PHOTOS} required photos uploaded
      </p>
    </div>
  );
}

/** Capture and upload photos, then send the job for review. The server enforces the two-photo gate. */
export function EvidencePanel({ job, onChanged }: { job: RequestView; onChanged: () => void }) {
  const evidence = useEvidence(job.id, true);
  const stop = useAction((key) =>
    api<RequestView>(`requests/${job.id}/stop`, { method: 'POST', body: {}, idempotencyKey: key }),
  );
  const thisCycle = (evidence.data ?? []).filter((e) => e.workCycle === job.workCycle).length;
  const ready = thisCycle >= REQUIRED_PHOTOS;

  const submit = async () => {
    if (await stop.run()) onChanged();
  };

  return (
    <Card title="Evidence photos">
      <div className="space-y-4">
        <PhotoProgress done={thisCycle} />
        {job.workCycle > 1 && (
          <p className="text-sm text-muted">This is rework round {job.workCycle}: upload new photos.</p>
        )}
        <PhotoUploader requestId={job.id} onUploaded={evidence.refetch} />
        {evidence.loading && !evidence.data ? (
          <Skeleton className="h-20" />
        ) : evidence.error && !evidence.data ? (
          <ErrorState
            message={friendlyMessage(evidence.error)}
            correlationId={correlationOf(evidence.error)}
            onRetry={evidence.refetch}
          />
        ) : thisCycle > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Uploaded and verified</h3>
            <EvidenceGrid
              items={evidence.data ?? []}
              onlyCycle={job.workCycle}
              onExpired={evidence.refetch}
            />
          </div>
        ) : null}
        {stop.error ? (
          <ErrorState message={friendlyMessage(stop.error)} correlationId={correlationOf(stop.error)} />
        ) : null}
        <div>
          <Button
            variant="primary"
            size="lg"
            loading={stop.busy}
            disabled={!ready}
            onClick={() => void submit()}
            icon={<Send aria-hidden size={18} strokeWidth={1.75} />}
          >
            Submit for review
          </Button>
          {!ready && (
            <p className="mt-1.5 text-xs text-muted">
              Upload {REQUIRED_PHOTOS - thisCycle} more verified photo
              {REQUIRED_PHOTOS - thisCycle === 1 ? '' : 's'} to enable this.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
