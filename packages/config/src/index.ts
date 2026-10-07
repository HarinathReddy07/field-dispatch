import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),
  OTP_HMAC_SECRET: z.string().min(32),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_LOCK_SECONDS: z.coerce.number().int().positive().default(300),
  SEARCH_RADIUS_KM: z.coerce.number().positive().default(15),
  LOCATION_FRESHNESS_SECONDS: z.coerce.number().int().positive().default(300),
  REVIEW_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(600),
  SWEEPER_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  OUTBOX_POLL_MS: z.coerce.number().int().positive().default(500),
  LOCATION_PERSIST_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:3001'),
  THROTTLE_LOGIN_PER_MIN: z.coerce.number().int().positive().default(10),
  THROTTLE_ARRIVE_PER_MIN: z.coerce.number().int().positive().default(10),
  THROTTLE_DEFAULT_PER_MIN: z.coerce.number().int().positive().default(300),
  S3_ENDPOINT: z.string().url(),
  /** Endpoint embedded in presigned URLs (what clients can reach). Defaults to S3_ENDPOINT. */
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_PRESIGN_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  STORAGE_PROVIDER: z.enum(['minio', 'memory']).default('minio'),
  SWAGGER_ENABLED: bool.default('true'),
  /** Outbox publisher + review sweeper. Tests may disable and drive them manually. */
  BACKGROUND_JOBS: bool.default('true'),
});
export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration: ${keys}`);
  }
  return parsed.data;
}
