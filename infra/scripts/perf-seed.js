'use strict';
/**
 * Performance fixture: adds N synthetic technicians scattered over a ~220 km x 220 km box around Bengaluru, so the
 * PostGIS proximity query can be measured on realistic volume (see docs/performance.md).
 *
 *   DATABASE_URL=postgres://... node infra/scripts/perf-seed.js [count=50000]
 *
 * Run after `node infra/scripts/migrate.js && node infra/seed/seed.js`. Idempotent per count (re-running replaces the
 * previous synthetic rows). Synthetic data only; never run against anything but a throw-away database.
 */
const { Client } = require('pg');

const count = Number(process.argv[2] ?? 50000);
if (!process.env.DATABASE_URL) {
  process.stderr.write('perf-seed: DATABASE_URL is required\n');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM technicians WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'perf%@dispatch.test')`,
    );
    await client.query(`DELETE FROM users WHERE email LIKE 'perf%@dispatch.test'`);
    await client.query(
      `INSERT INTO users (id, email, password_hash, role, name, rating)
       SELECT gen_random_uuid(), 'perf' || g || '@dispatch.test',
              (SELECT password_hash FROM users WHERE role = 'ADMIN' LIMIT 1),
              'TECHNICIAN', 'Perf Technician ' || g, round((3 + random() * 2)::numeric, 1)
       FROM generate_series(1, $1::int) g`,
      [count],
    );
    await client.query(
      `INSERT INTO technicians (user_id, service_categories, availability_status, location, last_seen_at)
       SELECT id,
              CASE WHEN random() < 0.4 THEN ARRAY['ELECTRICAL_INSPECTION']
                   WHEN random() < 0.7 THEN ARRAY['MECHANICAL_INSPECTION']
                   ELSE ARRAY['ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION'] END,
              CASE WHEN random() < 0.85 THEN 'AVAILABLE' ELSE 'OFFLINE' END,
              ST_SetSRID(ST_MakePoint(76.6 + random() * 2, 11.9 + random() * 2), 4326)::geography,
              now() - (random() * interval '10 minutes')
       FROM users WHERE email LIKE 'perf%@dispatch.test'`,
    );
    await client.query('COMMIT');
    await client.query('ANALYZE technicians');
    await client.query('ANALYZE users');
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM technicians`);
    process.stdout.write(`perf-seed: ${rows[0].n} technicians in the table (including the demo seed)\n`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  process.stderr.write(`perf-seed failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
