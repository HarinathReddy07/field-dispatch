/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';
/**
 * Provides a real PostgreSQL/PostGIS and Redis for integration tests.
 * - If TEST_ADMIN_DATABASE_URL and TEST_REDIS_URL are set, those are used (no Docker needed).
 * - Otherwise Testcontainers starts postgis/postgis:16-3.4 and redis:7-alpine.
 */
module.exports = async () => {
  if (process.env.TEST_ADMIN_DATABASE_URL && process.env.TEST_REDIS_URL) return;
  const { PostgreSqlContainer } = require('@testcontainers/postgresql');
  const { RedisContainer } = require('@testcontainers/redis');
  const pg = await new PostgreSqlContainer('postgis/postgis:16-3.4').start();
  const redis = await new RedisContainer('redis:7-alpine').start();
  process.env.TEST_ADMIN_DATABASE_URL = pg.getConnectionUri();
  process.env.TEST_REDIS_URL = redis.getConnectionUrl();
  globalThis.__TEST_CONTAINERS__ = [pg, redis];
};
