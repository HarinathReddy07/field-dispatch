import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';

export interface S3Server {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  stop: () => Promise<void>;
}

/** The object-storage image the compose stack runs; read from there so the test can never drift from it. */
function composeStorageImage(): string {
  const compose = readFileSync(resolve(__dirname, '../../../../infra/docker-compose.yml'), 'utf8');
  const m = /^\s{2}storage:\n\s{4}image:\s*(\S+)/m.exec(compose);
  if (!m) throw new Error('could not find the storage image in infra/docker-compose.yml');
  return m[1]!;
}

/**
 * A REAL S3-compatible server (never an in-process mock).
 *  - TEST_S3_ENDPOINT / TEST_S3_ACCESS_KEY / TEST_S3_SECRET_KEY: use a server you already run;
 *  - otherwise Testcontainers starts the same image as docker-compose (needs Docker).
 * A fresh private bucket is created per call.
 */
export async function startS3Server(): Promise<S3Server> {
  const bucket = `test-${randomBytes(6).toString('hex')}`;
  let endpoint = process.env.TEST_S3_ENDPOINT;
  let accessKey = process.env.TEST_S3_ACCESS_KEY ?? '';
  let secretKey = process.env.TEST_S3_SECRET_KEY ?? '';
  let stop = async (): Promise<void> => undefined;

  if (!endpoint) {
    accessKey = 'testaccess' + randomBytes(4).toString('hex');
    secretKey = randomBytes(16).toString('hex');
    const { GenericContainer, Wait } = await import('testcontainers');
    const container = await new GenericContainer(composeStorageImage())
      .withEnvironment({
        RUSTFS_ACCESS_KEY: accessKey,
        RUSTFS_SECRET_KEY: secretKey,
        RUSTFS_VOLUMES: '/data',
      })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forHttp('/health', 9000).forStatusCode(200))
      .withStartupTimeout(120_000)
      .start();
    endpoint = `http://${container.getHost()}:${container.getMappedPort(9000)}`;
    stop = async () => {
      await container.stop();
    };
  } else if (!accessKey || !secretKey) {
    throw new Error('TEST_S3_ENDPOINT is set but TEST_S3_ACCESS_KEY / TEST_S3_SECRET_KEY are not');
  }

  const admin = new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
  await admin.send(new CreateBucketCommand({ Bucket: bucket })); // private by default: no policy is ever set
  admin.destroy();
  return { endpoint, accessKey, secretKey, bucket, stop };
}
