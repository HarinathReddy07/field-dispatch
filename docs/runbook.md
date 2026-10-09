# Runbook

## 1. Run the stack with Docker (recommended)

Prerequisites: Docker with Compose v2, GNU make, Node 20+ with pnpm 12 (`npm i -g pnpm@12.10.1`), git.

### Start, seed, stop, reset

```bash
git clone <repo-url> field-dispatch && cd field-dispatch
pnpm install --frozen-lockfile  # only needed for the test suites and tooling
make up                         # .env is created with generated secrets if missing; builds images; waits until every service is healthy
make seed                       # idempotent synthetic demo data (safe to repeat)
make down                       # stop (data kept)         make reset   # stop AND delete the database, Redis and object-storage volumes
make logs                       # follow the API log       make migrate # re-apply pending migrations (they also run before the API starts)
make demo                       # up + seed + API restarted with a 60 s review timeout, so auto-approval is quick to show
```

- API `http://localhost:3000` (health `/health/ready`), admin `http://localhost:3001`, storage console `http://localhost:9001` (loopback only). Swagger (`/api/docs`) is off unless `SWAGGER_ENABLED=true`.
- Startup order is enforced with healthchecks: Postgres/Redis/storage healthy → `migrate` and `storage-init` (one-shot) complete → API (healthy on `/health/ready`) → admin.
- Postgres and Redis are published on 127.0.0.1 only. All images are pinned ([ADR 0007](adr/0007-object-storage-image.md)); the app images run as the unprivileged `node` user.
- Reset to a clean state at any time: `make reset && make up && make seed`.

### HTTPS/WSS profile

`make tls-up` layers a pinned Caddy proxy on top and switches the API to HTTPS/WSS-only. See [deploy-tls](deploy-tls.md).

## 2. Run without Docker (what the author used on a machine without Docker)

Requires Node 22+, pnpm 12, PostgreSQL 16 **with PostGIS 3** and Redis (any 5+), and an S3-compatible server for real evidence uploads
(or `STORAGE_PROVIDER=memory`, an in-process **mock** for demos only).

```bash
pnpm install
createdb dispatch                                  # a database whose role can CREATE EXTENSION postgis, btree_gist
export DATABASE_URL=postgres://user:pass@localhost:5432/dispatch REDIS_URL=redis://localhost:6379
export JWT_ACCESS_SECRET=<32+ chars> OTP_HMAC_SECRET=<32+ chars> INSECURE_LOCAL_DEV=true
export S3_ENDPOINT=http://localhost:9000 S3_BUCKET=dispatch-evidence S3_ACCESS_KEY=<key> S3_SECRET_KEY=<secret>   # RustFS/any S3 server; or add STORAGE_PROVIDER=memory
export LOCATION_FRESHNESS_SECONDS=3600                 # seeded technician positions stay "fresh" for an hour (code default: 5 min)
node infra/scripts/migrate.js && node infra/seed/seed.js
(cd apps/api && node scripts/init-storage.js)          # creates the private bucket (skip with STORAGE_PROVIDER=memory)
# shared packages first: dist/ and the generated admin CSS (packages/ui-tokens/css) are not committed
pnpm --filter @dispatch/config --filter @dispatch/contracts --filter @dispatch/ui-tokens build
pnpm --filter @dispatch/api build && node apps/api/dist/main.js        # :3000
cd apps/admin && API_INTERNAL_URL=http://127.0.0.1:3000 PUBLIC_API_URL=http://localhost:3000 ADMIN_COOKIE_SECURE=false \
  npx next build && npx next start -p 3001                                 # :3001
```

To run the test suites without Docker, export `TEST_ADMIN_DATABASE_URL`, `TEST_REDIS_URL` and `TEST_S3_ENDPOINT`, `TEST_S3_ACCESS_KEY`, `TEST_S3_SECRET_KEY` (see `.env.example`).

## 3. Seeded logins (DEV ONLY)

Password for every account: `Passw0rd!dev` (override with `SEED_PASSWORD`). Never use these outside local/trial environments.

| Role       | Email                                                                                                                                                  | Notes                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Admin      | `admin@dispatch.test`                                                                                                                                  | web console only                                                      |
| Requester  | `requester1@dispatch.test` … `requester3@dispatch.test`                                                                                                | requester1 owns a completed request (history/reorder) and a fresh one |
| Technician | `tech1@dispatch.test` Anil (MG Road, 4.8★, both categories)                                                                                            | nearest to the default demo location                                  |
|            | `tech2` Bhavna (Indiranagar, electrical) · `tech3` Chetan (Koramangala, mechanical) · `tech4` Divya (Jayanagar, both)                                  |                                                                       |
|            | `tech5` Esha (**stale**, not matchable) · `tech6` Farhan (**offline**) · `tech7` Gita (**busy**, in a job) · `tech8` Harish (Malleshwaram, electrical) | edge cases for matching                                               |

## 4. Environment variables

All are documented inline in [`.env.example`](../.env.example). The important ones:

| Variable                                                  | Purpose                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `REDIS_URL`                               | data stores (compose overrides host names for the api container)                                                                      |
| `INSECURE_LOCAL_DEV`                                      | `true` = plain HTTP/WS allowed (local only). `false` (default) = HTTPS/WSS only, https origins required ([deploy-tls](deploy-tls.md)) |
| `SWAGGER_ENABLED`                                         | OpenAPI/Swagger UI at `/api/docs`; off unless `true`                                                                                  |
| `JWT_ACCESS_SECRET`, `OTP_HMAC_SECRET`                    | ≥ 32 chars each; generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`                             |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS`   | token lifetimes (900 s / 7 d)                                                                                                         |
| `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_LOCK_SECONDS` | OTP policy (300 / 5 / 300)                                                                                                            |
| `SEARCH_RADIUS_KM`, `LOCATION_FRESHNESS_SECONDS`          | matching radius and technician freshness window                                                                                       |
| `REVIEW_TIMEOUT_SECONDS`, `SWEEPER_INTERVAL_MS`           | auto-approval (600 s default; `make demo` uses 60)                                                                                    |
| `CORS_ORIGINS`                                            | comma-separated browser origins (no wildcard)                                                                                         |
| `S3_*`, `STORAGE_PROVIDER`                                | S3-compatible object storage (RustFS in compose); `S3_PUBLIC_ENDPOINT` is the address devices use in presigned URLs                   |
| `PUBLIC_API_URL`, `ADMIN_COOKIE_SECURE`                   | admin console: browser-facing API URL; `false` only for plain-HTTP local demos                                                        |
| `THROTTLE_*`                                              | Redis-backed rate limits (strict on login and arrive)                                                                                 |
| `BACKGROUND_JOBS`                                         | outbox publisher + sweeper loops (true everywhere except some tests)                                                                  |

Transport: local development uses plain HTTP/WS and must say so with `INSECURE_LOCAL_DEV=true`. A deployable setup keeps the default (`false`), terminates **HTTPS/WSS** at a reverse proxy and sets `ADMIN_COOKIE_SECURE=true` ([deploy-tls](deploy-tls.md)). The API validates every variable at startup and refuses to start with a message naming each bad one (never its value).

## 5. Mobile app (Expo)

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://<host-address>:3000 npx expo start     # Android emulator: http://10.0.2.2:3000
```

- Android emulator reaches the host at `10.0.2.2`; a physical device needs the host's LAN IP (and the API reachable on it; add the origin to `CORS_ORIGINS` only matters for browsers).
- Requires a **development build** or Expo Go for the camera/secure-store modules. In `__DEV__` the technician screens offer _Simulate drive to site_ (simulated GPS stream) and _Pick from gallery_ (for simulators without a camera).
- Presigned upload URLs point at `S3_PUBLIC_ENDPOINT`: set it to an address the device can reach (e.g. `http://<host-address>:9000`).
- Checks that run without a device: `pnpm --filter @dispatch/mobile typecheck && pnpm --filter @dispatch/mobile test`.

## 6. Demonstrating restart resilience (A7)

```bash
make demo
# create a request, book a technician, issue the OTP in the app, then:
docker compose -f infra/docker-compose.yml --env-file .env restart api
# the technician can still arrive with the same OTP; sockets reconnect and the apps resync automatically
```

The same guarantee is automated in `restart.int.spec.ts` (in-process restart against the same database).

## 7. Troubleshooting

| Symptom                                                  | Cause / fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http://localhost:3000` shows `{"code":"NOT_FOUND",...}` | The API port serves JSON only. `GET /` returns a landing document with the links; real endpoints live under `/api/v1`, health at `/health/ready`, Swagger at `/api/docs`, the operations console at `http://localhost:3001`. Any other path outside `/api/v1` is a 404 and is logged as `Unmatched route` with the same `correlationId` the response carries. On an `/api/v1/...` id a `NOT_FOUND` also means "unknown id or not yours" (404, never 403, so ids cannot be probed) |
| `make up` fails on `POSTGRES_PASSWORD`                   | `.env` missing or has an empty value: delete it and run `make up` (it regenerates it from `.env.example`)                                                                                                                                                                                                                                                                                                                                                                         |
| API container restarts                                   | invalid env: the log lists each bad variable with the reason (`Invalid environment configuration: …`); fix those in `.env`                                                                                                                                                                                                                                                                                                                                                        |
| `CREATE EXTENSION postgis` fails                         | database image/instance lacks PostGIS (use `postgis/postgis:16-3.4`)                                                                                                                                                                                                                                                                                                                                                                                                              |
| Nearby search returns nothing                            | seeded technicians are only "fresh" for `LOCATION_FRESHNESS_SECONDS` (default 3600 in `.env.example`); re-run `make seed` to refresh `last_seen_at`, or have technicians go online                                                                                                                                                                                                                                                                                                |
| Admin cannot sign in over plain HTTP                     | set `ADMIN_COOKIE_SECURE=false` (local only)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Evidence upload fails on a device                        | `S3_PUBLIC_ENDPOINT` must be reachable from the device; presigned URLs expire after `S3_PRESIGN_TTL_SECONDS`                                                                                                                                                                                                                                                                                                                                                                      |
| `429 RATE_LIMITED` on login while testing                | wait one minute or raise `THROTTLE_LOGIN_PER_MIN`. `503 SERVICE_UNAVAILABLE` on login means Redis is down (the limiter fails closed)                                                                                                                                                                                                                                                                                                                                              |
| `426 HTTPS_REQUIRED`                                     | the API is in the deployable profile; use https via the proxy or set `INSECURE_LOCAL_DEV=true` for local development                                                                                                                                                                                                                                                                                                                                                              |
| Swagger page is a 404                                    | set `SWAGGER_ENABLED=true`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Storage container unhealthy / uploads fail               | `docker compose -f infra/docker-compose.yml --env-file .env logs storage storage-init`; credentials are `S3_ACCESS_KEY`/`S3_SECRET_KEY` from `.env`; `make reset` recreates the bucket                                                                                                                                                                                                                                                                                            |
| Tests: `TEST_ADMIN_DATABASE_URL is not set`              | start Docker (Testcontainers) or export both `TEST_*` variables                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Windows: `pnpm typecheck` fails in `prisma generate`     | a running API process holds the Prisma engine DLL; stop it                                                                                                                                                                                                                                                                                                                                                                                                                        |
