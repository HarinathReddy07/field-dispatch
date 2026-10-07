import type { EvidenceIntentDto, EvidenceIntentResponse } from '@dispatch/contracts';

export interface PreparedImage {
  sizeBytes: number;
  sha256: string;
  contentType: 'image/jpeg' | 'image/png';
}

export interface UploadItem {
  id: string;
  uri: string;
  status: 'preparing' | 'uploading' | 'finalizing' | 'done' | 'error';
  progress: number;
  error?: string;
  prepared?: PreparedImage;
  intent?: EvidenceIntentResponse;
  uploaded?: boolean;
  /** Stable for the life of the item, so a retried finalize replays instead of repeating (Idempotency-Key). */
  finalizeKey: string;
}

export interface PipelineDeps {
  prepare: (uri: string) => Promise<PreparedImage>;
  intent: (dto: EvidenceIntentDto) => Promise<EvidenceIntentResponse>;
  upload: (
    url: string,
    uri: string,
    headers: Record<string, string>,
    onProgress: (fraction: number) => void,
  ) => Promise<void>;
  finalize: (mediaId: string, key: string) => Promise<unknown>;
}

/**
 * capture -> hash -> intent -> PUT to the presigned URL (with progress) -> finalize.
 * Every step records its result on the item, so Retry resumes from the step that failed (an already-uploaded
 * file is never uploaded twice, and finalize always reuses the same Idempotency-Key).
 */
export async function runUpload(
  initial: UploadItem,
  deps: PipelineDeps,
  onUpdate: (patch: Partial<UploadItem>) => void,
): Promise<UploadItem> {
  let item = { ...initial };
  const set = (patch: Partial<UploadItem>) => {
    item = { ...item, ...patch };
    onUpdate(patch);
  };
  try {
    if (!item.prepared) {
      set({ status: 'preparing', error: undefined });
      set({ prepared: await deps.prepare(item.uri) });
    }
    if (!item.intent) {
      const p = item.prepared!;
      set({
        intent: await deps.intent({
          contentType: p.contentType,
          sizeBytes: p.sizeBytes,
          checksumSha256: p.sha256,
        }),
      });
    }
    if (!item.uploaded) {
      set({ status: 'uploading', progress: 0 });
      const { uploadUrl, headers } = item.intent!;
      await deps.upload(uploadUrl, item.uri, headers, (progress) => set({ progress }));
      set({ uploaded: true, progress: 1 });
    }
    set({ status: 'finalizing' });
    await deps.finalize(item.intent!.mediaId, item.finalizeKey);
    set({ status: 'done' });
  } catch (e) {
    set({ status: 'error', error: e instanceof Error ? e.message : 'Upload failed' });
  }
  return item;
}
