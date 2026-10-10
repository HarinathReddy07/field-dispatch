import type { EvidenceIntentDto, EvidenceIntentResponse } from '@dispatch/contracts';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const REQUIRED_PHOTOS = 2;
export type PhotoType = 'image/jpeg' | 'image/png';

/** Identifies the real file type from its first bytes (the server re-verifies; this only gives instant feedback). */
export function sniffImageType(bytes: Uint8Array): PhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'image/png';
  return null;
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

/** Pure SHA-256, used only where Web Crypto is missing (browsers expose `crypto.subtle` on HTTPS/localhost only). */
export function sha256Fallback(data: Uint8Array): string {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const padded = new Uint8Array((((data.length + 9 + 63) >> 6) << 6) >>> 0);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((data.length * 8) / 0x100000000));
  view.setUint32(padded.length - 4, (data.length * 8) >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!];
    for (let i = 0; i < 64; i++) {
      const t1 =
        (hh! + (rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25)) + ((e! & f!) ^ (~e! & g!)) + K[i]! + w[i]!) >>> 0;
      const t2 = ((rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22)) + ((a! & b!) ^ (a! & c!) ^ (b! & c!))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d! + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a!) >>> 0;
    h[1] = (h[1]! + b!) >>> 0;
    h[2] = (h[2]! + c!) >>> 0;
    h[3] = (h[3]! + d!) >>> 0;
    h[4] = (h[4]! + e!) >>> 0;
    h[5] = (h[5]! + f!) >>> 0;
    h[6] = (h[6]! + g!) >>> 0;
    h[7] = (h[7]! + hh!) >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return sha256Fallback(bytes);
  const digest = await subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
}

export interface PreparedPhoto {
  sizeBytes: number;
  sha256: string;
  contentType: PhotoType;
}

/** Reads the picked file, checks it really is a JPEG/PNG under 5 MB, and computes its SHA-256 (the server re-verifies). */
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  if (file.size > MAX_PHOTO_BYTES) throw new Error('That photo is larger than 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) throw new Error('Only JPEG or PNG photos are accepted.');
  return { sizeBytes: bytes.length, sha256: await sha256Hex(bytes), contentType };
}

/** PUT to the presigned URL with upload progress (fetch has none). Resolves only on a 2xx. */
export function putToSignedUrl(
  url: string,
  headers: Record<string, string>,
  file: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`The upload was refused (${xhr.status}). Please retry.`));
    xhr.onerror = () => reject(new Error('The upload failed. Check your connection and retry.'));
    xhr.onabort = () => reject(new Error('The upload was cancelled.'));
    xhr.send(file);
  });
}

export interface UploadItem {
  id: string;
  name: string;
  /** Object URL for the preview; the owner revokes it. */
  previewUrl: string;
  status: 'preparing' | 'uploading' | 'finalizing' | 'done' | 'error';
  progress: number;
  error?: string;
  prepared?: PreparedPhoto;
  intent?: EvidenceIntentResponse;
  uploaded?: boolean;
  /** Stable for the life of the item, so a retried finalize replays instead of repeating (Idempotency-Key). */
  finalizeKey: string;
}

export interface PipelineDeps {
  prepare: (file: Blob) => Promise<PreparedPhoto>;
  intent: (dto: EvidenceIntentDto) => Promise<EvidenceIntentResponse>;
  upload: (
    url: string,
    headers: Record<string, string>,
    file: Blob,
    onProgress: (fraction: number) => void,
  ) => Promise<void>;
  finalize: (mediaId: string, key: string) => Promise<unknown>;
}

/**
 * pick -> hash -> intent -> PUT to the presigned URL (with progress) -> finalize.
 * Every step records its result on the item, so Retry resumes from the step that failed: an already-uploaded
 * file is never uploaded twice, and finalize always reuses the same Idempotency-Key.
 */
export async function runUpload(
  initial: UploadItem,
  file: Blob,
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
      set({ prepared: await deps.prepare(file) });
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
      await deps.upload(uploadUrl, headers, file, (progress) => set({ progress }));
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
