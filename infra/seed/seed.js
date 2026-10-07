'use strict';
const { Client } = require('pg');
const argon2 = require('argon2');

/**
 * Idempotent synthetic seed. Fixed UUIDs + upserts mean it can be re-run safely.
 * Demo credentials are DEV-ONLY (see README). No real people, documents or locations.
 */
const DEV_PASSWORD = process.env.SEED_PASSWORD || 'Passw0rd!dev';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const USERS = [
  { id: id(1), email: 'admin@dispatch.test', name: 'Asha Admin', role: 'ADMIN', rating: 0 },
  { id: id(11), email: 'requester1@dispatch.test', name: 'Ravi Requester', role: 'REQUESTER', rating: 0 },
  { id: id(12), email: 'requester2@dispatch.test', name: 'Rhea Requester', role: 'REQUESTER', rating: 0 },
  { id: id(13), email: 'requester3@dispatch.test', name: 'Rohan Requester', role: 'REQUESTER', rating: 0 },
];

const BOTH = ['ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION'];
// availability / freshness variety: fresh, stale, offline, busy, single-category.
const TECHS = [
  {
    n: 21,
    name: 'Anil Kumar',
    rating: 4.8,
    lat: 12.9756,
    lon: 77.6068,
    status: 'AVAILABLE',
    ageMin: 1,
    cats: BOTH,
  }, // MG Road
  {
    n: 22,
    name: 'Bhavna Rao',
    rating: 4.5,
    lat: 12.9784,
    lon: 77.6408,
    status: 'AVAILABLE',
    ageMin: 1,
    cats: [BOTH[0]],
  }, // Indiranagar
  {
    n: 23,
    name: 'Chetan Gowda',
    rating: 4.9,
    lat: 12.9352,
    lon: 77.6245,
    status: 'AVAILABLE',
    ageMin: 2,
    cats: [BOTH[1]],
  }, // Koramangala
  {
    n: 24,
    name: 'Divya Shetty',
    rating: 4.2,
    lat: 12.925,
    lon: 77.5938,
    status: 'AVAILABLE',
    ageMin: 2,
    cats: BOTH,
  }, // Jayanagar
  {
    n: 25,
    name: 'Esha Nair',
    rating: 3.9,
    lat: 12.9116,
    lon: 77.6389,
    status: 'AVAILABLE',
    ageMin: 60 * 24,
    cats: BOTH,
  }, // HSR (STALE)
  {
    n: 26,
    name: 'Farhan Sheikh',
    rating: 4.6,
    lat: 12.9698,
    lon: 77.75,
    status: 'OFFLINE',
    ageMin: 3,
    cats: BOTH,
  }, // Whitefield (OFFLINE)
  {
    n: 27,
    name: 'Gita Menon',
    rating: 4.1,
    lat: 13.1007,
    lon: 77.5963,
    status: 'BUSY',
    ageMin: 1,
    cats: BOTH,
  }, // Yelahanka (BUSY)
  {
    n: 28,
    name: 'Harish Patil',
    rating: 3.6,
    lat: 13.0035,
    lon: 77.5646,
    status: 'AVAILABLE',
    ageMin: 1,
    cats: [BOTH[0]],
  }, // Malleshwaram
];

const REQ_COMPLETED = id(101);
const REQ_FRESH = id(102);
const REQ_BUSY = id(103);

async function seed(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    const hash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });

    const allUsers = [
      ...USERS,
      ...TECHS.map((t) => ({
        id: id(t.n),
        email: `tech${t.n - 20}@dispatch.test`,
        name: t.name,
        role: 'TECHNICIAN',
        rating: t.rating,
      })),
    ];
    for (const u of allUsers) {
      await client.query(
        `INSERT INTO users (id, email, password_hash, role, name, rating)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rating = EXCLUDED.rating, role = EXCLUDED.role`,
        [u.id, u.email, hash, u.role, u.name, u.rating],
      );
    }

    for (const t of TECHS) {
      await client.query(
        `INSERT INTO technicians (user_id, service_categories, availability_status, location, last_seen_at)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, now() - ($6 || ' minutes')::interval)
         ON CONFLICT (user_id) DO UPDATE SET service_categories = EXCLUDED.service_categories,
           availability_status = CASE WHEN technicians.availability_status = 'BUSY'
             AND EXISTS (SELECT 1 FROM assignments a WHERE a.technician_id = technicians.user_id AND a.status = 'ACTIVE')
             THEN 'BUSY' ELSE EXCLUDED.availability_status END,
           location = EXCLUDED.location, last_seen_at = EXCLUDED.last_seen_at`,
        [id(t.n), t.cats, t.status, t.lat, t.lon, String(t.ageMin)],
      );
    }

    // --- 1 completed request (history / reorder demo) with full trail ---
    const exists = await client.query('SELECT 1 FROM service_requests WHERE id = $1', [REQ_COMPLETED]);
    if (exists.rowCount === 0) {
      await client.query(
        `INSERT INTO service_requests (id, requester_id, category, asset_id, location, window_start, window_end, notes,
            state, quote_minor, version, work_cycle, started_at, created_at, updated_at)
         VALUES ($1,$2,'ELECTRICAL_INSPECTION','PANEL-BLR-0042', ST_SetSRID(ST_MakePoint(77.6101, 12.9719),4326)::geography,
            now() - interval '3 days', now() - interval '3 days' + interval '2 hours', 'Synthetic completed inspection',
            'COMPLETED', 52500, 6, 1, now() - interval '3 days' + interval '20 minutes', now() - interval '3 days', now() - interval '3 days')`,
        [REQ_COMPLETED, id(11)],
      );
      await client.query(
        `INSERT INTO assignments (id, request_id, technician_id, status, time_window, quote_minor, confirmed_at, ended_at)
         VALUES ($1,$2,$3,'COMPLETED', tstzrange(now() - interval '3 days', now() - interval '3 days' + interval '2 hours','[)'), 52500,
                 now() - interval '3 days', now() - interval '3 days' + interval '1 hour')`,
        [id(201), REQ_COMPLETED, id(21)],
      );
      const steps = [
        [null, 'CREATED', 'CREATE', 'REQUESTER', id(11)],
        ['CREATED', 'ASSIGNED', 'CONFIRM', 'REQUESTER', id(11)],
        ['ASSIGNED', 'ARRIVED', 'ARRIVE', 'TECHNICIAN', id(21)],
        ['ARRIVED', 'IN_PROGRESS', 'START', 'TECHNICIAN', id(21)],
        ['IN_PROGRESS', 'UNDER_REVIEW', 'STOP', 'TECHNICIAN', id(21)],
        ['UNDER_REVIEW', 'COMPLETED', 'APPROVE', 'REQUESTER', id(11)],
      ];
      for (const [from, to, action, role, actor] of steps) {
        await client.query(
          `INSERT INTO job_events (request_id, state_from, state_to, action, actor_id, actor_role, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,'{"seeded":true}')`,
          [REQ_COMPLETED, from, to, action, actor, role],
        );
        await client.query(
          `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, request_id, metadata)
           VALUES ($1,$2,$3,'service_request',$4::text,$4::uuid,'{"seeded":true}')`,
          [actor, role, `request.${action.toLowerCase()}`, REQ_COMPLETED],
        );
      }
      for (const n of [1, 2]) {
        await client.query(
          `INSERT INTO evidence_media (id, request_id, work_cycle, uploader_id, object_key, content_type, size_bytes,
              checksum_sha256, status, finalized_at)
           VALUES ($1,$2,1,$3,$4,'image/jpeg',1024,$5,'FINALIZED', now() - interval '3 days')`,
          [id(300 + n), REQ_COMPLETED, id(21), `seed/synthetic-${n}.jpg`, 'a'.repeat(64)],
        );
      }
      await client.query(
        `INSERT INTO settlements (id, request_id, amount_minor, idempotency_key, status, provider_ref)
         VALUES ($1,$2,52500,$3,'SETTLED','MOCK-SEED-0001')`,
        [id(401), REQ_COMPLETED, `settle:${REQ_COMPLETED}`],
      );
    }

    // --- 1 fresh request for the live demo (requester1, near MG Road) ---
    await client.query(
      `INSERT INTO service_requests (id, requester_id, category, asset_id, location, window_start, window_end, notes, state)
       VALUES ($1,$2,'ELECTRICAL_INSPECTION','TRANSFORMER-BLR-0107', ST_SetSRID(ST_MakePoint(77.6033, 12.9748),4326)::geography,
          now() + interval '1 hour', now() + interval '3 hours', 'Synthetic live-demo request', 'CREATED')
       ON CONFLICT (id) DO NOTHING`,
      [REQ_FRESH, id(11)],
    );

    // --- busy technician (Gita) has an in-progress job ---
    const busy = await client.query('SELECT 1 FROM service_requests WHERE id = $1', [REQ_BUSY]);
    if (busy.rowCount === 0) {
      await client.query(
        `INSERT INTO service_requests (id, requester_id, category, asset_id, location, window_start, window_end, notes,
            state, quote_minor, version, started_at)
         VALUES ($1,$2,'MECHANICAL_INSPECTION','PUMP-BLR-0311', ST_SetSRID(ST_MakePoint(77.5963, 13.1007),4326)::geography,
            now() - interval '30 minutes', now() + interval '2 hours', 'Synthetic busy-technician job',
            'IN_PROGRESS', 78000, 4, now() - interval '10 minutes')`,
        [REQ_BUSY, id(12)],
      );
      await client.query(
        `INSERT INTO assignments (id, request_id, technician_id, status, time_window, quote_minor)
         VALUES ($1,$2,$3,'ACTIVE', tstzrange(now() - interval '30 minutes', now() + interval '2 hours','[)'), 78000)`,
        [id(202), REQ_BUSY, id(27)],
      );
      for (const [from, to, action, role, actor] of [
        [null, 'CREATED', 'CREATE', 'REQUESTER', id(12)],
        ['CREATED', 'ASSIGNED', 'CONFIRM', 'REQUESTER', id(12)],
        ['ASSIGNED', 'ARRIVED', 'ARRIVE', 'TECHNICIAN', id(27)],
        ['ARRIVED', 'IN_PROGRESS', 'START', 'TECHNICIAN', id(27)],
      ]) {
        await client.query(
          `INSERT INTO job_events (request_id, state_from, state_to, action, actor_id, actor_role, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,'{"seeded":true}')`,
          [REQ_BUSY, from, to, action, actor, role],
        );
      }
    }
    await client.query('COMMIT');
    return { users: allUsers.length, technicians: TECHS.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
}

module.exports = { seed, DEV_PASSWORD, ids: { REQ_COMPLETED, REQ_FRESH, REQ_BUSY, id } };

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  seed(url)
    .then((r) =>
      console.log(`Seeded ${r.users} users (${r.technicians} technicians). Demo password: see README.`),
    )
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
