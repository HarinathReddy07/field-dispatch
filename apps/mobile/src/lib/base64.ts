const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes standard base64 into bytes (no Buffer/atob dependency, so it runs on any JS engine). */
export function base64ToBytes(input: string): Uint8Array<ArrayBuffer> {
  const clean = input.replace(/[\r\n\s]/g, '').replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error('Invalid base64 input');
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.slice(0, o);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const starts = (b: Uint8Array, m: number[]) => b.length >= m.length && m.every((x, i) => b[i] === x);

/** Real image type from the first bytes. The API re-checks this server-side; this only avoids a doomed upload. */
export function sniffImageType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (starts(bytes, PNG)) return 'image/png';
  if (starts(bytes, JPEG)) return 'image/jpeg';
  return null;
}
