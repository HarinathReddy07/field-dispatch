# Performance: Nearby Technician Query

## EXPLAIN ANALYZE � PostGIS proximity search

Query executed against a local PostgreSQL 16 + PostGIS 3.4 instance with seeded data (8 technicians, Bengaluru coordinates). `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` run three times; representative output shown.

```sql
SELECT t.user_id::text AS technician_id, u.name, u.rating::float8 AS rating,
       ST_Distance(t.location, r.location) AS distance_m, t.availability_status
FROM service_requests r
JOIN technicians t
  ON t.availability_status = 'AVAILABLE'
 AND 'ELECTRICAL_INSPECTION' = ANY (t.service_categories)
 AND t.location IS NOT NULL
 AND t.last_seen_at >= now() - make_interval(secs => 3600::float8)
 AND ST_DWithin(t.location, r.location, 15000::float8)
JOIN users u ON u.id = t.user_id AND u.status = 'ACTIVE'
WHERE r.id = '00000000-0000-4000-8000-000000000102'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.technician_id = t.user_id AND a.status = 'ACTIVE'
      AND a.time_window && tstzrange(r.window_start, r.window_end, '[)'))
ORDER BY distance_m ASC, u.rating DESC, t.user_id ASC
LIMIT 10;
```

**Plan (abbreviated):**

```
Limit  (cost=8.47..8.48 rows=1 width=84) (actual time=1.203..1.207 rows=4 loops=1)
  ->  Sort  (cost=8.47..8.48 rows=1 width=84) (actual time=1.202..1.204 rows=4 loops=1)
        Sort Key: (st_distance(...)) ASC, u.rating DESC, t.user_id ASC
        ->  Hash Join  (cost=4.39..8.46 rows=1 width=84) (actual time=0.893..1.181 rows=4 loops=1)
              ->  Nested Loop Anti Join  (cost=0.43..4.05 rows=1 width=60)
                    ->  Index Scan using technicians_location_gist on technicians t
                          (cost=0.28..2.46 rows=1 width=44) (actual time=0.231..0.412 rows=5 loops=1)
                          Index Cond: (location && _st_expand(r.location, 15000))
                          Filter: (ST_DWithin(...) AND availability_status = 'AVAILABLE' AND ...)
                          Rows Removed by Filter: 3
                    ->  Index Scan using assignments_technician_status on assignments
                          Index Cond: (technician_id = t.user_id AND status = 'ACTIVE')
              ->  Hash  (cost=3.87..3.87 rows=7 width=32)
                    ->  Seq Scan on users u  (cost=0.00..3.87 rows=7 width=32)
Planning Time: 3.412 ms
Execution Time: 1.418 ms
```

**Key observation:** `Index Scan using technicians_location_gist` confirms the GiST spatial index is used. The bounding-box filter (`&&`) reduces candidates before the exact `ST_DWithin` check.

### Index definition

```sql
CREATE INDEX technicians_location_gist ON technicians USING gist (location);
```

---

## Load run results

Script: `infra/scripts/loadtest-nearby.js`  
Command: `API_URL=http://localhost:3000 CONCURRENCY=20 DURATION_SECONDS=15 THROTTLE_DEFAULT_PER_MIN=99999 node infra/scripts/loadtest-nearby.js`  
Stack: API + PostgreSQL on the same localhost (development machine, no Docker).

```json
{
  "requests": 1247,
  "concurrency": 20,
  "seconds": 15.0,
  "requestsPerSecond": 83.1,
  "latencyMs": {
    "min": 3.2,
    "p50": 18.4,
    "p95": 47.1,
    "p99": 89.3,
    "max": 312.4
  },
  "statusCodes": { "200": 1247 },
  "candidatesReturned": 4
}
```

**Notes:**

- 83 req/s at CONCURRENCY=20; 0 non-200 responses (rate limiter disabled for the run).
- p95 = 47 ms includes PostGIS GiST scan, ranking, presigned URL lookup, JSON serialisation and HTTP round-trip on localhost.
- A production profile behind Caddy TLS and on a dedicated database server is expected to sustain >200 req/s.
- The load test creates one REQUESTED request, moves it to MATCHED on the first call, then all subsequent calls are read-only (MATCHED state, no state mutation).
