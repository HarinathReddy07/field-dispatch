import { createHmac, randomBytes } from 'node:crypto';
import { PresignedGet, PresignedPut, StorageProvider } from './storage.provider';

/**
 * MOCK storage: an in-process object store for tests (STORAGE_PROVIDER=memory). It models the
 * parts of a private bucket that the API relies on: signed, expiring URLs and size/key handling.
 */
export class MemoryStorageProvider implements StorageProvider {
  readonly isMock = true;
  private readonly objects = new Map<string, Buffer>();
  private readonly secret = randomBytes(16);

  private sign(method: string, key: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`${method}:${key}:${exp}`).digest('hex').slice(0, 32);
  }

  async presignPut(input: { key: string; contentType: string; ttlSeconds: number }): Promise<PresignedPut> {
    const exp = Date.now() + input.ttlSeconds * 1000;
    const sig = this.sign('PUT', input.key, exp);
    return {
      url: `memory://bucket/${encodeURIComponent(input.key)}?exp=${exp}&sig=${sig}`,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresAt: new Date(exp),
    };
  }

  async presignGet(key: string, ttlSeconds: number): Promise<PresignedGet> {
    const exp = Date.now() + ttlSeconds * 1000;
    return {
      url: `memory://bucket/${encodeURIComponent(key)}?exp=${exp}&sig=${this.sign('GET', key, exp)}`,
      expiresAt: new Date(exp),
    };
  }

  async getObject(key: string, maxBytes: number): Promise<Buffer | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    if (obj.length > maxBytes) throw new Error('object too large');
    return obj;
  }

  // ----- test helpers: emulate the bucket enforcing presigned URLs -----
  /** Emulates a client PUT to a presigned URL. Returns the HTTP-like status. */
  put(url: string, body: Buffer, now = Date.now()): number {
    return this.withValidUrl('PUT', url, now, (key) => {
      this.objects.set(key, body);
      return 200;
    });
  }

  /** Emulates a client GET on a presigned URL. 403 for bad signature, 410 once expired. */
  fetch(url: string, now = Date.now()): { status: number; body?: Buffer } {
    let body: Buffer | undefined;
    const status = this.withValidUrl('GET', url, now, (key) => {
      body = this.objects.get(key);
      return body ? 200 : 404;
    });
    return { status, body };
  }

  private withValidUrl(method: string, url: string, now: number, ok: (key: string) => number): number {
    const u = new URL(url);
    const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
    const exp = Number(u.searchParams.get('exp'));
    if (u.searchParams.get('sig') !== this.sign(method, key, exp)) return 403;
    if (now > exp) return 410;
    return ok(key);
  }
}
