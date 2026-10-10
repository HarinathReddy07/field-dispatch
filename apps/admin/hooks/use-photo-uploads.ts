'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EvidenceIntentResponse } from '@dispatch/contracts';
import { api } from '@/lib/client';
import { preparePhoto, putToSignedUrl, runUpload, type PipelineDeps, type UploadItem } from '@/lib/evidence';
import { uuid } from '@/lib/ids';

/**
 * Evidence uploads for one request: each picked photo runs hash -> intent -> PUT -> finalize with progress.
 * Retry resumes at the step that failed (a stored file is never uploaded twice; finalize keeps its Idempotency-Key).
 */
export function usePhotoUploads(requestId: string, onFinalized: () => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  const files = useRef(new Map<string, File>());
  const done = useRef(onFinalized);

  useEffect(() => {
    itemsRef.current = items;
    done.current = onFinalized;
  });
  useEffect(() => {
    const previews = files;
    return () => {
      for (const i of itemsRef.current) URL.revokeObjectURL(i.previewUrl);
      previews.current.clear();
    };
  }, []);

  const deps = useMemo<PipelineDeps>(
    () => ({
      prepare: preparePhoto,
      intent: (dto) =>
        api<EvidenceIntentResponse>(`requests/${requestId}/evidence/intent`, { method: 'POST', body: dto }),
      upload: putToSignedUrl,
      finalize: (mediaId, key) =>
        api(`requests/${requestId}/evidence`, { method: 'POST', body: { mediaId }, idempotencyKey: key }),
    }),
    [requestId],
  );

  const patch = useCallback((id: string, p: Partial<UploadItem>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  const start = useCallback(
    async (item: UploadItem, file: File) => {
      const result = await runUpload(item, file, deps, (p) => patch(item.id, p));
      if (result.status === 'done') done.current();
    },
    [deps, patch],
  );

  const add = useCallback(
    (picked: File[]) => {
      for (const file of picked) {
        const item: UploadItem = {
          id: uuid(),
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          status: 'preparing',
          progress: 0,
          finalizeKey: uuid(),
        };
        files.current.set(item.id, file);
        setItems((list) => [...list, item]);
        void start(item, file);
      }
    },
    [start],
  );

  const retry = useCallback(
    (id: string) => {
      const cur = itemsRef.current.find((i) => i.id === id);
      const file = files.current.get(id);
      if (!cur || !file) return;
      const next = { ...cur, status: 'preparing' as const, error: undefined };
      patch(id, { status: 'preparing', error: undefined });
      void start(next, file);
    },
    [patch, start],
  );

  const remove = useCallback((id: string) => {
    const cur = itemsRef.current.find((i) => i.id === id);
    if (cur) URL.revokeObjectURL(cur.previewUrl);
    files.current.delete(id);
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const busy = items.some((i) => i.status !== 'done' && i.status !== 'error');
  return { items, add, retry, remove, busy };
}
