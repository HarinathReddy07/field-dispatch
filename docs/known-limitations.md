# Known limitations (honest list)

## Mocked on purpose (out of scope per BUILD_SPEC §1)

| Mock                                    | Where                                                                                        | Real replacement                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Payments / settlement                   | `MockPaymentProvider` (deterministic reference `MOCK-…`); ledger row is real, no money moves | payment gateway behind `PaymentProvider` |
| GPS                                     | the mobile app posts simulated samples; `LocationProvider` is an interface only              | device location + background tracking    |
| KYC / identity                          | not present; synthetic users only                                                            | separate identity service                |
| In-memory object store                  | `STORAGE_PROVIDER=memory` (tests)                                                            | `minio` adapter (S3-compatible)          |
| Ratings, push notifications, geofencing | static seed values / none                                                                    | product work                             |

## Not verified in the author's environment

The author's machine had **no Docker**. Therefore:

- `docker compose up`, the Dockerfiles, the `migrate`/`seed` services and the `make` targets were written but **never executed here**. Treat the first `make up` on a Docker host as the first real run (CI uses service containers for the same database/Redis images).
- The **MinIO adapter** (`modules/jobs/storage/minio.storage.ts`) has never talked to a real MinIO. Presigned PUT signs `Content-Type` and `Content-Length`; if a MinIO version rejects that combination, adjust `signableHeaders` there. Tests use the in-memory mock, which models URL expiry and signatures.
- Container-level restart (A7) was not executed; the in-process restart test covers the same guarantees (state in Postgres, OTP in Postgres, tokens stateless, sweeper resumes).
- The **mobile app has not been run on a device or emulator** in this environment. It is type-checked, its logic/client/component tests run, and the Android bundle step is verified separately (see PROGRESS.md for the exact result). Screens, camera, secure storage and socket behaviour on real hardware are untested.
- No load/performance run (k6/autocannon) and no `EXPLAIN ANALYZE` evidence for the nearby query were recorded.

## Technical limitations

- **Dependency advisories:** 3 moderate advisories remain in transitive dependencies of NestJS 10 (`@nestjs/core`, `file-type`); fixing them means moving to NestJS 11. High-severity advisories were fixed through `pnpm.overrides` (multer, lodash, js-yaml, qs, body-parser).
- **Data retention:** `idempotency_keys`, `outbox_events` (published rows) and `refresh_tokens` are never purged; a production system needs a retention job.
- **Outbox ordering:** events get a sequence number at insert time but can commit out of order; clients order by `seq` and always refetch REST state, so state is never wrong, only briefly stale.
- **Concurrent refresh:** two simultaneous refreshes with the same token are treated as token reuse and revoke the family (strict by design; the mobile client single-flights refresh).
- **Throttling fails open** if Redis is down (OTP attempts remain bounded in the database).
- **Socket events are not rate-limited** beyond a per-socket cap on room subscriptions.
- **HTTPS/WSS** is a deployment concern (reverse proxy); the repo ships plain HTTP for local use and secure-by-default cookies in the admin app.
- **Timezones:** all times are UTC on the wire; the apps render in the device/browser locale.
- **Search:** one radius + freshness window; no capacity planning, no multi-technician offers, no re-matching after rejection (a requester re-searches).
- **Admin map** uses public OpenStreetMap tiles (needs internet); the mobile app shows coordinates/distance, not a map.
- **Admin cancel from `PROOF_UPLOADED`** is possible but the state is transient (`stop` moves straight to `UNDER_REVIEW` in one transaction).
- Mobile: technician availability is shown from the last successful toggle (the API has no read endpoint for it); the review screen shows evidence for the current work cycle only.
