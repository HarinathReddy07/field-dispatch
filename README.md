# Field Asset Inspection & Repair Dispatch

A working vertical slice of a real-time, location-aware service platform: a requester books the nearest field technician for an asset inspection, the technician is dispatched live,
verifies arrival with a one-time code, works against a **server-driven timer**, uploads evidence, the requester approves or asks for rework, and exactly one mock settlement is recorded,
with concurrency protection, an audit trail and an operations console.

| App                             | Stack                                                                                                                        | Path                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| API                             | NestJS, Socket.io, Prisma + hand-written SQL, PostgreSQL 16 + PostGIS, Redis, S3-compatible storage (RustFS, private bucket) | `apps/api`           |
| Admin console                   | Next.js (App Router) + Tailwind + Leaflet                                                                                    | `apps/admin`         |
| Mobile (Requester + Technician) | React Native (Expo), TanStack Query, Zustand, socket.io-client, expo-secure-store                                            | `apps/mobile`        |
| Shared contracts                | zod DTOs, enums, state machine table, error codes, socket events                                                             | `packages/contracts` |

## Quickstart (fresh clone)

Prerequisites: Docker with Compose v2, GNU make, Node 20+ and pnpm 12 (`npm i -g pnpm@12.10.1`). Nothing else.

```bash
git clone <repo-url> field-dispatch && cd field-dispatch
pnpm install --frozen-lockfile   # tooling for the test suites (the stack itself runs in containers)
make up                          # creates .env with generated secrets, builds, starts postgres+postgis, redis, storage, migrations, api, admin; waits until healthy
make seed                        # synthetic demo data (idempotent)
make test                        # unit + integration suites against real PostgreSQL/PostGIS, Redis and S3-compatible storage
make e2e                         # acceptance scenarios A1-A7 plus the realtime flow
```

- API `http://localhost:3000` · admin console `http://localhost:3001` · storage console `http://localhost:9001` (loopback only).
- `make test` / `make e2e` start their own throw-away PostgreSQL, Redis and storage containers (Testcontainers), so they work alongside `make up`.
  To use servers you already run, set `TEST_ADMIN_DATABASE_URL`, `TEST_REDIS_URL` and `TEST_S3_ENDPOINT`/`TEST_S3_ACCESS_KEY`/`TEST_S3_SECRET_KEY`.
- A real command transcript of a clean-state run is in [docs/clean-start-transcript.md](docs/clean-start-transcript.md).
- Reset everything: `make reset`. Operations, troubleshooting and the no-Docker path: [runbook](docs/runbook.md).

### Seeded logins (development only)

Password for all accounts: `Passw0rd!dev` (set `SEED_PASSWORD` to change it). OTPs are generated at runtime and never seeded.

| Role                | Login                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Admin (web console) | `admin@dispatch.test`                                                                                       |
| Requesters          | `requester1@dispatch.test`, `requester2@dispatch.test`, `requester3@dispatch.test`                          |
| Technicians         | `tech1@dispatch.test` … `tech8@dispatch.test` (tech5 stale, tech6 offline, tech7 busy: matching edge cases) |

`requester1` owns one completed request (history / reorder) and one fresh request. `tech1` (Anil, MG Road, 4.8 ★) is nearest to the default demo location.

## Commands

| Command                                    | Does                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `make up` / `down` / `reset`               | start / stop / stop and delete volumes                                               |
| `make migrate` / `make seed`               | apply SQL migrations / load idempotent demo data                                     |
| `make demo`                                | up + seed + API restarted with a 60 s review timeout (auto-approval is visible)      |
| `make test`                                | all workspaces: contracts, ui-tokens, admin, mobile and the API unit + integration   |
| `make e2e`                                 | scripted A1-A7 acceptance scenarios + realtime                                       |
| `make cov`                                 | coverage gate (domain + dispatch ≥ 90 %)                                             |
| `pnpm lint` · `pnpm typecheck`             | ESLint · TypeScript across every workspace (zero errors)                             |
| `pnpm --filter @dispatch/admin test:smoke` | Playwright browser tests against a running stack                                     |
| `make tls-config` / `tls-up`               | validate / start the HTTPS/WSS deployable profile ([deploy-tls](docs/deploy-tls.md)) |

## Documentation

[Architecture](docs/architecture.md) (modules, state machine, ERD, data flow, assumptions, 25-day path) · [API](docs/api.md) (routes, events, error codes) · [Test plan](docs/test-plan.md) ·
[Runbook](docs/runbook.md) · [Demo script](docs/demo-script.md) (spec Appendix B, steps mapped to A1-A7) · [Compliance matrix](docs/compliance-matrix.md) ·
[Performance](docs/performance.md) · [HTTPS/WSS profile](docs/deploy-tls.md) · [Known limitations](docs/known-limitations.md) · [Status and what needs a human](docs/STATUS.md) ·
[ADRs](docs/adr) · [Changelog](CHANGELOG.md) · [Client spec](docs/spec/SPEC.md).

## Architecture in one screen

- **PostgreSQL is the system of record**; Redis is ephemeral only (rate-limit windows, presence, location cache, socket fan-out).
- **One pure state-machine table** (`packages/contracts`) decides every transition; each accepted transition writes a `job_event` and an `audit_log` **in the same transaction** and queues a socket event in a **transactional outbox** (emitted only after commit).
- **Concurrency**: row locks + version-checked updates, backed by partial unique indexes, an overlap exclusion constraint and `UNIQUE(request_id)` on settlements; `Idempotency-Key` stored in the same transaction.
- **Security**: argon2id + rotating refresh tokens, default-deny role guard, 404 for foreign ids, strict zod validation (unknown fields rejected), HMAC-only OTP storage with attempt lock, verified evidence uploads via presigned URLs, redacted logs with correlation ids, HTTPS/WSS-only unless `INSECURE_LOCAL_DEV=true`.
- **Real time**: Socket.io with JWT handshake, server-authorized rooms (`user:{id}`, `request:{id}`, `admin`), Redis adapter, REST snapshot for reconnect resync.
- **Server authority**: role, state, price, timestamps and timers come from the backend; clients only render.

## Mocks (clearly labelled)

Payments (`MockPaymentProvider`, references read `MOCK-…`), GPS (simulated coordinate stream), KYC/Aadhaar/e-PAN (absent; the production note on separating identity data is in the architecture doc),
and the in-memory storage used by some tests. Everything else in the slice is real. Details: [known limitations](docs/known-limitations.md).
