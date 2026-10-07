import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { evidenceIntent, finalizeEvidence, keys } from '../api/hooks';
import { uuid } from '../api/instance';
import { prepareImage, uploadFile } from './native';
import { runUpload, type PipelineDeps, type UploadItem } from './pipeline';

/** Local list of evidence uploads for one request, each resumable and retryable. */
export function useUploads(requestId: string) {
  const qc = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  itemsRef.current = items;

  const deps: PipelineDeps = {
    prepare: prepareImage,
    intent: (dto) => evidenceIntent(requestId, dto),
    upload: uploadFile,
    finalize: async (mediaId, key) => {
      const res = await finalizeEvidence(requestId, mediaId, key);
      void qc.invalidateQueries({ queryKey: keys.evidence(requestId) });
      return res;
    },
  };

  const patch = useCallback((id: string, p: Partial<UploadItem>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  const start = useCallback(
    async (item: UploadItem) => {
      await runUpload(item, deps, (p) => patch(item.id, p));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestId, patch],
  );

  const add = useCallback(
    (uri: string) => {
      const item: UploadItem = { id: uuid(), uri, status: 'preparing', progress: 0, finalizeKey: uuid() };
      setItems((l) => [...l, item]);
      return start(item);
    },
    [start],
  );

  const retry = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      return item ? start(item) : Promise.resolve();
    },
    [start],
  );

  return { items, add, retry, doneCount: items.filter((i) => i.status === 'done').length };
}
