'use strict';
/**
 * One-shot storage bootstrap: waits for the S3-compatible server and creates the PRIVATE evidence bucket.
 * Idempotent. No bucket policy is ever set, so anonymous access stays denied; clients only ever receive
 * short-lived presigned URLs from the API.
 *
 *   S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY   (same variables the API uses)
 */
const { CreateBucketCommand, HeadBucketCommand, S3Client } = require('@aws-sdk/client-s3');

const required = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  process.stderr.write(`init-storage: missing environment variables: ${missing.join(', ')}\n`);
  process.exit(1);
}

const bucket = process.env.S3_BUCKET;
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (e) {
    const status = e && e.$metadata && e.$metadata.httpStatusCode;
    if (status === 404 || (e && (e.name === 'NotFound' || e.name === 'NoSuchBucket'))) return false;
    throw e;
  }
}

async function main() {
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      if (await exists()) {
        process.stdout.write(`init-storage: bucket "${bucket}" already exists (private)\n`);
        return;
      }
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      process.stdout.write(`init-storage: created private bucket "${bucket}"\n`);
      return;
    } catch (e) {
      const code = e && e.$metadata && e.$metadata.httpStatusCode;
      if (code === 403) throw new Error('storage rejected the credentials (S3_ACCESS_KEY / S3_SECRET_KEY)');
      if (Date.now() > deadline) throw e;
      await sleep(2000); // server still starting
    }
  }
}

main().catch((e) => {
  process.stderr.write(`init-storage failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
