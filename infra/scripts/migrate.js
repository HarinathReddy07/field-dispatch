/* eslint-disable @typescript-eslint/no-require-imports, no-console */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const LOCK_KEY = 727401; // arbitrary advisory-lock id so concurrent runners serialize

/**
 * Applies pending SQL migrations in filename order, each in its own transaction.
 * Safe to run repeatedly and from several processes at once.
 * @param {string} databaseUrl
 * @returns {Promise<string[]>} names of newly applied migrations
 */
async function migrate(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const applied = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
  return applied;
}

module.exports = { migrate };

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  migrate(url)
    .then((applied) =>
      console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'No pending migrations'),
    )
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
