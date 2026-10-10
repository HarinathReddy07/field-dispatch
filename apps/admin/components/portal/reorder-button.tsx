'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import type { RequestView } from '@dispatch/contracts';
import { api } from '@/lib/client';
import { Button, useToast, type ButtonVariant } from '../ui';

/** Creates a new request prefilled from a finished one (same asset, service and site) and goes to technician choice. */
export function ReorderButton({
  jobId,
  label = 'Book again',
  variant = 'secondary',
}: {
  jobId: string;
  label?: string;
  variant?: ButtonVariant;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const again = async () => {
    if (busy) return; // double-click protection
    setBusy(true);
    try {
      const fresh = await api<RequestView>(`requests/${jobId}/reorder`, { method: 'POST', body: {} });
      router.push(`/app/requests/${fresh.id}/technicians`);
    } catch (e) {
      toast.problem(e);
      setBusy(false);
    }
  };

  return (
    <Button
      variant={variant}
      loading={busy}
      onClick={() => void again()}
      icon={<RotateCcw aria-hidden size={16} strokeWidth={1.75} />}
    >
      {label}
    </Button>
  );
}
