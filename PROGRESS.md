# PROGRESS

Memory file (BUILD_SPEC §0). Last verified: API suite `npx jest` in `apps/api` = **15 suites / 142 tests pass**; contracts = **776 pass**; `pnpm lint`, `pnpm typecheck` clean. Verified against a real PostgreSQL 16.4 + PostGIS 3.6 and Redis (local, no Docker available on this machine). **Docker/compose has never been run here** (no Docker installed).

Legend: DONE = test-verified · PARTIAL · MISSING.

## §3 Functional

| ID                    | Status             | Where / evidence                                                                         |
| --------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| TR-01 auth            | DONE               | `modules/auth`, `test/integration/auth.int.spec.ts`, `security.int.spec.ts`              |
| TR-02 request         | DONE               | `requests.service.ts` (create, PATCH edit), `dispatch.int`, `lifecycle.int` (edit test)  |
| TR-03 proximity       | DONE               | `dispatch.service.ts` `findCandidates`, `dispatch.int`                                   |
| TR-04 atomic confirm  | DONE               | `dispatch.service.ts`, `concurrency.int` (20x loops)                                     |
| TR-05 dispatch push   | DONE               | `outbox.publisher.ts`, `realtime.gateway.ts`, `realtime.int`                             |
| TR-06 OTP             | DONE               | `otp.service.ts`, `otp.int`                                                              |
| TR-07 timer           | DONE (server side) | `started_at` DB clock in `jobs.service.ts`; client timer lives in mobile/admin (MISSING) |
| TR-08 proof gate      | DONE               | `jobs.service.ts` stop, `lifecycle.int`                                                  |
| TR-09 review/rework   | DONE               | `jobs.service.ts`, `lifecycle.int` (A2)                                                  |
| TR-10 auto-approve    | DONE               | `sweeper.service.ts`, `settlement.int`, `restart.int`                                    |
| TR-11 settlement      | DONE               | `settlement.service.ts`, `settlement.int`                                                |
| TR-12 audit           | DONE               | `audit.service.ts`, `transition.service.ts`, append-only trigger, `migrations.int`       |
| TR-13 admin dashboard | PARTIAL            | API done (`modules/admin`, `admin.int`); **web UI MISSING**                              |
| TR-14 history/reorder | DONE (API)         | `requests.service.ts`, `dispatch.int`; UI MISSING                                        |

## §4 Screens

- Admin web (6 views): **MISSING** (`apps/admin` is empty)
- Mobile (all screens): **MISSING** (`apps/mobile` is empty)

## §7 Concurrency — DONE

Row lock + version-checked UPDATE (`transition.service.ts`), partial unique indexes + exclusion constraint (`0002_core.sql`), atomic OTP consume, Idempotency-Key via `idempotency.service.ts`. Tests: `concurrency.int`, `otp.int`, `settlement.int`, `migrations.int`.

## §8 Security — DONE (matrix tests in `security.int`, `otp.int`, `media.int`, `admin.int`, `logging.int`, `realtime.int`)

Remaining gaps: `pnpm audit`/CodeQL not run; HTTPS/WSS only documented, not shipped (no proxy config).

## §9 Events / API

- 8 socket events: DONE (`realtime.int`). REST list: DONE incl. extras (`/requests/active`, `/requests/:id/snapshot`, `/requests/:id/cancel`, `/requests/:id/evidence`, `/admin/summary`, `/technicians/me/*`).
- Tests: unit DONE · integration DONE · concurrency DONE · realtime DONE · security DONE.
- A1 DONE `lifecycle.int` · A2 DONE · A3 DONE `otp.int` · A4 DONE `concurrency.int` · A5 DONE `admin.int`+`security.int` · A6 DONE `settlement.int` · A7 DONE in-process restart (`restart.int`); **container kill/restart variant not run (no Docker)**.

## §10 Phases

1. Infra — **PARTIAL**: migrations, seed, `.env.example`, compose file written; **api/admin Dockerfiles MISSING**, compose never run, `make e2e` has no e2e dir, CI workflow MISSING.
2. API core — DONE. 3. API job flow — DONE. 4. Realtime — DONE.
3. Admin web — MISSING. 6. Mobile — MISSING. 7. Security matrix — DONE (see §8 gaps).
4. Docs — MISSING: README, `docs/architecture.md`, `api.md`, `test-plan.md`, `runbook.md`, `demo-script.md`, ADRs, known-limitations.

## Next (in order)

1. Dockerfiles + CI + `test:e2e` wiring + coverage gate.
2. Admin web. 3. Mobile. 4. Docs/README. 5. Re-run everything, update this file.

## Blockers

- No Docker on this machine: compose, Testcontainers path, MinIO adapter (`minio.storage.ts`) and container restart cannot be executed here. Tests run against locally installed PostGIS/Redis via `TEST_ADMIN_DATABASE_URL` / `TEST_REDIS_URL`; the MinIO adapter is untested (memory mock is used in tests).
