# Runbook

## 1. Run the stack with Docker (recommended)

Prerequisites: Docker with Compose v2, GNU make, git.

```bash
git clone <repo-url> field-dispatch && cd field-dispatch
cp .env.example .env            # then replace every CHANGE_ME (see "Environment")
make up                         # postgres(+PostGIS), redis, minio (+private bucket), migrations, api, admin
make seed                       # idempotent synthetic demo data
```

- API `http://localhost:3000` (Swagger `/api/docs`, health `/health/ready`), admin `http://localhost:3001`, MinIO console `http://localhost:9001`.
- `make migrate` re-applies pending migrations (they also run automatically before the API starts).
- `make demo` = `make up` + `make seed` + restart the API with a **60 s review timeout** so auto-approval is quick to show.
- `make down` stops, `make reset` also deletes volumes (database, Redis, storage).

## 2. Run without Docker (what the author used on a machine without Docker)

Requires Node 22+, pnpm 12, PostgreSQL 16 **with PostGIS 3** and Redis.

```bash
pnpm install
createdb dispatch                                  # a database whose role can CREATE EXTENSION postgis, btree_gist
export DATABASE_URL=postgres://user:pass@localhost:5432/dispatch REDIS_URL=redis://localhost:6379
export JWT_ACCESS_SECRET=<32+ chars> OTP_HMAC_SECRET=<32+ chars>
export S3_ENDPOINT=http://localhost:9000 S3_BUCKET=dispatch-evidence S3_ACCESS_KEY=x S3_SECRET_KEY=y STORAGE_PROVIDER=memory
node infra/scripts/migrate.js && node infra/seed/seed.js
pnpm --filter @dispatch/api build && node apps/api/dist/main.js        # :3000
cd apps/admin && API_INTERNAL_URL=http://127.0.0.1:3000 PUBLIC_API_URL=http://localhost:3000 ADMIN_COOKIE_SECURE=false \
  npx next build && npx next start -p 3001                                 # :3001
```

`STORAGE_PROVIDER=memory` is an in-process **mock** (tests/demo only): evidence uploads need MinIO (`STORAGE_PROVIDER=minio`) to go through real presigned URLs.

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

| Variable                                                  | Purpose                                                                                                   |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `REDIS_URL`                               | data stores (compose overrides host names for the api container)                                          |
| `JWT_ACCESS_SECRET`, `OTP_HMAC_SECRET`                    | ≥ 32 chars each; generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS`   | token lifetimes (900 s / 7 d)                                                                             |
| `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_LOCK_SECONDS` | OTP policy (300 / 5 / 300)                                                                                |
| `SEARCH_RADIUS_KM`, `LOCATION_FRESHNESS_SECONDS`          | matching radius and technician freshness window                                                           |
| `REVIEW_TIMEOUT_SECONDS`, `SWEEPER_INTERVAL_MS`           | auto-approval (600 s default; `make demo` uses 60)                                                        |
| `CORS_ORIGINS`                                            | comma-separated browser origins (no wildcard)                                                             |
| `S3_*`, `STORAGE_PROVIDER`                                | object storage; `S3_PUBLIC_ENDPOINT` is the address devices use in presigned URLs                         |
| `PUBLIC_API_URL`, `ADMIN_COOKIE_SECURE`                   | admin console: browser-facing API URL; `false` only for plain-HTTP local demos                            |
| `THROTTLE_*`                                              | Redis-backed rate limits (strict on login and arrive)                                                     |
| `BACKGROUND_JOBS`                                         | outbox publisher + sweeper loops (true everywhere except some tests)                                      |

Transport: local development uses plain HTTP/WS. A deployable setup must terminate **HTTPS/WSS** in front of the API and admin (reverse proxy) and unset `ADMIN_COOKIE_SECURE`.

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

| Symptom                                              | Cause / fix                                                                                                                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make up` fails on `POSTGRES_PASSWORD`               | `.env` missing: `cp .env.example .env`                                                                                                                                             |
| API container restarts                               | invalid env (`Invalid environment configuration: <keys>`): fix the listed variables                                                                                                |
| `CREATE EXTENSION postgis` fails                     | database image/instance lacks PostGIS (use `postgis/postgis:16-3.4`)                                                                                                               |
| Nearby search returns nothing                        | seeded technicians are only "fresh" for `LOCATION_FRESHNESS_SECONDS` (default 3600 in `.env.example`); re-run `make seed` to refresh `last_seen_at`, or have technicians go online |
| Admin cannot sign in over plain HTTP                 | set `ADMIN_COOKIE_SECURE=false` (local only)                                                                                                                                       |
| Evidence upload fails on a device                    | `S3_PUBLIC_ENDPOINT` must be reachable from the device; presigned URLs expire after `S3_PRESIGN_TTL_SECONDS`                                                                       |
| `429 RATE_LIMITED` on login while testing            | wait one minute or raise `THROTTLE_LOGIN_PER_MIN`                                                                                                                                  |
| Tests: `TEST_ADMIN_DATABASE_URL is not set`          | start Docker (Testcontainers) or export both `TEST_*` variables                                                                                                                    |
| Windows: `pnpm typecheck` fails in `prisma generate` | a running API process holds the Prisma engine DLL; stop it                                                                                                                         |
