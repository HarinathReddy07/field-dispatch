# Test plan

Everything below runs against **real PostgreSQL + PostGIS, Redis and an S3-compatible server** (Testcontainers starts them, or point the suites at running ones with
`TEST_ADMIN_DATABASE_URL`, `TEST_REDIS_URL`, `TEST_S3_ENDPOINT`/`TEST_S3_ACCESS_KEY`/`TEST_S3_SECRET_KEY`). Each integration suite creates its own migrated, seeded database and its own Redis keyspace, so suites are isolated.
`*.int` below means `apps/api/test/integration/*.int.spec.ts`. Commands, environment and troubleshooting: [runbook](runbook.md). Latest results and counts: [STATUS](STATUS.md).

## How to run

| What                                                 | Command                                                                                                  | Needs                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Everything (lint, typecheck, all unit + integration) | `pnpm lint && pnpm typecheck && pnpm test` (or `make test`)                                              | Docker (Testcontainers) **or** the `TEST_*` variables               |
| API unit + integration only                          | `pnpm --filter @dispatch/api test`                                                                       | same                                                                |
| One suite                                            | `cd apps/api && npx jest --config jest.config.js -- test/integration/otp.int.spec.ts`                    | same                                                                |
| Acceptance scenarios A1-A7 (+ realtime)              | `make e2e` = `pnpm --filter @dispatch/api test:e2e`                                                      | same                                                                |
| Coverage gate (domain + dispatch ≥ 90 % lines)       | `make cov`                                                                                               | same                                                                |
| Concurrency loop (reproducible)                      | `CONCURRENCY_ITERATIONS=50 npx jest --config jest.config.js -- test/integration/concurrency.int.spec.ts` | same                                                                |
| Contract / state-machine tests                       | `pnpm --filter @dispatch/contracts test`                                                                 | -                                                                   |
| Admin unit tests · browser tests                     | `pnpm --filter @dispatch/admin test` · `pnpm --filter @dispatch/admin test:smoke`                        | running API + admin + seeded DB (`make demo`) for the browser tests |
| Mobile unit + component tests                        | `pnpm --filter @dispatch/mobile test`                                                                    | -                                                                   |

## Required test levels (spec §9.1)

| Level                                                             | Where                                                                                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Unit: state transitions                                           | `packages/contracts/src/contracts.spec.ts` (every state × action × actor = 776 cases)                                             |
| Unit: OTP policy, proximity ranking, pricing, idempotency hashing | `apps/api/src/domain/*.spec.ts`                                                                                                   |
| Unit: environment validation                                      | `apps/api/src/config/env.spec.ts`                                                                                                 |
| Integration: booking, arrival, proof gating, settlement           | `dispatch.int`, `lifecycle.int`, `otp.int`, `settlement.int`, `transition.int`                                                    |
| Concurrency                                                       | `concurrency.int` (A4, repeated loops), `otp.int` (parallel OTP), `settlement.int` (parallel finalize), `migrations.int`          |
| Realtime                                                          | `realtime.int` (log: [evidence/realtime-test.log](evidence/realtime-test.log))                                                    |
| Security                                                          | `security.int`, `otp.int`, `media.int`, `storage.s3.int`, `admin.int`, `logging.int`, `auth.int`, `throttle.int`, `transport.int` |
| Object storage adapter on a real S3-compatible server             | `storage.s3.int`                                                                                                                  |
| Restart                                                           | `restart.int`                                                                                                                     |
| Seed contract (Appendix A)                                        | `seed.int`                                                                                                                        |
| Admin UI (browser)                                                | `apps/admin/tests/smoke/live-board.spec.ts`, `apps/admin/tests/ui/admin-ui.spec.ts`                                               |
| Mobile logic and screens                                          | `apps/mobile/src/**/__tests__` (all 9 specified screens for both roles, tabs, timer, client, evidence pipeline)                   |

## Acceptance scenarios (spec §9.2)

| ID  | Scenario                                                                               | Test file › test                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Happy path, no manual DB edits                                                         | `lifecycle.int` › _A1 happy path: request -> assign -> OTP arrival -> work -> 2 images -> approve -> one settlement_                                                                                                        |
| A2  | Rework → new evidence → approve; history retained                                      | `lifecycle.int` › _A2 rework: history is preserved and the new cycle needs its own evidence_                                                                                                                                |
| A3  | Wrong, expired, replayed OTP blocked; brute force locks; parallel verify = one ARRIVED | `otp.int` › _wrong, expired and superseded codes fail with one uniform error; a valid code works once_, _brute force…_, _10 parallel verifications…_, _concurrent wrong guesses…_                                           |
| A4  | Competing confirms: one winner, deterministic 409                                      | `concurrency.int` › _10 parallel confirms on the SAME request…_, _10 competing requests confirm the SAME technician…_, _database constraints independently reject double booking_                                           |
| A5  | Cross-user job read, technician on admin endpoint                                      | `admin.int` › _every admin route rejects anonymous callers_, _requesters and technicians cannot touch other users' jobs through any route_; `security.int` › IDOR tests                                                     |
| A6  | Repeated finalization → exactly one settlement                                         | `settlement.int` › _20 parallel approvals…_, _20 retries with the SAME key…_, _a settlement can never be duplicated at the database level_                                                                                  |
| A7  | API restart mid-flow                                                                   | `restart.int` › _assignment, OTP and work state survive a restart and the flow continues_, _the review timeout still fires after a restart_; container restart: CI `docker-clean-start` job + [demo script](demo-script.md) |

## Data security matrix (spec §9.3)

| Risk                   | Test file › test                                                                                                                                                                                                                                                             | Pass condition                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| IDOR / object access   | `security.int` › _another requester gets 404 identical to a non-existent id_, _an unassigned technician cannot read…_; `admin.int`                                                                                                                                           | 404, identical to a missing id                                 |
| Privilege escalation   | `security.int` › _rejects a role supplied by the client in any payload_, _role comes from the database, not the token…_                                                                                                                                                      | 400 / 401, no escalation                                       |
| OTP replay             | `otp.int` › _wrong, expired and superseded codes fail…; a valid code works once_                                                                                                                                                                                             | second use rejected (uniform error)                            |
| OTP brute force        | `otp.int` › _brute force: attempts are counted, the code locks…_, _concurrent wrong guesses are all counted…_; `auth.int` › _rate limits login attempts_; `throttle.int`                                                                                                     | exactly 5 invalid then `429 OTP_LOCKED`; limiter fails closed  |
| Mass assignment        | `security.int` › _rejects client-supplied price on confirm_ and strict-DTO tests; `lifecycle.int` › _edit…_; `settlement.int` › _client amounts are rejected_; `transition.int` › _a client cannot push a request to COMPLETED…_                                             | unknown/protected fields rejected (400)                        |
| Sensitive logging      | `logging.int` › _never passwords, OTPs, tokens or auth headers_, _stamps EVERY application log line…redacts secrets and addresses_                                                                                                                                           | secrets absent from log output                                 |
| Media exposure         | `media.int` › _only participants can read evidence, via short-lived signed URLs that expire_; `storage.s3.int` › _DENIES an expired signed URL_, _DENIES a URL that was not signed for this object…_, _keeps the bucket private…_, _…enforces signed-URL access for readers_ | 403 after expiry (real server); wrong user gets 404 and no URL |
| SQL injection baseline | `security.int` › _stores hostile strings as data and leaves the schema intact_, _rejects injected pagination and unknown query keys_, _login with an injection-style email…_                                                                                                 | no query manipulation, no error leakage                        |
| Duplicate commands     | `dispatch.int`, `concurrency.int` › _retries with the same Idempotency-Key…_, `otp.int` › _arrive is idempotent…_, `media.int`, `settlement.int`                                                                                                                             | same result, no extra events                                   |

## Information-hiding cases (spec §6.2)

| Case                                                | Test                                                                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requester requests another's job by changing an ID  | `security.int` › _another requester gets 404 identical to a non-existent id_                                                                                         |
| Technician requests technician identities / profile | `security.int` › _a technician only sees their own profile fields via /users/me_; `admin.int` › _technicians never see the requester or each other (response shape)_ |
| Technician subscribes to a room not assigned        | `realtime.int` › _room joins are authorized server-side; location samples reach only authorized viewers_                                                             |
| Admin-only API with a technician token              | `admin.int` › _requesters and technicians cannot touch other users' jobs through any route_ (every admin route × role)                                               |
| Client submits COMPLETED while evidence is missing  | `lifecycle.int` › _cannot skip states_; `transition.int` › _a client cannot push a request to COMPLETED/SETTLED…_                                                    |
| Client changes the settlement amount                | `settlement.int` › _the settlement amount is the server-held quote; client amounts are rejected_                                                                     |

## Other invariants proven by tests

| Invariant                                                            | Test                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Transition + job_event + audit + outbox in one transaction; rollback | `transition.int`                                                                        |
| Overlapping work period exclusion constraint (on its own)            | `migrations.int` › _exclusion constraint rejects overlapping ACTIVE windows on its own_ |
| Append-only `job_events` / `audit_logs`                              | `migrations.int` › _blocks UPDATE, DELETE and TRUNCATE…_                                |
| Plain HTTP/WS refused unless `INSECURE_LOCAL_DEV=true`               | `transport.int`, `env.spec`                                                             |
| Swagger off by default                                               | `auth.int` › _exposes OpenAPI/Swagger only when SWAGGER_ENABLED=true_                   |
| Env validation fails fast, never echoes values                       | `env.spec`                                                                              |
| Seed matches Appendix A; no hard-coded OTP in code                   | `seed.int`                                                                              |

## Not automated

See [known limitations](known-limitations.md): the mobile app on a physical device or emulator, and the human-recorded demo.
