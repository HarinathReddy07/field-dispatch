import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '@dispatch/config';
import { PresignedGet, PresignedPut, StorageProvider } from './storage.provider';

/** S3-compatible adapter (MinIO in docker compose). The bucket is private; access is via presigned URLs only. */
export class MinioStorageProvider implements StorageProvider {
  readonly isMock = false;
  private readonly internal: S3Client;
  private readonly signer: S3Client;
  private readonly bucket: string;

  constructor(cfg: Env) {
    const common = {
      region: cfg.S3_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.S3_ACCESS_KEY, secretAccessKey: cfg.S3_SECRET_KEY },
    };
    this.bucket = cfg.S3_BUCKET;
    this.internal = new S3Client({ ...common, endpoint: cfg.S3_ENDPOINT });
    // URLs handed to devices must use an address those devices can reach.
    this.signer = new S3Client({ ...common, endpoint: cfg.S3_PUBLIC_ENDPOINT ?? cfg.S3_ENDPOINT });
  }

  async presignPut(input: {
    key: string;
    contentType: string;
    sizeBytes: number;
    ttlSeconds: number;
  }): Promise<PresignedPut> {
    const url = await getSignedUrl(
      this.signer,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.sizeBytes,
      }),
      { expiresIn: input.ttlSeconds, signableHeaders: new Set(['content-type', 'content-length']) },
    );
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
    };
  }

  async presignGet(key: string, ttlSeconds: number): Promise<PresignedGet> {
    const url = await getSignedUrl(this.signer, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
    return { url, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  async getObject(key: string, maxBytes: number): Promise<Buffer | null> {
    try {
      const head = await this.internal.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      if ((head.ContentLength ?? 0) > maxBytes) throw new Error('object too large');
      const res = await this.internal.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return Buffer.from(await res.Body!.transformToByteArray());
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === 'NotFound' || name === 'NoSuchKey') return null;
      throw e;
    }
  }
}
