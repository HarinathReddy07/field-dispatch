import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_TYPE: z.enum(['mongodb', 'postgresql']).default('mongodb'),
  MONGODB_URI: z.string().optional(),
  MONGODB_DB: z.string().default('field_dispatch'),
  DEMO_ADMIN_EMAIL: z.string().optional(),
  DEMO_ADMIN_PASSWORD: z.string().optional(),
  DEMO_TECH_EMAIL: z.string().optional(),
  DEMO_TECH_PASSWORD: z.string().optional(),
  DEMO_CUSTOMER_EMAIL: z.string().optional(),
  DEMO_CUSTOMER_PASSWORD: z.string().optional(),
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
  /** OpenAPI/Swagger UI at /api/docs. Off unless explicitly enabled. */
  SWAGGER_ENABLED: bool.default('false'),
  /**
   * Plain HTTP/WS is allowed ONLY when this is true (local development / the trial docker-compose profile).
   * Default false = deployable profile: the API refuses non-HTTPS requests and non-WSS socket handshakes
   * (TLS is terminated by a reverse proxy that sets X-Forwarded-Proto), and https origins are required.
   */
  INSECURE_LOCAL_DEV: bool.default('false'),
  /** Outbox publisher + review sweeper. Tests may disable and drive them manually. */
  BACKGROUND_JOBS: bool.default('true'),
});

const isHttps = (u: string): boolean => /^https:\/\//i.test(u.trim());

export const EnvSchema = BaseEnvSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && env.STORAGE_PROVIDER === 'memory') {
    ctx.addIssue({
      code: 'custom',
      path: ['STORAGE_PROVIDER'],
      message: 'the in-memory storage mock must not be used when NODE_ENV=production',
    });
  }
  if (env.INSECURE_LOCAL_DEV) return;
  // Deployable profile: every browser/device-facing address must be HTTPS/WSS.
  for (const origin of env.CORS_ORIGINS.split(',').filter((o) => o.trim())) {
    if (!isHttps(origin)) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'must list https:// origins only (or set INSECURE_LOCAL_DEV=true for local development)',
      });
      break;
    }
  }
  if (env.S3_PUBLIC_ENDPOINT && !isHttps(env.S3_PUBLIC_ENDPOINT)) {
    ctx.addIssue({
      code: 'custom',
      path: ['S3_PUBLIC_ENDPOINT'],
      message: 'presigned URLs handed to devices must be https:// (or set INSECURE_LOCAL_DEV=true)',
    });
  }
});
export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    // Names and reasons only: never echo values (they may be secrets).
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(
      `Invalid environment configuration:\n${lines.join('\n')}\nSee .env.example for every variable.`,
    );
  }
  return parsed.data;
}
