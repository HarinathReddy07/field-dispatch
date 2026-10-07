/* eslint-disable @typescript-eslint/no-require-imports */
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { migrate } = require('../../../../infra/scripts/migrate.js') as {
  migrate: (url: string) => Promise<string[]>;
};

export interface TestDb {
  url: string;
  name: string;
  drop(): Promise<void>;
}

/** Creates an isolated, fully migrated database on the shared test PostgreSQL. */
export async function createTestDatabase(): Promise<TestDb> {
  const adminUrl = process.env.TEST_ADMIN_DATABASE_URL;
  if (!adminUrl) throw new Error('TEST_ADMIN_DATABASE_URL is not set (global setup did not run)');
  const name = `t_${randomBytes(6).toString('hex')}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const u = new URL(adminUrl);
  u.pathname = `/${name}`;
  const url = u.toString();
  await migrate(url);
  return {
    url,
    name,
    async drop() {
      const a = new Client({ connectionString: adminUrl });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await a.end();
    },
  };
}
