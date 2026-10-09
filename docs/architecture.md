# Architecture

Field Asset Inspection & Repair Dispatch: a vertical slice of a real-time, location-aware, multi-role platform.
Requirements: [`docs/spec/SPEC.md`](spec/SPEC.md) (client spec) with the state-machine decision in [ADR 0006](adr/0006-spec-state-machine.md). Status: [`STATUS.md`](STATUS.md).

## Context

```mermaid
flowchart LR
  M[Mobile app<br/>React Native + Expo<br/>Requester + Technician] -- HTTPS JSON --> API
  A[Admin console<br/>Next.js + Tailwind] -- same-origin gateway --> API
  M <-. Socket.io .-> API
  A <-. Socket.io .-> API
  API[NestJS API<br/>REST + Socket.io] --> PG[(PostgreSQL + PostGIS<br/>system of record)]
  API --> R[(Redis<br/>throttling windows, presence,<br/>location cache, socket adapter)]
  API --> S[(S3-compatible storage<br/>RustFS, private bucket)]
```

- **PostgreSQL is the single source of truth** for every business fact. Redis holds only ephemeral data and is never the only copy of a transaction.
  What Redis holds, with the exact keys and lifetimes:

  | Key / use                                | TTL                                      | Purpose                                                              |
  | ---------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
  | `thr:{login\|arrive\|default}:{subject}` | 60 s fixed window                        | rate limits (login and OTP arrival **fail closed** if Redis is down) |
  | `presence:{technicianId}`                | 90 s                                     | technician presence                                                  |
  | `loc:{technicianId}`                     | 120 s                                    | latest simulated GPS sample                                          |
  | `locpersist:{technicianId}`              | `LOCATION_PERSIST_INTERVAL_SECONDS` (NX) | gate so Postgres only gets the last trusted fix every N seconds      |
  | Socket.io pub/sub channels               | n/a                                      | fan-out to sockets on every API instance (Redis adapter)             |

  **OTP TTL and idempotency are deliberately authoritative in PostgreSQL**, not Redis: the OTP challenge row carries `expires_at`, `attempts`,
  `consumed_at` and the HMAC, and the idempotency record is written in the same transaction as the business change (ADR 0005). The spec's own rule
  (§4.4) is that Redis is "never the only copy of a business transaction"; a Redis flush must not be able to resurrect a consumed code or repeat a
  settlement. Redis therefore supplies presence, location cache, rate-limit TTL windows and cross-instance socket delivery.

- Clients never decide role, state, price, time or timer. The API does, and clients render what it returns.

## Backend modules (`apps/api/src`)

| Module (`modules/`) | Responsibility (spec §4.1)                                                                                                 | Must not contain / notes                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `auth`              | login, refresh rotation, `AccessGuard` (authenticate → role → throttle)                                                    | no booking rules; argon2id, short-lived JWT, hashed rotating refresh  |
| `users`             | role-safe profile (`/users/me`)                                                                                            | never exposes password hashes, status flags or other users' data      |
| `requests`          | create / edit / history / snapshot / reorder, `AccessService` (ownership), `RequestsRepository` (all SQL)                  | no socket code                                                        |
| `dispatch`          | `DispatchService` (PostGIS candidate search, atomic confirm), `AssignmentsService`; routes `nearby-technicians`, `confirm` | no UI formatting                                                      |
| `jobs`              | `JobsService` (start / stop / review / cancel / complete), `SweeperService` (review timeout)                               | no identity-verification integration                                  |
| `otp`               | `OtpService`: generate (`crypto.randomInt`), HMAC, store, verify with TTL, single use, attempt lock                        | never persists or logs the plain code                                 |
| `media`             | `MediaService` (intent, key generation, finalize, signed read) + `storage/` adapters (S3-compatible, in-memory mock)       | no public-bucket assumption; ownership checked before signing         |
| `settlement`        | `SettlementService` (one row per request, idempotent) + `payment/` mock provider                                           | no real payment-provider calls                                        |
| `audit`             | `AuditService`: append-only `audit_logs` writer                                                                            | cannot edit or delete history (DB triggers also refuse UPDATE/DELETE) |
| `realtime`          | `RealtimeGateway` (JWT handshake, room auth), `OutboxPublisher`, Redis adapter                                             | never writes business data                                            |
| `admin`             | operational queries + privileged commands (reassign / cancel)                                                              | goes through `TransitionService`; never bypasses state rules          |
| `technicians`       | availability, location ingestion (Redis latest + throttled Postgres persist); `LocationProvider` is a mock interface       | supporting module (the spec's list of 11 above plus this one)         |
| `health`            | liveness / readiness probes                                                                                                |                                                                       |
| `infra/` (global)   | `TransitionService`, `OutboxService`, `IdempotencyService`, Prisma and Redis clients                                       | shared kernel, no HTTP surface                                        |
| `domain/`           | pure functions: pricing, ranking, OTP policy, media sniffing, exception flags, hashing                                     | 100 % unit-tested                                                     |

The 11 modules of spec §4.1 map as: AuthModule → `auth`, UserModule → `users`, RequestModule → `requests`, DispatchModule → `dispatch`, JobModule → `jobs`,
OtpModule → `otp`, RealtimeModule → `realtime`, MediaModule → `media`, SettlementModule → `settlement`, AuditModule → `audit`, AdminModule → `admin`.
Each is a separate Nest module (`*.module.ts`) importing only what it needs; the dependency graph is acyclic (`dispatch` → `requests`; `otp`, `media` → `dispatch`, `requests`; `jobs` → all of them; `admin` → `jobs`, `dispatch`, `media`, `requests`).

Layering: controller (DTOs only) → service (transaction + orchestration) → domain (pure rules) → SQL. The state machine itself is
a pure table in `packages/contracts` shared by API, admin and mobile.

## State machine (requirement spec §2)

Single table: [`packages/contracts/src/state-machine.ts`](../packages/contracts/src/state-machine.ts). Illegal transition → `409 ILLEGAL_TRANSITION`.
Every accepted transition writes a `job_events` row and an `audit_logs` row **in the same transaction**, and queues a `request.state.changed` outbox event.

```mermaid
stateDiagram-v2
  [*] --> DRAFT: create
  DRAFT --> REQUESTED: submit
  REQUESTED --> DRAFT: edit
  REQUESTED --> MATCHED: nearest-technician search
  MATCHED --> CONFIRMED: confirm (atomic)
  CONFIRMED --> REQUESTED: requester cancels booking
  CONFIRMED --> ARRIVED: technician submits OTP
  ARRIVED --> IN_PROGRESS: start (server timestamp)
  IN_PROGRESS --> PROOF_UPLOADED: stop (>= 2 proofs)
  REWORK --> PROOF_UPLOADED: stop (>= 2 NEW proofs)
  PROOF_UPLOADED --> UNDER_REVIEW: auto (review_deadline_at set)
  UNDER_REVIEW --> COMPLETED: approve | timeout (sweeper)
  COMPLETED --> SETTLED: mock settlement (same transaction)
  UNDER_REVIEW --> REWORK: request rework (reason, new work cycle)
  DRAFT --> CANCELLED: requester
  REQUESTED --> CANCELLED: requester
  MATCHED --> CANCELLED: requester
  CONFIRMED --> CANCELLED: admin
  IN_PROGRESS --> CANCELLED: admin
  CONFIRMED --> CONFIRMED: admin reassign
```

Admin rows (`ADMIN_CANCEL` from any open state, `ADMIN_REASSIGN` from CONFIRMED/ARRIVED/IN_PROGRESS/REWORK back to CONFIRMED) are explicit table rows with a mandatory reason.

## Data model (ERD)

```mermaid
erDiagram
  users ||--o| technicians : "is"
  users ||--o{ service_requests : "requests"
  service_requests ||--o{ assignments : "has"
  technicians ||--o{ assignments : "works"
  service_requests ||--o{ otp_challenges : "arrival codes"
  service_requests ||--o{ evidence_media : "proof"
  service_requests ||--o{ job_events : "append-only history"
  service_requests ||--o| settlements : "exactly one"
  service_requests ||--o{ outbox_events : "after-commit events"
  users ||--o{ refresh_tokens : "sessions"
  users ||--o{ audit_logs : "actor"
  idempotency_keys }o--|| users : "scope"
```

Migrations: [`infra/migrations`](../infra/migrations). Highlights: `geography(Point,4326)` + GiST indexes, `btree_gist`, check constraints on states, partial unique indexes, an exclusion constraint, append-only triggers.

## Concurrency strategy

| Invariant                                                  | Enforced by                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One technician per OVERLAPPING work period (§7.1)          | row lock on the technician + overlap check on `time_window` + **exclusion constraint** `assignments_no_overlap` (`technician_id =`, `time_window &&`, `WHERE status = 'ACTIVE'`); the trial additionally keeps the stricter product rule "one ACTIVE job per technician" (`assignments_active_technician_uq`, technician flips to BUSY). `migrations.int` proves the exclusion constraint on its own by dropping the stricter index inside a rolled-back transaction |
| One active assignment per request                          | partial unique index `assignments_active_request_uq` + request row lock                                                                                                                                                                                                                                                                                                                                                                                              |
| Two simultaneous confirms → one 200, one deterministic 409 | `SELECT … FOR UPDATE` on request then technician (fixed lock order); loser gets `STATE_CONFLICT` / `TECHNICIAN_UNAVAILABLE`                                                                                                                                                                                                                                                                                                                                          |
| Stale/duplicate commands never overwrite                   | `UPDATE … WHERE id AND version = $expected` after locking the row                                                                                                                                                                                                                                                                                                                                                                                                    |
| OTP consumed once                                          | row lock on the challenge + conditional `UPDATE … WHERE consumed_at IS NULL AND expires_at > now()`                                                                                                                                                                                                                                                                                                                                                                  |
| Failed OTP attempts are counted exactly                    | outcomes are _returned_ (not thrown) so the attempt counter commits; 12 parallel wrong guesses → exactly 5 invalid + lock                                                                                                                                                                                                                                                                                                                                            |
| Exactly one settlement                                     | created inside the completion transaction; `UNIQUE(request_id)` and `UNIQUE(idempotency_key)` as backstop                                                                                                                                                                                                                                                                                                                                                            |
| Retries are safe                                           | `Idempotency-Key` stored **in the same transaction** as the business change (ADR 0005)                                                                                                                                                                                                                                                                                                                                                                               |
| Events only after commit                                   | transactional outbox + publisher with `FOR UPDATE SKIP LOCKED` (ADR 0003)                                                                                                                                                                                                                                                                                                                                                                                            |
| Review timeout survives restarts / multiple instances      | persisted `review_deadline_at` + sweeper claiming rows with `SKIP LOCKED` (ADR 0004)                                                                                                                                                                                                                                                                                                                                                                                 |
| History cannot be rewritten                                | DB triggers reject UPDATE/DELETE/TRUNCATE on `job_events` and `audit_logs`                                                                                                                                                                                                                                                                                                                                                                                           |

## Security model

- AuthN: argon2id; 15-minute HS256 access JWT; opaque refresh token stored hashed, rotated on use, family revoked on reuse. Role/status are re-read from the database on every request (a forged or stale token cannot elevate).
- AuthZ: global `AccessGuard`, **default-deny** (a handler without `@Roles` is rejected). Ownership checks answer `404` for anything the caller may not see (no IDOR oracle). Socket rooms are authorized server-side; reassigned technicians are removed from live rooms.
- Input: zod schemas shared from `packages/contracts`, all `.strict()` (unknown fields rejected); parameterised SQL only; 100 kB body limit; helmet; CORS from env.
- OTP: `crypto.randomInt`, HMAC-SHA256 stored (never the code), TTL, attempt limit + lock, constant-time compare, uniform error text, never logged; the idempotency record uses a _keyed_ hash so it can't be used to brute-force codes.
- Media: server-generated keys, presigned PUT/GET with short TTL, size + SHA-256 + magic-byte verification before a file counts as evidence, ownership checked before signing.
- Logs: allow-list serializer (method, path, status) + redaction; test asserts passwords/OTPs/tokens never appear.
- Admin console: httpOnly + SameSite=Strict cookies, role verified server-side against the API, same-origin gateway allow-lists `admin/*`.

## Data flow (spec Figure 3)

```mermaid
sequenceDiagram
  participant R as Requester app
  participant API as NestJS API
  participant PG as PostgreSQL + PostGIS
  participant RD as Redis
  participant T as Technician app
  participant AD as Admin console
  R->>API: POST /requests (asset, category, location, window)
  API->>PG: INSERT request + job_events + audit (one transaction)
  API-->>AD: request.created (outbox, after commit)
  R->>API: GET /requests/:id/nearby-technicians
  API->>PG: ST_DWithin candidate search (GiST), rank, server quote
  API-->>R: options + quote
  R->>API: POST /confirm (Idempotency-Key)
  API->>PG: lock request, lock technician, INSERT assignment, transition (one transaction)
  API-->>T: assignment.created
  API-->>AD: assignment.created
  R->>API: POST /otp (code shown to requester)
  T->>API: POST /arrive {otp}
  API->>PG: conditional consume of the HMAC challenge, transition ARRIVED
  T->>API: POST /start, evidence intent, upload to object storage, finalize, POST /stop
  T->>API: POST /technicians/me/location (GPS sample)
  API->>RD: latest position + presence (TTL)
  API-->>R: technician.location.updated, request.state.changed
  R->>API: POST /review (approve | rework)
  API->>PG: transition COMPLETED then SETTLED + the single settlement row
  API-->>R: settlement.created
```

## Identity data and operational data (production note)

**In production the identity / KYC data would be separated from operational profiles.** The trial has no KYC at all: no Aadhaar or e-PAN is
collected, users are synthetic, and the `users` table holds only a display name, role, rating and credential hash. A production build would keep
identity documents and verification results in a separate service and datastore (own database, own access policy and retention), exposing only a
verified/not-verified flag and an opaque identity reference to the operational platform. Dispatch, jobs, audit and logs would then never see
identity attributes, and a breach of the operational database would not expose KYC data. The integration point is an interface; the trial leaves it
unimplemented on purpose (spec §6.1 "PII minimization", §12 exclusions).

## Real-time design

- Rooms: `user:{id}`, `request:{id}`, `admin`. Events carry `{eventId, occurredAt, schemaVersion, seq, type, requestId, data}`.
- Clients treat events as _hints_ and refetch over REST; reconnect → refetch (`GET /requests/:id/snapshot?since=` returns the events missed after a cursor plus current state).
- Technician location samples go to Redis (latest + TTL) and are persisted to Postgres at most every `LOCATION_PERSIST_INTERVAL_SECONDS`; only authorized viewers receive `technician.location.updated`.
- Access tokens expire on live sockets: the server disconnects, the client reconnects with a fresh token.

## Assumptions

1. `CANCELLED` is an added terminal state: the spec's diagram has no terminal for requester cancellation before a booking or for admin cancellation.
2. `POST /requests` creates a `DRAFT` and submits it in the same transaction (two events); `PATCH /requests/:id` is `REQUESTED → DRAFT → REQUESTED`.
3. Confirm requires `MATCHED`, i.e. the nearby search happened first (search is a transition, `REQUESTED → MATCHED`).
4. `stop` records `PROOF_UPLOADED` and `UNDER_REVIEW` (two events) in one transaction; `COMPLETED → SETTLED` likewise.
5. A rework opens a new **work cycle** (proofs are counted per cycle; earlier proofs and review events are kept).
6. Money is integer minor units (INR paise); quote = fixed category base + per-km travel, computed only on the server.
7. Technician "freshness": only technicians seen within `LOCATION_FRESHNESS_SECONDS` are matchable (dev default is long so the seeded demo stays fresh).
8. Ratings are static seed values; there is no rating flow in the trial.
9. Evidence count cap: 10 items per work cycle.

## Path to the 25-day product

- Replace mocks behind existing interfaces: `PaymentProvider` (real gateway + payouts), `LocationProvider` (device GPS + background tracking). `StorageProvider` already has a real S3-compatible adapter, tested against a real server.
- Add KYC/identity as a separate service with its own store; keep operational profiles free of identity data.
- Observability: ship the structured logs + correlation ids to a log store, add metrics/alerts; move the sweeper/outbox to dedicated workers if load requires (they are already multi-instance safe).
- Scale-out: API is stateless apart from Redis-backed sockets; add a read replica for admin queries; partition `audit_logs`/`job_events` by time.
- Geo: surge/area matching, ETA from a routing service, geofenced arrival.
- Product: scheduling windows with capacity, cancellations/fees, ratings, push notifications, multi-tenant admin roles.

ADRs: [`docs/adr`](adr).
