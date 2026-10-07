# PROGRESS

Memory file (BUILD_SPEC §0). Legend: **DONE** = verified by a test or a command I ran · **PARTIAL** · **MISSING**.

## Last verification (this session)

Environment: Windows, **no Docker**; local PostgreSQL 16.4 + PostGIS 3.6 and Redis 5 (`TEST_ADMIN_DATABASE_URL`, `TEST_REDIS_URL`).

| Suite                       | Command                                                                   | Result                                                               |
| --------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Lint, typecheck             | `pnpm lint` / `pnpm typecheck`                                            | 7 / 8 packages clean                                                 |
| Everything                  | `pnpm test`                                                               | admin 7 · contracts 776 · mobile 44 · API 142 (15 suites) — all pass |
| Acceptance A1-A7 + realtime | `pnpm --filter @dispatch/api test:e2e` (`make e2e`)                       | 8 suites / 78 tests pass                                             |
| Coverage gate               | `pnpm --filter @dispatch/api test:cov`                                    | domain 100 %, dispatch 98.4 % lines (gate 90 %)                      |
| Admin smoke (real stack)    | `npx playwright test` in `apps/admin` against locally running API + admin | 2 passed                                                             |
| Mobile bundle               | `npx expo export --platform android`                                      | Hermes bundle builds (958 modules)                                   |
| Dependency audit            | `pnpm audit --prod`                                                       | 3 moderate left (Nest 10 transitives); highs fixed via overrides     |

## §3 Functional

| ID                    | Status | Evidence                                                                                                  |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| TR-01 auth            | DONE   | `modules/auth`; `auth.int`, `security.int`                                                                |
| TR-02 request         | DONE   | `requests.service.ts` (create, PATCH edit); `dispatch.int`, `lifecycle.int`; mobile `CreateRequestScreen` |
| TR-03 proximity       | DONE   | `dispatch.service.ts`; `dispatch.int`                                                                     |
| TR-04 atomic confirm  | DONE   | `concurrency.int` (20× loops)                                                                             |
| TR-05 dispatch push   | DONE   | `realtime.int`; admin smoke; mobile `useLiveEvents` (not run on device)                                   |
| TR-06 OTP             | DONE   | `otp.int` (7)                                                                                             |
| TR-07 timer           | DONE   | server `started_at`; admin `elapsedSeconds` (unit-tested); mobile `lib/timer.ts` (unit-tested)            |
| TR-08 proof gate      | DONE   | `lifecycle.int`                                                                                           |
| TR-09 review/rework   | DONE   | `lifecycle.int` (A2)                                                                                      |
| TR-10 auto-approve    | DONE   | `settlement.int`, `restart.int`                                                                           |
| TR-11 settlement      | DONE   | `settlement.int`                                                                                          |
| TR-12 audit           | DONE   | `migrations.int`, `admin.int`; admin Audit view                                                           |
| TR-13 admin dashboard | DONE   | `apps/admin`; Playwright smoke                                                                            |
| TR-14 history/reorder | DONE   | API `dispatch.int`; mobile `HistoryScreen`                                                                |

## §4 Screens

- **Admin web — DONE** (all six views; Playwright smoke passes on the real stack): dashboard, live board + Leaflet map, job detail, technicians, audit, reason-gated cancel/reassign.
- **Mobile — PARTIAL.** All screens written for both roles (login, home/jobs, create request, nearby options, booking confirmation, arrival OTP for both roles, active job + server timer, evidence upload with progress/retry, review/rework, history/receipt/reorder). Typecheck, 44 tests and the Android bundle pass. **Not run on a device/emulator**, so "A1/A2 with two live sessions" has not been demonstrated end-to-end on mobile.

## §7 Concurrency — DONE · §8 Security — DONE

Tests: `concurrency.int`, `otp.int`, `settlement.int`, `migrations.int`; `security.int`, `media.int`, `admin.int`, `logging.int`, `realtime.int`. Gaps: HTTPS/WSS is a deployment concern (documented); CodeQL/dependency-review run in CI only.

## §9 Events / API — DONE

8 socket events, REST list (plus extras) documented in `docs/api.md`. A1-A7: all have automated tests (A7 = in-process restart; container restart not executed).

## §10 Phases

1. Infra — **PARTIAL**: compose, Dockerfiles (api, admin), auto-migrate + seed services, Makefile, CI workflows written. **Never executed (no Docker here).**
2. API core — DONE · 3. API job flow — DONE · 4. Realtime — DONE
3. Admin web — DONE · 6. Mobile — PARTIAL (see above) · 7. Security matrix — DONE
4. Docs — DONE (README, architecture, api, test-plan, runbook, demo-script, known-limitations, ADR 0001-0006).

## Blockers / honest gaps

- **No Docker on the dev machine:** `make up`, the images, compose healthchecks, Testcontainers path and the MinIO adapter have never run. First run on a Docker host is the real test (CI mirrors it with service containers).
- **Mobile never executed on a device/emulator** (camera, secure store, socket on hardware, Expo runtime).
- **No performance evidence** (no k6/`EXPLAIN ANALYZE` recorded).
- 3 moderate dependency advisories (NestJS 10 transitives).

## Next, if time allows

1. Run `make up && make seed && make e2e` on a Docker host; fix whatever the first container run reveals.
2. Run the mobile app on an emulator against the compose stack; walk `docs/demo-script.md` end to end.
3. Record `EXPLAIN ANALYZE` for the nearby query and a short load run in `docs/test-plan.md`.
4. Tag `v0.1.0-trial` after (1)-(2).
