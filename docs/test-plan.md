# Test plan

Everything below runs against **real PostgreSQL + PostGIS and Redis** (Testcontainers by default, or `TEST_ADMIN_DATABASE_URL` / `TEST_REDIS_URL` to reuse running instances).
Each integration suite creates its own migrated, seeded database, so suites are isolated. See [runbook](runbook.md) for commands.

## How to run

| What                                                 | Command                                             | Needs                                                 |
| ---------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| Everything (lint, typecheck, all unit + integration) | `pnpm lint && pnpm typecheck && pnpm test`          | Docker (Testcontainers) **or** the two env vars above |
| API unit + integration                               | `pnpm --filter @dispatch/api test`                  | same                                                  |
| Coverage gate (domain + dispatch ≥ 90 % lines)       | `pnpm --filter @dispatch/api test:cov`              | same                                                  |
| Acceptance scenarios A1-A7 (+ realtime)              | `make e2e` = `pnpm --filter @dispatch/api test:e2e` | same                                                  |
| Contract/state-machine tests                         | `pnpm --filter @dispatch/contracts test`            | –                                                     |
| Admin unit tests                                     | `pnpm --filter @dispatch/admin test`                | –                                                     |
| Admin Playwright smoke                               | `pnpm --filter @dispatch/admin test:smoke`          | running API + admin + seeded DB (`make demo`)         |
| Mobile unit + component tests                        | `pnpm --filter @dispatch/mobile test`               | –                                                     |

## Required test levels (BUILD_SPEC §9)

| Level                                                             | Where                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Unit: state transitions                                           | `packages/contracts/src/contracts.spec.ts` (every state × action × actor = 776 cases)             |
| Unit: OTP policy, proximity ranking, pricing, idempotency hashing | `apps/api/src/domain/*.spec.ts`                                                                   |
| Integration: booking, arrival, proof gating, settlement           | `lifecycle.int`, `dispatch.int`, `otp.int`, `settlement.int`                                      |
| Concurrency                                                       | `concurrency.int` (A4, 20× loops), `otp.int` (parallel OTP), `settlement.int` (parallel finalize) |
| Realtime                                                          | `realtime.int`                                                                                    |
| Security                                                          | `security.int`, `otp.int`, `media.int`, `admin.int`, `logging.int`, `auth.int`                    |
| Restart                                                           | `restart.int`                                                                                     |
| Admin UI                                                          | `apps/admin/tests/smoke/live-board.spec.ts`                                                       |
| Mobile logic/components                                           | `apps/mobile/src/**/__tests__`                                                                    |

(`*.int` = `apps/api/test/integration/*.int.spec.ts`.)

## Acceptance scenarios

| ID  | Scenario                                                                               | Test                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Happy path, no manual DB edits                                                         | `lifecycle.int` › _A1 happy path_                                                                                                                   |
| A2  | Rework → new evidence → approve; history retained                                      | `lifecycle.int` › _A2 rework_                                                                                                                       |
| A3  | Wrong, expired, replayed OTP blocked; brute force locks; parallel verify = one ARRIVED | `otp.int` (7 tests)                                                                                                                                 |
| A4  | Competing confirms: one winner, deterministic 409                                      | `concurrency.int` (same request ×10, 10 requests→1 technician ×10, 20 iterations each)                                                              |
| A5  | Cross-user job read, technician on admin endpoint                                      | `admin.int` (every admin route × tech/requester/anonymous), `security.int` (IDOR)                                                                   |
| A6  | Repeated finalization → exactly one settlement                                         | `settlement.int` (20 parallel approvals, 20 same-key retries, sweeper race)                                                                         |
| A7  | API restart mid-flow                                                                   | `restart.int` (state, OTP, token validity survive; sweeper resumes). Container kill/restart: `docker compose restart api` during the demo (runbook) |

## Security matrix (BUILD_SPEC §9)

| Risk                                   | Test                                                                             | Result expected                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| IDOR by changed id                     | `security.int` › IDOR; `admin.int` › other users' jobs through any route         | 404, identical to missing id                                           |
| Role changed in payload                | `security.int` › role enforcement                                                | 400, no escalation; forged JWTs → 401                                  |
| OTP replay                             | `otp.int`                                                                        | 409 `ILLEGAL_TRANSITION`                                               |
| OTP brute force                        | `otp.int`                                                                        | exactly 5 invalid then 429 `OTP_LOCKED`, even for the correct code     |
| Mass assignment                        | `security.int`, `lifecycle.int` (edit), `settlement.int` (amount)                | 400 on any unknown/protected field                                     |
| Secrets absent from logs               | `logging.int`                                                                    | no password/OTP/token/Authorization in captured log output             |
| Evidence URL after expiry / wrong user | `media.int`                                                                      | 410 after expiry (mock bucket), 403 tampered, 404 for non-participants |
| SQL injection baseline                 | `security.int`                                                                   | hostile strings stored as data; injected filters → 400; schema intact  |
| Duplicate mutation idempotent          | `dispatch.int`, `concurrency.int`, `otp.int`, `media.int`, `settlement.int`      | same result, no extra events                                           |
| Technician token on admin endpoint     | `admin.int`                                                                      | 403, envelope only                                                     |
| `COMPLETED` without evidence           | `lifecycle.int` (stop with 1 image → 409), `security.int` (state field rejected) | rejected                                                               |
| Tampered settlement amount             | `settlement.int`                                                                 | 400; amount equals server quote                                        |
| Unauthorized socket room join          | `realtime.int`                                                                   | `{ok:false, NOT_FOUND}`, no events                                     |
| Append-only history                    | `migrations.int`                                                                 | UPDATE/DELETE/TRUNCATE blocked                                         |

## Results (last full run on the author's machine, no Docker; PostgreSQL 16.4 + PostGIS 3.6, Redis 5)

Recorded in [`PROGRESS.md`](../PROGRESS.md) after each slice. The CI workflow runs the same suites with `postgis/postgis:16-3.4` and `redis:7` service containers.

## Not yet covered by automation

See [known-limitations](known-limitations.md): MinIO adapter (needs MinIO), container-level restart, performance/load numbers, mobile on a device/emulator.
