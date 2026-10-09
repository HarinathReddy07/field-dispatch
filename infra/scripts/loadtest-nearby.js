'use strict';
/**
 * Short, dependency-free load run against GET /api/v1/requests/:id/nearby-technicians (the PostGIS proximity search).
 *
 *   API_URL=http://localhost:3000 CONCURRENCY=20 DURATION_SECONDS=15 node infra/scripts/loadtest-nearby.js
 *
 * Logs in as the seeded requester1, creates one request, then hammers the search from CONCURRENCY parallel loops and
 * reports throughput, latency percentiles and any non-200 answers. Start the API with a high THROTTLE_DEFAULT_PER_MIN,
 * otherwise the rate limiter (correctly) answers 429 and you are measuring the limiter, not the query.
 */
const API = process.env.API_URL ?? 'http://localhost:3000';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const DURATION_MS = Number(process.env.DURATION_SECONDS ?? 15) * 1000;
const EMAIL = process.env.LOAD_EMAIL ?? 'requester1@dispatch.test';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Passw0rd!dev';

async function json(path, init) {
  const res = await fetch(`${API}/api/v1${path}`, init);
  return { status: res.status, body: await res.json().catch(() => null) };
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function main() {
  const login = await json('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (login.status !== 200) throw new Error(`login failed: ${login.status}`);
  const auth = { authorization: `Bearer ${login.body.accessToken}` };

  const start = Date.now() + 3600_000;
  const created = await json('/requests', {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({
      assetId: `LOAD-${Date.now()}`,
      category: 'ELECTRICAL_INSPECTION',
      location: { lat: 12.9748, lon: 77.6033 },
      windowStart: new Date(start).toISOString(),
      windowEnd: new Date(start + 2 * 3600_000).toISOString(),
    }),
  });
  if (created.status !== 201) throw new Error(`create failed: ${created.status}`);
  const url = `/requests/${created.body.id}/nearby-technicians?limit=10`;

  const first = await json(url, { headers: auth }); // moves REQUESTED -> MATCHED once; later calls only read
  if (first.status !== 200) throw new Error(`search failed: ${first.status}`);

  const latencies = [];
  const statuses = new Map();
  const stopAt = Date.now() + DURATION_MS;
  const started = Date.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (Date.now() < stopAt) {
        const t0 = process.hrtime.bigint();
        const res = await fetch(`${API}/api/v1${url}`, { headers: auth });
        await res.arrayBuffer();
        latencies.push(Number(process.hrtime.bigint() - t0) / 1e6);
        statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
      }
    }),
  );
  const seconds = (Date.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  const result = {
    requests: latencies.length,
    concurrency: CONCURRENCY,
    seconds: Number(seconds.toFixed(1)),
    requestsPerSecond: Number((latencies.length / seconds).toFixed(1)),
    latencyMs: {
      min: Number(latencies[0].toFixed(1)),
      p50: Number(percentile(latencies, 50).toFixed(1)),
      p95: Number(percentile(latencies, 95).toFixed(1)),
      p99: Number(percentile(latencies, 99).toFixed(1)),
      max: Number(latencies[latencies.length - 1].toFixed(1)),
    },
    statusCodes: Object.fromEntries(statuses),
    candidatesReturned: first.body.length,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if ([...statuses.keys()].some((s) => s !== 200)) process.exitCode = 2;
}

main().catch((e) => {
  process.stderr.write(`loadtest failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
