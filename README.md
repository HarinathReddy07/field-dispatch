# Field Asset Inspection & Repair Dispatch

A working vertical slice of a real-time, location-aware service platform: a requester books the nearest field technician for an asset inspection, the technician is dispatched live,
verifies arrival with a one-time code, works against a **server-driven timer**, uploads evidence, the requester approves or asks for rework, and exactly one mock settlement is recorded —
with concurrency protection, an audit trail and an operations console.

| App                             | Stack                                                                                                       | Path                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------- |
| API                             | NestJS, Socket.io, Prisma + hand-written SQL, PostgreSQL 16 + PostGIS, Redis, S3-compatible storage (MinIO) | `apps/api`           |
| Admin console                   | Next.js (App Router) + Tailwind + Leaflet                                                                   | `apps/admin`         |
| Mobile (Requester + Technician) | React Native (Expo), TanStack Query, Zustand, socket.io-client, expo-secure-store                           | `apps/mobile`        |
| Shared contracts                | zod DTOs, enums, state machine table, error codes, socket events                                            | `packages/contracts` |

Docs: [architecture](docs/architecture.md) · [API](docs/api.md) · [test plan](docs/test-plan.md) · [runbook](docs/runbook.md) · [demo script](docs/demo-script.md) · [known limitations](docs/known-limitations.md) · [ADRs](docs/adr) · [status: done / still to do](docs/STATUS.md).

## Quickstart (Docker)

```bash
git clone <repo-url> field-dispatch && cd field-dispatch
cp .env.example .env     # replace every CHANGE_ME
make up                  # postgis + redis + minio + migrations + api + admin
make seed                # synthetic demo data
make e2e                 # acceptance scenarios A1-A7 (needs Docker for Testcontainers, or TEST_* env vars)
```

API `http://localhost:3000` (Swagger `/api/docs`) · admin `http://localhost:3001` · MinIO console `http://localhost:9001`.
Full steps, environment variables, mobile setup and troubleshooting: [runbook](docs/runbook.md).

### Demo accounts (development only)

Password for all: `Passw0rd!dev`.

| Role                | Login                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Admin (web console) | `admin@dispatch.test`                                                                           |
| Requesters          | `requester1@dispatch.test`, `requester2@…`, `requester3@…`                                      |
| Technicians         | `tech1@dispatch.test` … `tech8@…` (tech5 stale, tech6 offline, tech7 busy: matching edge cases) |

## Commands

| Command                        | Does                                                 |
| ------------------------------ | ---------------------------------------------------- |
| `make up` / `down` / `reset`   | start / stop / stop and delete volumes               |
| `make migrate` / `make seed`   | apply SQL migrations / load idempotent demo data     |
| `make demo`                    | up + seed + API restarted with a 60 s review timeout |
| `make test`                    | unit + integration suites (`pnpm test`)              |
| `make cov`                     | coverage gate (domain + dispatch ≥ 90 %)             |
| `make e2e`                     | scripted A1-A7 acceptance scenarios                  |
| `pnpm lint` · `pnpm typecheck` | ESLint · TypeScript across the monorepo              |

How to run each suite and what it proves: [test plan](docs/test-plan.md).

## Architecture in one screen

- **PostgreSQL is the system of record**; Redis is only ephemeral (rate limits, presence, socket fan-out).
- **One pure state-machine table** (`packages/contracts`) decides every transition; each accepted transition writes a `job_event` and an `audit_log` **in the same transaction** and queues a socket event in a **transactional outbox** (emitted only after commit).
- **Concurrency**: row locks + version-checked updates, backed by partial unique indexes, an exclusion constraint and `UNIQUE(request_id)` on settlements; `Idempotency-Key` stored in the same transaction.
- **Security**: argon2id + rotating refresh tokens, default-deny role guard, 404 for foreign ids, strict zod validation (unknown fields rejected), HMAC-only OTP storage with attempt lock, verified evidence uploads via presigned URLs, redacted logs.
- **Real time**: Socket.io with JWT handshake, server-authorized rooms (`user:{id}`, `request:{id}`, `admin`), Redis adapter, REST snapshot for reconnect resync.
- **Server authority**: role, state, price, timestamps and timers come from the backend; clients only render.

## Mocks (clearly labelled)

Payments (`MockPaymentProvider`), GPS (simulated stream), KYC (absent), and the in-memory storage used by tests. Everything else in the slice is real. Details: [known limitations](docs/known-limitations.md).

## Verified command transcript

Run on the author's Windows machine **without Docker**, using locally installed PostgreSQL 16.4 + PostGIS 3.6 and Redis 5 (see [runbook §2](docs/runbook.md#2-run-without-docker-what-the-author-used-on-a-machine-without-docker)).
The Docker path (`make up`) was **not executed on that machine**; see [known limitations](docs/known-limitations.md).

```text
$ node infra/scripts/migrate.js
Applied: 0001_extensions.sql, 0002_core.sql, 0003_job_support.sql, 0004_append_only.sql
$ node infra/seed/seed.js && node infra/seed/seed.js          # run twice: idempotent
Seeded 12 users (8 technicians). Demo password: see README.
Seeded 12 users (8 technicians). Demo password: see README.
$ curl -s http://127.0.0.1:3000/health/ready
{"status":"ok","checks":{"database":true,"redis":true}}
$ pnpm test                                   # whole monorepo
  admin 7 · contracts 776 · mobile 44 · api 142 (15 suites)        all pass
$ pnpm --filter @dispatch/api test:e2e         # make e2e: A1-A7 + realtime
Test Suites: 8 passed, 8 total
Tests:       78 passed, 78 total
$ cd apps/admin && npx playwright test         # against the running API + admin
  ok 1 only admins can sign in; protected pages redirect to login
  ok 2 live board: a new job and its transitions appear without reloading; cancel needs a reason and is audited
  2 passed
$ cd apps/mobile && npx expo export --platform android
Android Bundled (958 modules)  ->  index-….hbc (2.4MB)
```

Counts are refreshed in [`docs/STATUS.md`](docs/STATUS.md) after each slice.
