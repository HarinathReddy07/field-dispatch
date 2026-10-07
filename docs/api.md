# API reference

Base URL `http://localhost:3000/api/v1` (health probes are unprefixed). Interactive docs: `GET /api/docs` (Swagger UI), `/api/docs-json`.
All bodies are JSON and validated by shared zod schemas (`packages/contracts`); **unknown fields are rejected** with `400 VALIDATION_FAILED`.

## Conventions

- `Authorization: Bearer <accessToken>` on everything except login/refresh and health. Role comes from the database, not the token.
- `Idempotency-Key: <8-128 chars [A-Za-z0-9_.:-]>` is **required** on confirm, arrive, start, stop, review, cancel and evidence finalize. Replaying a key returns the original result; the same key with a different body → `422 IDEMPOTENCY_MISMATCH`.
- `x-correlation-id` (optional, 8-64 chars) is echoed on every response and appears in logs, audit rows and error bodies.
- Error envelope: `{ "code": "…", "message": "…", "correlationId": "…", "details"?: … }`.
- Access to someone else's record returns **404** (never 403), so ids cannot be probed.
- Money is integer minor units (INR paise). Timestamps are ISO-8601 UTC; every request view includes `serverTime`.

## Auth

| Method | Path            | Roles              | Notes                                                                                                     |
| ------ | --------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/login`   | public (throttled) | `{email, password}` → `{accessToken, refreshToken, expiresIn, user:{id,name,role}}`                       |
| POST   | `/auth/refresh` | public (throttled) | `{refreshToken}` → new pair; the used token is revoked; reuse of a revoked token revokes the whole family |
| POST   | `/auth/logout`  | any                | revokes the user's refresh tokens (204)                                                                   |
| GET    | `/auth/me`      | any                | `{id, name, role}`                                                                                        |
| GET    | `/users/me`     | any                | `{id, name, role, rating}`                                                                                |

## Requests (requester unless noted)

| Method | Path                                              | Notes                                                                                                                           |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/requests`                                       | `{assetId, category, location:{lat,lon}, windowStart, windowEnd, notes?}` → `RequestView` (state `REQUESTED`)                   |
| PATCH  | `/requests/:id`                                   | edit while `REQUESTED` (`REQUESTED → DRAFT → REQUESTED`); at least one field                                                    |
| GET    | `/requests/active`                                | requester/technician: in-flight requests                                                                                        |
| GET    | `/requests/history?page=`                         | requester/technician: finished (settled/cancelled)                                                                              |
| GET    | `/requests/:id`                                   | owner, assigned technician, admin                                                                                               |
| GET    | `/requests/:id/snapshot?since=<seq>`              | `{request, events[], cursor}` for reconnect resync                                                                              |
| GET    | `/requests/:id/nearby-technicians?radiusKm&limit` | PostGIS ranked list `{technicianId,name,rating,distanceKm,quoteMinor,availability}`; moves `REQUESTED → MATCHED`                |
| POST   | `/requests/:id/confirm`                           | `{technicianId}` + Idempotency-Key. Requires `MATCHED`. 409 `STATE_CONFLICT` / `TECHNICIAN_UNAVAILABLE` for the loser of a race |
| POST   | `/requests/:id/otp`                               | issue arrival code (state `CONFIRMED`) → `{otp, expiresAt}`; the plain code is returned once                                    |
| POST   | `/requests/:id/cancel`                            | + key. `CONFIRMED` → back to `REQUESTED` (booking released); earlier states → `CANCELLED`                                       |
| POST   | `/requests/:id/review`                            | + key. `{decision:"APPROVE"}` or `{decision:"REQUEST_REWORK", reason}`                                                          |
| POST   | `/requests/:id/reorder`                           | new `REQUESTED` request prefilled from a finished one                                                                           |
| GET    | `/requests/:id/evidence`                          | finalized evidence with short-lived signed GET URLs                                                                             |

## Technician

| Method | Path                            | Notes                                                                                                                                                               |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PATCH  | `/technicians/me/availability`  | `{status: "AVAILABLE"                                                                                                                                               | "OFFLINE"}`; 409 while on a job                                                                        |
| POST   | `/technicians/me/location`      | `{lat, lon}` → 202 `{accepted, persisted}`; Redis latest + throttled DB persist; live event to authorized viewers                                                   |
| POST   | `/requests/:id/arrive`          | `{otp}` (6 digits) + key. Uniform `400 OTP_INVALID`; `429 OTP_LOCKED` after the attempt limit; throttled per user                                                   |
| POST   | `/requests/:id/start`           | + key. `ARRIVED → IN_PROGRESS`; `startedAt` is the DB clock                                                                                                         |
| POST   | `/requests/:id/evidence/intent` | `{contentType: image/jpeg                                                                                                                                           | image/png, sizeBytes ≤ 5 MB, checksumSha256}`→`{mediaId, uploadUrl, method:"PUT", headers, expiresAt}` |
| POST   | `/requests/:id/evidence`        | `{mediaId}` + key. Server reads the uploaded object and verifies size, SHA-256 and magic bytes                                                                      |
| POST   | `/requests/:id/stop`            | + key. Needs ≥ 2 finalized images in the current work cycle (`409 EVIDENCE_REQUIRED`, `details:{required,finalized}`); records `PROOF_UPLOADED` then `UNDER_REVIEW` |

## Admin

| Method | Path                                                  | Notes                                                                                                     |
| ------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/summary`                                      | counts by state, active requests/technicians, exception count                                             |
| GET    | `/admin/jobs?state&page&pageSize`                     | `{items, total, page, pageSize}`; each item adds `exceptionFlags`, `technicianLocation`, `elapsedSeconds` |
| GET    | `/admin/jobs/:id`                                     | job + `events`, `audit`, `assignments`, `evidence` (signed URLs)                                          |
| GET    | `/admin/technicians`                                  | availability, current job, last location/time, rating                                                     |
| GET    | `/admin/audit?requestId&actorId&action&page&pageSize` | newest first                                                                                              |
| POST   | `/admin/jobs/:id/reassign`                            | `{technicianId, reason}` (reason 5-500 chars, mandatory)                                                  |
| POST   | `/admin/jobs/:id/cancel`                              | `{reason}` (mandatory)                                                                                    |

Exception flags: `NO_TECHNICIAN`, `TECHNICIAN_STALE`, `REVIEW_OVERDUE`, `REWORK_OPEN`, `MULTIPLE_REWORKS` (computed server-side).

## Health

`GET /health/live` → `{status:"ok"}`; `GET /health/ready` → `200/503 {status, checks:{database, redis}}`.

## Realtime (Socket.io)

Connect with `io(API_URL, { transports: ["websocket"], auth: { token: <accessToken> } })`. Handshake without a valid token is rejected (`connect_error: UNAUTHENTICATED`).
On connect the server joins `user:{id}` (and `admin` for admins). The socket is disconnected when its access token expires; reconnect with a fresh token.

| Client → server       | Payload       | Ack                                         |
| --------------------- | ------------- | ------------------------------------------- |
| `request.subscribe`   | `{requestId}` | `{ok:true}` or `{ok:false, code:"NOT_FOUND" | "VALIDATION_FAILED" | "RATE_LIMITED"}`: unauthorized rooms are ignored server-side |
| `request.unsubscribe` | `{requestId}` | `{ok:true}`                                 |

Every event is `{eventId, occurredAt, schemaVersion:1, seq, type, requestId, data}` (`seq` 0 = not replayable, e.g. location samples).

| Event (server → clients)      | Audience                                   | Data                                                  |
| ----------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| `request.created`             | admin, requester                           | `{requestId, category, state}`                        |
| `assignment.created`          | technician, requester, admin               | `{requestId, assignmentId, technicianId, quoteMinor}` |
| `technician.location.updated` | admin + subscribed viewers of that request | `{requestId, technicianId, lat, lon, at}`             |
| `request.state.changed`       | requester, technician, admin               | `{requestId, from, to, version}`                      |
| `evidence.uploaded`           | requester, admin                           | `{requestId, mediaId, workCycle}`                     |
| `review.requested`            | technician, admin, requester               | `{requestId, reason, workCycle}`                      |
| `settlement.created`          | requester, admin                           | `{requestId, settlementId, amountMinor, providerRef}` |
| `admin.override`              | affected requester/technicians, admin      | `{requestId, action: REASSIGN                         | CANCEL, reason}` |

## Error codes

| Code                       | HTTP               | Meaning                                                             |
| -------------------------- | ------------------ | ------------------------------------------------------------------- |
| `VALIDATION_FAILED`        | 400 (413 oversize) | schema/unknown-field/malformed payload; `details` lists paths only  |
| `UNAUTHENTICATED`          | 401                | missing/invalid/expired token or bad credentials                    |
| `FORBIDDEN`                | 403                | role not allowed on this route                                      |
| `NOT_FOUND`                | 404                | missing **or not yours**                                            |
| `STATE_CONFLICT`           | 409                | request not in a state that allows the action / lost a race         |
| `ILLEGAL_TRANSITION`       | 409                | state machine refuses the action in the current state               |
| `TECHNICIAN_UNAVAILABLE`   | 409                | technician not eligible or already booked                           |
| `EVIDENCE_REQUIRED`        | 409                | fewer than 2 finalized images in the current cycle                  |
| `IDEMPOTENCY_IN_PROGRESS`  | 409                | same key still being processed                                      |
| `IDEMPOTENCY_KEY_REQUIRED` | 400                | header missing/malformed                                            |
| `IDEMPOTENCY_MISMATCH`     | 422                | key reused with a different body                                    |
| `OTP_INVALID`              | 400                | wrong, expired, superseded or unknown code (uniform message)        |
| `OTP_LOCKED`               | 429                | attempt limit reached; temporary block                              |
| `RATE_LIMITED`             | 429                | Redis-backed throttle (strict on login and arrive)                  |
| `MEDIA_REJECTED`           | 422                | uploaded object missing or fails size/checksum/type checks          |
| `INTERNAL`                 | 500                | unexpected; details only in server logs, matched by `correlationId` |
