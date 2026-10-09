# Known limitations (honest list)

## Mocked on purpose (out of scope per the requirement spec §1)

| Mock                                    | Where                                                                                        | Real replacement                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Payments / settlement                   | `MockPaymentProvider` (deterministic reference `MOCK-…`); ledger row is real, no money moves | payment gateway behind `PaymentProvider` |
| GPS                                     | the mobile app posts simulated samples; `LocationProvider` is an interface only              | device location + background tracking    |
| KYC / identity                          | not present; synthetic users only                                                            | separate identity service                |
| In-memory object store                  | `STORAGE_PROVIDER=memory` (a few tests; refused when `NODE_ENV=production`)                  | S3-compatible adapter (default, tested)  |
| Ratings, push notifications, geofencing | static seed values / none                                                                    | product work                             |

## Not verified in the author's environment

The author's machine had **no Docker** (and no WSL). Everything below was therefore verified a different way or is listed for a human to run:

- `docker compose up`, the Dockerfiles and the `make` targets were **not executed with Docker here**. What was done instead: `docker compose config` validates the compose files, `caddy validate` accepts the Caddyfile, and the exact steps each Dockerfile runs (filtered `pnpm install`, build, `pnpm prune --prod`, Next.js standalone) were replayed on a clean directory and the resulting API and admin servers were started against real PostgreSQL/PostGIS, Redis and RustFS ([clean-start transcript](clean-start-transcript.md)). The CI job `docker-clean-start` runs the real `make up && make seed && make e2e` on Linux; its first green run is still to be seen.
- The **mobile app has not been run on a device or emulator**. It is type-checked and lint-clean, all nine specified screens have component tests for both roles (render, role gating, key action, loading/empty/error), and the Android Hermes bundle builds under Metro (all imports resolve, including fonts and icons). Camera, secure storage, Socket.io on hardware and the Expo runtime are untested.
- Container-level restart (A7) is covered in-process by `restart.int`; the CI job stops the API container (graceful shutdown, exit code 0) and starts it again.

## Technical limitations

- **Dependency advisories** (`pnpm audit --prod`, 2026-10-09): **0 high or critical are open without a documented reason.** Two high advisories have **no patched release** upstream
  (`node-forge <= 1.4.0`, `braces <= 3.0.3`); both are reachable only through the Expo CLI / Metro developer toolchain of `apps/mobile` (bundling on a developer machine or CI), not through the API or
  admin runtime or the compiled app, and are listed with that justification under `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` so a _new_ high advisory still fails CI. Four moderate advisories remain
  (`file-type` and `@nestjs/core` inside NestJS 10, fixed by moving to NestJS 11; `uuid` inside Expo tooling). Earlier highs were fixed through `pnpm.overrides` (multer, lodash, js-yaml, qs, body-parser).
- **Data retention:** `idempotency_keys`, `outbox_events` (published rows) and `refresh_tokens` are never purged; a production system needs a retention job.
- **Outbox ordering:** events get a sequence number at insert time but can commit out of order; clients order by `seq` and always refetch REST state, so state is never wrong, only briefly stale.
- **Concurrent refresh:** two simultaneous refreshes with the same token are treated as token reuse and revoke the family (strict by design; the mobile client single-flights refresh).
- **Throttling:** login and OTP arrival **fail closed** (503) if Redis is down; other routes fail open so a cache outage does not take the API down (OTP attempts are bounded in the database either way).
- **Socket events are not rate-limited** beyond a per-socket cap on room subscriptions.
- **HTTPS/WSS:** the API refuses plain HTTP/WS unless `INSECURE_LOCAL_DEV=true`; TLS terminates at a reverse proxy (Caddy profile in `infra/docker-compose.tls.yml`). The API trusts `X-Forwarded-Proto` from that one proxy, so it must not be reachable except through it.
- **One active job per technician:** the trial keeps a stricter rule than the spec's "overlapping work period" (a booked technician is BUSY); the overlap exclusion constraint is the database-level rule and is tested on its own.
- **`GET /requests/:id/nearby-technicians` has a side effect** on its first call (`REQUESTED → MATCHED`), as the spec defines the route; repeat calls are read-only.
- **Timezones:** all times are UTC on the wire; the apps render in the device/browser locale.
- **Search:** one radius + freshness window; no capacity planning, no multi-technician offers, no re-matching after rejection (a requester re-searches).
- **Admin map** uses public OpenStreetMap tiles (needs internet); the mobile app shows coordinates/distance, not a map.
- **Admin cancel from `PROOF_UPLOADED`** is possible but the state is transient (`stop` moves straight to `UNDER_REVIEW` in one transaction).
- Mobile: technician availability is shown from the last successful toggle (the API has no read endpoint for it); the review screen shows evidence for the current work cycle only.
