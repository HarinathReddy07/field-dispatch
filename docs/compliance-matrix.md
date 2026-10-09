# Compliance Matrix

Every item in the client trial specification mapped to its implementation status and evidence.

**Legend:** Done = checkmark, Partial = tilde, Missing = X

---

## Tier A � Client Requirements

### A1 � Clean start (spec 1.2, 9.1)

| Item                                                           | Status | Evidence                                                                       |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| All Docker images pinned to exact digest                       | Done   | `infra/docker-compose.yml` � postgis, redis, rustfs all pinned with `@sha256:` |
| MinIO replaced with RustFS (S3-compatible)                     | Done   | ADR 0007; `rustfs/rustfs:1.0.1@sha256:`                                        |
| make up && make seed && make test && make e2e from clean clone | Done   | CI job `docker-clean-start`; see `docs/clean-start-transcript.md`              |
| README quickstart matches actual commands                      | Done   | `README.md` Quickstart                                                         |

### A2 � Functional TR-01..TR-14

| TR    | Capability                                                          | Status | Evidence                                                                                       |
| ----- | ------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| TR-01 | Role-aware sign-in, seeded users, server-side token validation      | Done   | `apps/api/src/modules/auth/`; `test/integration/auth.int.spec.ts`                              |
| TR-02 | Asset request creation                                              | Done   | `RequestsController.create`; `CreateRequestBody` DTO                                           |
| TR-03 | PostGIS proximity search, configurable radius, rated result         | Done   | `dispatch.service.ts#findCandidates`; ST_DWithin + GiST                                        |
| TR-04 | Atomic confirmation: one winner on competing confirm                | Done   | Row lock + exclusion constraint; `test/integration/concurrency.int.spec.ts`                    |
| TR-05 | Real-time dispatch via Socket.io                                    | Done   | Transactional outbox -> `RealtimeGateway`; `realtime.int.spec.ts`                              |
| TR-06 | Arrival OTP: issue, validate, one-time, TTL                         | Done   | `otp.service.ts`; HMAC only; `otp.int.spec.ts`                                                 |
| TR-07 | Timed execution, server-authoritative start time                    | Done   | `started_at = now()` in `jobs.service.ts#start`                                                |
| TR-08 | Proof gating: >=2 finalized images before UNDER_REVIEW              | Done   | `jobs.service.ts#stop`; `REQUIRED_EVIDENCE_COUNT=2`                                            |
| TR-09 | Review/rework: APPROVE or REQUEST_REWORK; history preserved         | Done   | `jobs.service.ts#review`; work_cycle incremented                                               |
| TR-10 | Configurable 10-minute review timeout; survives restart             | Done   | `review_deadline_at` persisted; `REVIEW_TIMEOUT_SECONDS` env; `sweeper.service.ts` SKIP LOCKED |
| TR-11 | Settlement ledger: one record per request, idempotent under retries | Done   | `settlement.service.ts`; UNIQUE constraint                                                     |
| TR-12 | Audit log: actor, action, entity, timestamp                         | Done   | `audit.service.ts`; append-only trigger                                                        |
| TR-13 | Admin dashboard: live state, technician, location, exceptions       | Done   | `apps/admin`; Socket.io live updates                                                           |
| TR-14 | History and reorder                                                 | Done   | `RequestsController.history`; `RequestsController.reorder`                                     |

### A3 � Mobile � 9 screens, both roles: Done

### A4 � Admin � 6 views: Done

### A5 � Architecture (4.1, 4.4, 5.1): Done � 11 separate Nest modules

### A6 � State machine (4.2): Done � evaluateTransition enforces all; every tx writes job_event+audit

### A7 � Data model (4.3): Done � 9 tables, version column, append-only triggers

### A8 � Concurrency (7.1, 7.2): Done � row locks, version checks, exclusion constraints, FOR UPDATE on OTP

### A9 � Security (6.1): Done � argon2id, default-deny guard, strict DTOs, HMAC OTP, HTTPS/WSS profile, redacted logs

### A10 � Test cases 6.2 and 9.3: Done � security.int, otp.int, storage.s3.int, logging.int

### A11 � API endpoints (8.1): Done � all 15 spec endpoints plus admin/technician extras

### A12 � Realtime events (8.2): Done � all 8 events, room auth, reconnect snapshot

### A13 � Tests (9.1): Done � unit, integration, concurrency, realtime, security, E2E

### A14 � Seed (Appendix A): Done � 3 requesters, 8 technicians, 2 categories, 2 requests, runtime OTPs

### A15 � Deliverables (11): Done � Redis config, S3 adapter + tests, mobile build, admin build

### A16 � Docs (5.2, 11): Done � architecture.md, api.md, test-plan.md, runbook.md, demo-script.md

### A17 � This compliance matrix: Done

---

## Tier B � Professional Extras

### B1 � Lint + typecheck: Done � pnpm lint && pnpm typecheck zero errors

### B2 � GitHub Actions CI: Done � verify, docker-clean-start, audit, secrets jobs

### B3 � Env validation / hardening: Done � loadEnv() zod, helmet, CORS, fail-closed throttle, Swagger flag, graceful shutdown

### B4 � Docker hardening: Done � healthchecks, depends_on healthy, multi-stage, non-root user

### B5 � Mobile component tests: Done � **tests**/ for all 9 screens

### B6 � EXPLAIN ANALYZE + load run: Done � docs/performance.md

### B7 � Mobile polish: Done � Inter font, @expo/vector-icons, bottom tabs

### B8 � Dependency audit: Done � 0 high/critical open; justified ignores in pnpm-workspace.yaml

---

## Appendix B scenario to test mapping

| Scenario                | Test                                       |
| ----------------------- | ------------------------------------------ |
| A1 Happy path           | `test/integration/lifecycle.int.spec.ts`   |
| A2 Rework path          | `lifecycle.int.spec.ts`                    |
| A3 OTP security         | `test/integration/otp.int.spec.ts`         |
| A4 Concurrency          | `test/integration/concurrency.int.spec.ts` |
| A5 Authorization        | `test/integration/security.int.spec.ts`    |
| A6 Duplicate settlement | `test/integration/settlement.int.spec.ts`  |
| A7 Restart resilience   | `test/integration/restart.int.spec.ts`     |
