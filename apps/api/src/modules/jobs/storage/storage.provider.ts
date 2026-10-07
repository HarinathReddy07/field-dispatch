export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export interface PresignedPut {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface PresignedGet {
  url: string;
  expiresAt: Date;
}

/** Private object storage. Keys are server-generated; clients only ever receive short-lived presigned URLs. */
export interface StorageProvider {
  /** true for in-process test doubles; surfaced in logs/docs so mocks are never mistaken for real storage. */
  readonly isMock: boolean;
  presignPut(input: {
    key: string;
    contentType: string;
    sizeBytes: number;
    ttlSeconds: number;
  }): Promise<PresignedPut>;
  presignGet(key: string, ttlSeconds: number): Promise<PresignedGet>;
  /** Returns the stored bytes, or null when the object does not exist. Rejects objects above maxBytes. */
  getObject(key: string, maxBytes: number): Promise<Buffer | null>;
}
