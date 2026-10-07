export type ImageType = 'image/jpeg' | 'image/png';

export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const REQUIRED_EVIDENCE_COUNT = 2;
export const MAX_EVIDENCE_PER_CYCLE = 10;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

const startsWith = (buf: Uint8Array, magic: number[]) =>
  buf.length >= magic.length && magic.every((b, i) => buf[i] === b);

/** Detects the real image type from file signature bytes (the client-declared MIME type is never trusted). */
export function detectImageType(buf: Uint8Array): ImageType | null {
  if (startsWith(buf, PNG_MAGIC)) return 'image/png';
  if (startsWith(buf, JPEG_MAGIC)) return 'image/jpeg';
  return null;
}

export const extensionFor = (t: ImageType): string => (t === 'image/png' ? 'png' : 'jpg');
