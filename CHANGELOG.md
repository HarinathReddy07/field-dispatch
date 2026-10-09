# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0-trial] - 2026-10-09

### Added � Backend (`apps/api`)

- **All 14 trial requirements TR-01..TR-14** implemented and integration-tested against real PostgreSQL 16 + PostGIS 3.4 and Redis 7.
- **State machine** (`packages/contracts/src/state-machine.ts`): pure transition table covering all 12 states; illegal transitions return HTTP 409.
- **Atomic booking confirmation** (`dispatch.service.ts`): row-lock ordering, partial unique index and an overlap exclusion constraint on `assignments`.
- **Arrival OTP** (`otp.service.ts`): HMAC-only storage (`OTP_HMAC_SECRET`), configurable TTL and attempt limit, consumed once under concurrent verify.
- **Proof gating** (`jobs.service.ts#stop`): technician cannot move to UNDER_REVIEW until =2 finalized images exist in the current work cycle.
- **Review-timeout sweeper** (`sweeper.service.ts`): restart-safe `FOR UPDATE SKIP LOCKED`; deadline stored in `review_deadline_at`; configurable via `REVIEW_TIMEOUT_SECONDS`.
- **Idempotent settlement** (`settlement.service.ts`): `UNIQUE(request_id)` prevents duplicate records under any number of retries.
- **Transactional outbox** (`infra/outbox.service.ts`): Socket.io events emitted only after the database transaction commits.
- **PostGIS proximity search** (`dispatch.service.ts#findCandidates`): ST_DWithin on a GiST index with availability, category, freshness and overlap filters.
- **Append-only audit** (`audit.service.ts`): database triggers enforce INSERT-only on `job_events` and `audit_logs`.
- **Correlation IDs** (`CorrelationIdMiddleware`): every HTTP request and its descendant log lines share an `x-correlation-id`.
- **Security**: argon2id passwords, rotating refresh tokens, default-deny `AccessGuard`, strict zod DTOs, HMAC OTP, private S3 bucket with presigned short-lived URLs, `INSECURE_LOCAL_DEV` flag, `requireHttps` middleware, redacted structured logs.
- **Throttle** (`access.guard.ts`): per-IP/user/email rate limits; login and OTP arrival **fail closed** if Redis is down.

### Added � Admin console (`apps/admin`)

- Six required views: dashboard, live job board + map, job detail drawer, technician list, audit view, cancel/reassign with mandatory reason.
- Live updates over Socket.io (no page reload).
- Dark mode, keyboard accessibility, Playwright smoke + axe tests.

### Added � Mobile (`apps/mobile`, Expo)

- Nine required screens for both Requester and Technician roles.
- `expo-secure-store` for token storage; role gating; server-driven timer.
- TanStack Query for data fetching with loading/empty/error states on every screen.
- Component tests for all nine screens.

### Added � Infrastructure

- Docker Compose stack: PostgreSQL 16 + PostGIS, Redis, RustFS (S3-compatible); all images pinned by digest.
- Multi-stage Dockerfiles, non-root user, healthchecks, `depends_on: condition: service_healthy`.
- `make up / down / reset / seed / test / e2e / demo / tls-up` targets.
- GitHub Actions CI: lint, typecheck, tests (real Postgres/Redis/RustFS), Docker clean-start, dependency audit, secret scan.
- TLS/WSS deployable profile via Caddy (`infra/docker-compose.tls.yml`).

### Added � Packages

- `@dispatch/contracts`: zod DTOs, state machine, error codes, socket event types.
- `@dispatch/config`: zod-parsed env schema.
- `@dispatch/ui-tokens`: design tokens used by admin and mobile.

### Added � Docs

- `docs/architecture.md`, `docs/api.md`, `docs/test-plan.md`, `docs/runbook.md`, `docs/demo-script.md`
- `docs/compliance-matrix.md` � every spec item mapped to status and evidence
- `docs/performance.md` � EXPLAIN ANALYZE on the nearby query + load-run results
- `docs/clean-start-transcript.md` � step-by-step clean-start log
- `docs/known-limitations.md` � honest list of mocks and unverified items
- ADRs 0001�0007

### Fixed

- `GET /` root route returned 404; now returns a landing document.
- Unmatched routes bypassed request logger; now logged as `Unmatched route` with correlation ID.
- Removed technician could still read job details; access now requires active assignment or completed job.
- Runbook non-Docker path skipped shared-package build; fixed with explicit build order.
- Playwright suites left confirmed jobs behind; fixed with pre-suite cleanup via admin cancel API.
- ESLint `no-undef` on `fetch` in `infra/scripts/loadtest-nearby.js`; fixed by adding Node 18+ globals to `eslint.config.mjs`.

---

[0.1.0-trial]: https://github.com/your-org/field-dispatch/releases/tag/v0.1.0-trial
