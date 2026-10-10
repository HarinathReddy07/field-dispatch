'use client';

import { useState } from 'react';
import type { RequestView } from '@dispatch/contracts';
import { useAction } from '@/hooks/use-action';
import { api } from '@/lib/client';
import { friendlyMessage } from '@/lib/errors';
import { Button, ConfirmDialog } from '../ui';

/**
 * Cancel a request, or, once a technician is booked, release them so the request goes back to matching.
 * Idempotency-Key is kept per click-through, so a retry after a dropped connection can never cancel twice.
 */
export function CancelRequestButton({
  job,
  onDone,
}: {
  job: RequestView;
  onDone: (updated: RequestView) => void;
}) {
  const [open, setOpen] = useState(false);
  const cancel = useAction((key) =>
    api<RequestView>(`requests/${job.id}/cancel`, { method: 'POST', body: {}, idempotencyKey: key }),
  );
  const release = job.state === 'CONFIRMED';

  const confirm = async () => {
    const updated = await cancel.run();
    if (updated) {
      setOpen(false);
      onDone(updated);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>{release ? 'Release technician' : 'Cancel request'}</Button>
      {open && (
        <ConfirmDialog
          title={release ? 'Release the technician?' : 'Cancel this request?'}
          description={
            release
              ? 'The booking is released and you can choose another technician.'
              : 'The request is closed and no one will be sent. This can’t be undone.'
          }
          confirmLabel={release ? 'Release technician' : 'Cancel request'}
          danger={!release}
          requireReason={false}
          busy={cancel.busy}
          error={cancel.error ? friendlyMessage(cancel.error) : undefined}
          onConfirm={() => void confirm()}
          onClose={() => {
            cancel.reset();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
