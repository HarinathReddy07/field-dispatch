# Status: what is done and what is left

Updated 2026-10-08 · branch `feat/ui`. Every "done" line below was proven by running something against a live stack
(native PostgreSQL 16 + PostGIS 3.6, Redis 5, Node 24; the development machine has no Docker). An independent
check-by-check pass found **73 of 89 items built and verified, 15 partial, 1 missing, 0 fake** (counted after the latest fixes); the partials are almost all "written but never executed on the target platform" (Docker, a phone, real MinIO).

## At a glance

| Area                                                                                                                                                 | State                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| API: login, requests, PostGIS nearby search, atomic confirm, OTP arrival, server timer, 2-image gate, review/rework, auto-approve, settlement, audit | **Done, tested**                                                     |
| Real time: all 8 socket events, room authorisation, reconnect resync                                                                                 | **Done, tested**                                                     |
| Security (default-deny guard, strict DTOs, IDOR hiding, OTP hardening, redacted logs) and concurrency (locks, version check, idempotency)            | **Done, tested**                                                     |
| Admin console: dashboard, live board + map, job drawer, technicians, audit, reason-gated cancel/reassign, dark mode                                  | **Done**, exercised in a browser (Playwright + axe)                  |
| Shared packages: `contracts` (DTOs, state machine, events), `config`, `ui-tokens` (design tokens used by admin and mobile)                           | **Done**                                                             |
| Mobile app (requester + technician, 9 screens, secure token storage, server-driven timer)                                                            | **Code complete and unit-tested; never run on a device or emulator** |
| Docker stack (compose, Dockerfiles, Makefile, CI workflows)                                                                                          | **Written, never executed** (no Docker on the dev machine)           |
| Docs (architecture, API, test plan, runbook, demo script, ADRs, known limitations)                                                                   | **Done**                                                             |

## Done

**Backend** (`apps/api`): the 14 trial requirements TR-01 to TR-14; one pure state machine (DRAFT, REQUESTED, MATCHED, CONFIRMED, ARRIVED, IN_PROGRESS,
PROOF_UPLOADED, UNDER_REVIEW, REWORK, COMPLETED, SETTLED plus CANCELLED) where every transition writes `job_events`, `audit_logs` and an outbox event in one transaction;
`SELECT … FOR UPDATE` plus a version-checked update, partial unique indexes, an exclusion constraint and `UNIQUE(request_id)` on settlements;
OTP stored only as an HMAC, 6-digit, TTL, single-use, attempt lock; presigned evidence upload with size, checksum and magic-byte verification;
a restart-safe review sweeper (`SKIP LOCKED`) and transactional outbox; append-only audit tables enforced by triggers.

**Admin console** (`apps/admin`): six views plus the job drawer, live updates over Socket.io without reload, cancel/reassign that need a reason (recorded in the audit log), keyboard-accessible, light/dark.

**Mobile** (`apps/mobile`, Expo): login, home (both roles), create request, nearby technicians, booking confirmation, arrival (requester shows OTP, technician enters it), active job with a server-clock timer, evidence capture with progress/retry, review with a rework reason sheet, history and receipt (settlement labelled "Mock settlement").

**Tests that pass** (run on this branch): contracts 776 · ui-tokens 60 · API 146 tests in 16 suites against real PostgreSQL/PostGIS and Redis · admin unit 6 · mobile 44 ·
admin Playwright (smoke, axe accessibility on 7 pages × light/dark × desktop/phone, keyboard focus, reason gates).
An independent HTTP + Socket.io driver (93 live checks, rerun after the fixes below: 93 pass) ran acceptance scenarios A1 to A7 against a freshly migrated database: all 7 behaved correctly (happy path, rework with history kept, wrong/expired/replayed OTP and brute-force lock, parallel confirms with exactly one winner, IDOR and role tampering, exactly one settlement under retries, API killed mid-job and mid-review).

## Fixed in the latest pass

| Problem                                                                                                                                                          | Fix                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening `http://localhost:3000` showed `{"code":"NOT_FOUND","message":"Resource not found",…}`. The API had no route at `/`; it serves JSON under `/api/v1` only | `GET /` now returns a landing document with the links (`/api/v1`, `/health/ready`, `/api/docs`). Unknown paths still return the standard 404 envelope          |
| That 404 could not be traced: requests outside `/api/v1` bypassed the request logger, so its `correlationId` appeared in no log                                  | Such 404s are now logged as `Unmatched route` with method, path and the same `correlationId`                                                                   |
| A technician removed by an admin reassign (or released by the requester) could still read the job, its snapshot and fresh evidence URLs                          | Read access now requires the active assignment (or having completed the job); technician history lists completed jobs only. Covered by new integration tests   |
| Runbook non-Docker path skipped the shared-package build, so a fresh clone could not build the API or admin                                                      | Runbook §2 builds `config`, `contracts` and `ui-tokens` first and sets a 1-hour location freshness window; troubleshooting table explains the `NOT_FOUND` page |
| QA suites left confirmed jobs behind, starving the next run of technicians                                                                                       | The Playwright suites cancel their own leftover `UI-…` / `E2E-…` jobs first (through the audited admin API; demo data is never touched)                        |
| Stale links and counts in the docs                                                                                                                               | README and docs point to this file; test counts refreshed                                                                                                      |

## Still to do (highest impact first)

| #   | Task                                                                                                                                                                                                                                                                                                     | Effort |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Run `make up && make seed && make e2e` on a machine with Docker and fix whatever the first container run shows. Pin the object-store image: `minio/minio:latest` floats and upstream MinIO is archived (its binary download now answers `410 Gone`); use a pinned digest or another S3-compatible server | M      |
| 2   | Run the mobile app on an Android emulator or phone against the stack and walk `docs/demo-script.md` with two sessions (requester and technician); add tests for the Job/Arrival/Evidence/Review, Nearby, Booking and History screens                                                                     | L      |
| 3   | Exercise the real S3/MinIO adapter (signature, expiry, wrong user) in CI against a real S3-compatible container; today it is covered only by an in-memory mock                                                                                                                                           | M      |
| 4   | Record performance evidence: `EXPLAIN ANALYZE` for the nearby query and a short load run                                                                                                                                                                                                                 | S–M    |
| 5   | Split Dispatch, Otp, Media, Settlement and Audit into their own Nest modules; move the technician controller out of `technicians.module.ts`                                                                                                                                                              | M      |
| 6   | Add TLS/WSS deployment configuration and an explicit "insecure local" flag for the API (today documented as "terminate TLS in front")                                                                                                                                                                    | S      |
| 7   | Small hardening: Swagger off by default outside development (`SWAGGER_ENABLED`), login throttle fail-closed if Redis is down, `GET …/nearby-technicians` currently moves REQUESTED→MATCHED (move the search to `POST`), `request.created` also reaches the owning requester                              | S      |
| 8   | Push to a remote, let CI run once, then tag `v0.1.0-trial`                                                                                                                                                                                                                                               | S      |

## Run it

```bash
# Docker (recommended; not yet executed on the dev machine)
cp .env.example .env && make up && make seed && make e2e

# Without Docker: see docs/runbook.md §2 (build the shared packages first)
# API http://localhost:3000   admin http://localhost:3001   health http://localhost:3000/health/ready
# Logins (dev only, password Passw0rd!dev): admin@dispatch.test · requester1@dispatch.test · tech1@dispatch.test
```

The requirement-by-requirement comparison is in [BUILT_VS_PENDING.md](BUILT_VS_PENDING.md). Known limitations and the deliberate mocks (payments, GPS, KYC, in-memory storage for tests) are in [known-limitations.md](known-limitations.md).
