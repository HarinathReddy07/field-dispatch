import { loadEnv } from '@dispatch/config';

const base = {
  DATABASE_URL: 'postgres://user:pw@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  OTP_HMAC_SECRET: 'b'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'dispatch-evidence',
  S3_ACCESS_KEY: 'access',
  S3_SECRET_KEY: 'secret',
  INSECURE_LOCAL_DEV: 'true',
};

describe('environment validation (fail fast at startup)', () => {
  it('applies safe defaults: Swagger off, 10-minute review timeout, deployable (secure) transport', () => {
    const env = loadEnv({
      ...base,
      INSECURE_LOCAL_DEV: undefined,
      CORS_ORIGINS: 'https://admin.example.test',
    });
    expect(env.SWAGGER_ENABLED).toBe(false);
    expect(env.INSECURE_LOCAL_DEV).toBe(false);
    expect(env.REVIEW_TIMEOUT_SECONDS).toBe(600);
  });

  it('makes the review timeout configurable from the environment (TR-10)', () => {
    expect(loadEnv({ ...base, REVIEW_TIMEOUT_SECONDS: '60' }).REVIEW_TIMEOUT_SECONDS).toBe(60);
    expect(() => loadEnv({ ...base, REVIEW_TIMEOUT_SECONDS: '0' })).toThrow(/REVIEW_TIMEOUT_SECONDS/);
  });

  it('enables Swagger only when the flag is explicitly true', () => {
    expect(loadEnv({ ...base, SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED).toBe(true);
    expect(loadEnv({ ...base, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(false);
  });

  it('names every missing or invalid variable in one clear message', () => {
    let message = '';
    try {
      loadEnv({ ...base, DATABASE_URL: undefined, REDIS_URL: 'not-a-url' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/^Invalid environment configuration:/);
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('REDIS_URL');
    expect(message).toContain('.env.example');
  });

  it('never echoes secret values in the error', () => {
    const weak = 'too-short-secret-value';
    let message = '';
    try {
      loadEnv({ ...base, JWT_ACCESS_SECRET: weak });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('JWT_ACCESS_SECRET');
    expect(message).not.toContain(weak);
  });

  it('refuses http origins unless INSECURE_LOCAL_DEV=true (HTTPS/WSS deployable profile)', () => {
    const secure = { ...base, INSECURE_LOCAL_DEV: 'false' };
    expect(() => loadEnv({ ...secure, CORS_ORIGINS: 'http://localhost:3001' })).toThrow(/CORS_ORIGINS/);
    expect(() =>
      loadEnv({ ...secure, CORS_ORIGINS: 'https://admin.example.test', S3_PUBLIC_ENDPOINT: 'http://x:9000' }),
    ).toThrow(/S3_PUBLIC_ENDPOINT/);
    const ok = loadEnv({
      ...secure,
      CORS_ORIGINS: 'https://admin.example.test, https://ops.example.test',
      S3_PUBLIC_ENDPOINT: 'https://storage.example.test',
    });
    expect(ok.INSECURE_LOCAL_DEV).toBe(false);
    expect(loadEnv({ ...base, CORS_ORIGINS: 'http://localhost:3001' }).INSECURE_LOCAL_DEV).toBe(true);
  });

  it('never allows the in-memory storage mock in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', STORAGE_PROVIDER: 'memory' })).toThrow(
      /STORAGE_PROVIDER/,
    );
    expect(loadEnv({ ...base, NODE_ENV: 'test', STORAGE_PROVIDER: 'memory' }).STORAGE_PROVIDER).toBe(
      'memory',
    );
  });
});
