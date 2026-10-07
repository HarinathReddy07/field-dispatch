# BUILD_SPEC — Field Asset Inspection & Repair Dispatch (72h trial)

This file is the complete client requirement, condensed. It is the only spec. Do not ask for the original document. Part of the project already exists in this repo: finish it, do not restart it.

## 0. Working rules (token discipline)

1. **Audit before writing.** First session only: run `git log --oneline | head -30`, a depth-3 tree (excluding `node_modules`, `.next`, `dist`, lockfiles), and read `package.json` files, the migrations, and the API module list. Do not read whole source files during the audit. Then write `PROGRESS.md`: every ID in sections 2–9 marked DONE / PARTIAL / MISSING with a file pointer. Verify DONE claims by running the existing tests, not by reading code.
2. **PROGRESS.md is the memory.** Update it after every finished item. Each new session reads only `BUILD_SPEC.md` + `PROGRESS.md`, then opens just the files the next item touches.
3. **Keep what exists.** Keep the ORM, folder layout and libraries already in the repo unless they make a requirement impossible. Edit files in place; never rewrite a working file.
4. **Generate boilerplate with CLIs** (`nest g`, `create-next-app`, `create-expo-app`), not by hand.
5. **One vertical slice at a time**, in the phase order of section 10. After each slice: run only that slice's tests with quiet output, fix, commit (small conventional commit — the client grades commit history), update PROGRESS.md.
6. **No narration.** Do not explain plans, restate the spec, or print code you just wrote. Reply with: what changed, test result, next item. No subagents. No reading logs or test output beyond the failing part.
7. **Decide, don't ask.** Take the simplest choice that meets the requirement and record it in one line under "Assumptions" in `docs/architecture.md`. Stop and ask only if a requirement cannot be met.
8. **Never fake it.** No hard-coded state changes, no manual DB fixes, no stubbed API responses passed off as real, no dropped concurrency or security control. If something cannot be finished, list it in PROGRESS.md under "Blockers" — the client treats hidden scope cuts as failure.
9. Shared enums, DTOs, validation schemas and socket event names live once in `packages/contracts` and are imported by api, admin and mobile.

## 1. Stack and repo layout (fixed)

React Native + TypeScript (mobile, Requester + Technician) · Next.js + Tailwind (admin) · NestJS (API + Socket.io) · PostgreSQL + PostGIS (system of record) · Redis (OTP TTL, presence, short locks, idempotency) · S3-compatible storage or mock adapter (evidence).

```
/apps/mobile  /apps/admin  /apps/api
/packages/contracts  /packages/config
/infra/docker-compose.yml  /infra/migrations  /infra/seed
/docs/architecture.md  api.md  test-plan.md  runbook.md
```

Out of scope, mock behind an interface: Aadhaar/e-PAN/KYC, real payments and payouts, production background GPS, geofencing, monitoring/SIEM, brand polish, app-store submission. GPS is a simulated coordinate stream.

**Pass condition:** a fresh evaluator clones, runs the documented commands, gets the full stack up with migrations and seed, performs A1 and at least two edge cases, and runs the tests — with no hidden steps.

## 2. State machine (backend-enforced; every accepted transition writes a job_event + audit log in the same transaction)

```
DRAFT -submit-> REQUESTED            REQUESTED -edit-> DRAFT
REQUESTED -nearest tech-> MATCHED    MATCHED -confirm-> CONFIRMED
CONFIRMED -cancel-> REQUESTED        CONFIRMED -OTP-> ARRIVED
ARRIVED -start-> IN_PROGRESS         IN_PROGRESS -(>=2 proofs)-> PROOF_UPLOADED
PROOF_UPLOADED -> UNDER_REVIEW
UNDER_REVIEW -approve|timeout-> COMPLETED -mock settlement-> SETTLED
UNDER_REVIEW -request rework-> REWORK -new proof-> PROOF_UPLOADED
```

`POST /stop` is rejected with fewer than 2 evidence images; otherwise it records PROOF_UPLOADED then UNDER_REVIEW. Admin cancel/reassign goes through the same transition service (admin never bypasses domain rules). The client may request a transition; it never supplies the resulting state.

## 3. Functional requirements

- **TR-01 Auth:** role-aware login for seeded Requester/Technician/Admin; short-lived access token validated server-side; role comes from the backend, never from client input.
- **TR-02 Request:** asset ID, category, location, desired time window, notes; required fields validated; location normalized.
- **TR-03 Proximity:** PostGIS query, configurable radius; returns distance, rating, availability, estimated charge.
- **TR-04 Atomic confirm:** one technician cannot be confirmed for two competing requests.
- **TR-05 Dispatch:** assignment pushed to Technician and Admin over Socket.io, no refresh.
- **TR-06 Arrival OTP:** requester displays OTP, technician submits, backend checks one-time use + TTL, marks ARRIVED.
- **TR-07 Timer:** server stores authoritative start time; client shows elapsed time from server timestamps.
- **TR-08 Proof gate:** at least 2 evidence images before UNDER_REVIEW.
- **TR-09 Review:** APPROVE or REQUEST_REWORK; rework returns to evidence submission and keeps history.
- **TR-10 Auto-approve:** configurable review timeout (10 min default, short value for demo via env). Store the deadline in Postgres and sweep it, so it survives an API restart.
- **TR-11 Settlement:** on completion exactly one mock ledger record (amount, reference, status); retries never duplicate.
- **TR-12 Audit:** security-relevant and transition events with actor, action, entity, timestamp.
- **TR-13 Admin dashboard:** active requests, technician, state, last location, exception flags, live.
- **TR-14 History/reorder:** requester sees completed requests and starts a new one prefilled from an old one.

## 4. Screens

**Mobile (role-gated, one app):** Login (secure token storage) · Home/jobs (requester: create, active, history; technician: availability, active assignment) · Request details (technician: assignment summary + navigate action) · Nearby options (requester only; rating, distance, quote from backend) · Booking confirmation (final quoted amount + assignment ID; technician receives instantly) · Arrival (requester shows OTP + ETA; technician enters OTP; safe error on wrong/expired) · Active job (live state, technician location, timer; technician start/stop + evidence upload) · Evidence/review (technician uploads >=2; requester approve/rework) · History/receipt (no cross-user financial data).

**Admin web:** dashboard counts by state, active technicians, active requests, exception count · live job board/map (request, technician, distance, state, last update, elapsed) · job detail (state history, evidence refs, actor events, settlement status) · technician list (availability, assignment, last location time, rating) · audit view filtered by job/actor/action · exception action: cancel or reassign with mandatory reason + audit entry.

## 5. Backend modules (keep responsibilities separate)

Auth (login, token, guards) · User (role-safe profiles, never password/secret fields) · Request (create/update/cancel, lifecycle validation; no socket code) · Dispatch (PostGIS search, reservation, assignment) · Job (arrival, start, stop, evidence, review, rework) · Otp (generate/hash/store/verify; never plain OTP persisted) · Realtime (rooms, publish, reconnect; no DB mutation) · Media (upload intent, object key, metadata, signed access; no public bucket) · Settlement (mock ledger + idempotency) · Audit (append-only) · Admin (queries + privileged commands via domain services).

Layering: controllers expose DTOs → services hold rules → repositories hide SQL/ORM. OTP and media internals sit behind interfaces. Structured logs with a correlation ID per request.

## 6. Data model

- `users` id, role, name, rating, status, created_at
- `technicians` user_id, service_categories, availability_status, location (geography point), last_seen_at
- `service_requests` id, requester_id, category, asset_id, location, requested_window, state, quote, version, review_deadline_at
- `assignments` id, request_id, technician_id, status, confirmed_at — **partial unique index: one active assignment per technician, one per request**
- `otp_challenges` request_id, otp_hash, expires_at, consumed_at, attempts
- `job_events` id, request_id, state_from, state_to, actor_id, occurred_at — append-only
- `evidence_media` id, request_id, object_key, checksum, uploaded_at, actor_id — reference only, no binary
- `settlements` id, request_id, amount, currency, idempotency_key, status, provider_ref — **unique(request_id)**
- `audit_logs` id, actor_id, action, entity_type, entity_id, metadata, created_at — append-only, admin-only read

Postgres is authoritative for all business state. Redis holds only ephemeral data and is never the sole copy of a transaction.

## 7. Concurrency (mandatory)

- Every critical write: transaction + `SELECT … FOR UPDATE` on the request, validate state/actor/evidence, then `UPDATE … SET state, version = version + 1 WHERE id AND version = $expected`. Stale or duplicate commands return 409, never overwrite.
- Two simultaneous confirms for one technician → one winner, one deterministic 409 (row lock + unique index).
- OTP consumed once: single conditional update (`consumed_at IS NULL AND expires_at > now()`); two simultaneous verifies cannot both reach ARRIVED.
- Confirm, review, evidence finalization and settlement accept an `Idempotency-Key` header or rely on a uniqueness constraint; duplicates return the original result and create no extra events or settlements.

## 8. Security (mandatory)

- Role/permission guard on every protected route **and every socket room join**; UI hiding is not access control.
- DTO validation on every payload; unknown fields rejected (whitelist + forbidNonWhitelisted).
- OTP: `crypto.randomInt`, only a hash stored, short TTL, one-time, attempt limit with temporary block.
- Ownership checks on every `:id` (other user's record → 403/404, no data). Technician sees only fields permitted for their assignment. Settlement amount is recalculated server-side from category rate; client price/state/role fields are ignored or rejected.
- Media: private storage, short-lived signed URLs, ownership checked before issuing.
- No secrets in git; `.env.example` with every variable documented. HTTPS/WSS in deployable config; HTTP only under an explicit local-dev env flag.
- Logs never contain passwords, OTPs, tokens, full private addresses or secret headers.
- Privileged admin actions record who, what, when and why.

## 9. API, events, tests

**REST:** `POST /auth/login` · `POST /requests` · `GET /requests/:id` · `GET /requests/:id/nearby-technicians` · `POST /requests/:id/confirm` · `POST /requests/:id/otp` · `POST /requests/:id/arrive` · `POST /requests/:id/start` · `POST /requests/:id/evidence` · `POST /requests/:id/stop` · `POST /requests/:id/review` · `GET /requests/history` · `POST /requests/:id/reorder` · `GET /admin/jobs` · `POST /admin/jobs/:id/reassign` (plus admin cancel, technician list, audit query, technician availability/location as the screens need).

**Socket events (server → authorized rooms only):** `request.created` (admin) · `assignment.created` (technician, requester, admin) · `technician.location.updated` (authorized viewers, while active) · `request.state.changed` (relevant roles) · `evidence.uploaded` (requester, admin) · `review.requested` (technician, admin) · `settlement.created` (requester, admin) · `admin.override` (affected clients).

**Automated tests required:**

- Unit: state transitions, OTP verification, proximity ranking helper, price calculation, idempotency guards.
- Integration (API + real Postgres/Redis): booking, arrival, proof gating, settlement.
- Concurrency (reproducible script): competing confirms, duplicate OTP, duplicate settlement retry.
- Realtime: events reach the right rooms; unauthorized room join denied.
- Security: IDOR by changed ID; role changed in payload; OTP replay; OTP brute force; mass assignment of protected fields; secrets absent from logs after errors; evidence URL after expiry / as wrong user; special characters in filter fields (SQL injection baseline); duplicate mutation idempotent; technician token on admin endpoint; `state=COMPLETED` without evidence; tampered settlement amount.

**Acceptance scenarios (each needs a test or scripted run):**

- A1 happy path end to end, no manual DB edits.
- A2 rework → new evidence → approve; prior proof/review events retained.
- A3 wrong, expired and replayed OTP all blocked.
- A4 two near-simultaneous confirms for one technician: one succeeds, one deterministic conflict.
- A5 requester reads another user's job; technician calls admin endpoint: nothing leaked.
- A6 repeated finalization: exactly one settlement.
- A7 API restart after assignment or evidence upload: business state recovered, transient state (rooms, presence, timers) rebuilt safely.

## 10. Phase order (skip whatever PROGRESS.md marks DONE)

1. Infra: docker-compose (postgis, redis, api, admin, storage/mock), migrations, seed, `.env.example`, one-command start.
2. API core: auth + guards, request CRUD, PostGIS proximity, atomic confirm, transition service, audit. Unit + integration + A4 test.
3. API job flow: OTP, start/timer, evidence + media adapter, stop gate, review/rework, timeout sweeper, settlement. Tests for A2, A3, A6.
4. Realtime: gateway, room auth, all eight events, simulated location stream, reconnect resync. Realtime + A7 tests.
5. Admin web: all six views, live updates, cancel/reassign with reason.
6. Mobile: all screens for both roles, secure token storage, socket client, server-driven timer.
7. Security test matrix (section 9) + A5; fix what fails.
8. Docs, kept short and factual: `architecture.md` (modules, state machine, ERD, data flow, assumptions, path to the 25-day build), `api.md` (endpoints, events, error codes), `test-plan.md` (matrix → test file mapping, how to run), `runbook.md` (clone-to-running commands, env vars, seeded logins, troubleshooting), `docs/demo-script.md` (steps below mapped to A1–A7). Paste a real clean-start command transcript into the README.

**Seed:** 2 requesters, 3 technicians (active, distinct coordinates and ratings), 1 admin, 2 categories with fixed rates, 1 completed request (for history/reorder), 1 fresh request. OTPs always generated at runtime. Synthetic images only.

**Demo script:** requester creates request with map location → nearby technicians, pick nearest → admin sees assignment live → technician verifies OTP → start, server-driven timer → upload 1 image, stop is blocked → upload 2nd, submit, requester sees review state instantly → request rework once, new evidence, approve → show exactly one settlement + full audit trail → run concurrency and security tests.

## 11. Definition of done

Every ID in sections 3, 4, 7, 8, 9 is DONE in PROGRESS.md with a passing test or a demo-script step; the full test suite passes from a clean clone; no item is silently dropped.
