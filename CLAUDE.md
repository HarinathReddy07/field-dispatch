# Field Asset Inspection & Repair Dispatch: project rules

Paid freelance vendor trial. The client will clone the repo, start the stack from scratch, and judge architecture, real-time correctness, security, concurrency safety, testing and delivery discipline. Requirements live in docs/spec/SPEC.md (the original Task_Project.docx is beside it for the figures). If code and spec disagree, the spec wins. If the spec is ambiguous, write the assumption in docs/architecture.md and continue.

## Stack (do not substitute)

- Monorepo: pnpm workspaces + Turborepo, TypeScript strict
- apps/api: NestJS (REST + Socket.io), Prisma for CRUD plus raw SQL for PostGIS/locking, zod (nestjs-zod) using packages/contracts
- apps/mobile: React Native (Expo dev build) + TanStack Query + Zustand + socket.io-client + expo-secure-store
- apps/admin: Next.js App Router + Tailwind + Leaflet
- PostgreSQL 16 + PostGIS, Redis 7, MinIO (S3 presigned URLs), docker compose
- Tests: Jest, Supertest, Testcontainers, Playwright (admin smoke), scripted E2E for A1-A7
- pino, @nestjs/swagger, ESLint/Prettier, husky, commitlint, GitHub Actions

## Layout

apps/{api,mobile,admin} · packages/{contracts,config} · infra/{docker-compose.yml,migrations,seed} · docs/{architecture,api,test-plan,runbook,known-limitations,demo-script}.md · docs/adr/ · README.md · .env.example · Makefile

## Commands (keep these working; update here if they change)

make up | make migrate | make seed | make test | make e2e | make demo | pnpm lint | pnpm typecheck

## Non-negotiable rules

1. Server authority: role, state, price, timestamps and timers are decided by the backend. Never trust client role/state/clock/amount.
2. One pure, unit-tested state-machine table. States: CREATED, MATCHING, ASSIGNED, ARRIVED, IN_PROGRESS, UNDER_REVIEW, REWORK_REQUESTED, COMPLETED, CANCELLED. Illegal transition = 409 with a stable error code. Every accepted transition writes job_event + audit_log in the same DB transaction.
3. Concurrency: transactions + SELECT FOR UPDATE and/or version-checked UPDATE, backed by DB constraints: partial unique index (one active assignment per technician), exclusion constraint on overlapping windows, unique settlement per request, atomic one-shot OTP consume. Parallel confirms: exactly one 200, one deterministic 409.
4. Idempotency-Key on confirm, arrive, start, stop, evidence finalize, review, settlement. Replay returns the original result; DB uniqueness is the backstop.
5. OTP: crypto.randomInt, store HMAC hash only, TTL, max attempts + temporary lock, constant-time compare, uniform error text, never logged.
6. AuthN/Z: short-lived JWT + rotating hashed refresh token, argon2id, role + ownership checks on every REST route and every socket room join. IDOR returns 404. Reject unknown fields.
7. Realtime: Socket.io JWT handshake, Redis adapter, rooms user:{id}, request:{id}, admin. Emit events only AFTER commit (outbox or after-commit hook) with eventId, occurredAt, schemaVersion. Reconnect resyncs via REST snapshot + since cursor.
8. Media: presigned PUT/GET, server-generated keys, size + magic-byte MIME check, checksum, ownership check, private bucket. >= 2 finalized images in the current work cycle before UNDER_REVIEW. Rework preserves history.
9. Timers server-authoritative. Review timeout uses persisted review_deadline_at and a restart-safe, multi-instance-safe sweeper (FOR UPDATE SKIP LOCKED) that goes through the same domain path as a manual approve.
10. PostGIS geography(Point,4326) + GiST index; ST_DWithin ranking by distance then rating with availability/category/freshness filters; server-computed quote.
11. audit_logs and job_events are append-only (DB trigger blocks UPDATE/DELETE).
12. Correlation-id on every request/log/event; pino redaction (auth headers, passwords, OTP, tokens); /health/live and /health/ready; error envelope {code,message,correlationId,details?}.
13. helmet, strict CORS from env, Redis-backed throttling (strict on login and arrive), body size limits, parameterised SQL only, no secrets in git.
14. Aadhaar/e-PAN, real payments and production background GPS are OUT of scope. Use mocks behind interfaces (PaymentProvider, StorageProvider, LocationProvider) and label them as mocks everywhere.
15. No shortcuts: no manual DB edits to pass a flow, no hard-coded statuses, no fake responses, no silently dropped requirement. Anything unfinished goes in docs/known-limitations.md with the reason.

## Required REST (prefix /api/v1)

POST /auth/login, /auth/refresh · POST /requests · GET /requests/:id · GET /requests/:id/nearby-technicians · POST /requests/:id/{confirm,otp,arrive,start,stop,review,reorder} · POST /requests/:id/evidence/intent and /requests/:id/evidence · GET /requests/history · GET /requests/:id/snapshot · PATCH /technicians/me/availability · POST /technicians/me/location · GET /admin/{jobs,jobs/:id,technicians,audit} · POST /admin/jobs/:id/{reassign,cancel} (reason mandatory)

## Realtime events (payloads defined in packages/contracts)

request.created, assignment.created, technician.location.updated, request.state.changed, evidence.uploaded, review.requested, settlement.created, admin.override

## Acceptance scenarios (each needs an automated test)

A1 happy path · A2 rework path with history preserved · A3 OTP wrong/expired/replayed + brute-force lock · A4 concurrent double-confirm, one winner · A5 IDOR + privilege escalation + wrong-role admin call · A6 settlement retried N times = one row · A7 API restart mid-flow, state recoverable and sweeper resumes

## Working style

- Layering: controller (DTOs only) -> application service (transactions) -> domain (pure rules) -> repository (SQL). No business logic in controllers or gateways.
- Plan first, then small vertical steps. After each step run lint, typecheck and the relevant tests, and fix before continuing.
- Conventional Commits, one commit per coherent unit. Never one giant commit.
- Never report something as passing unless you ran it in this session and saw it pass. Quote the command and result.
- Record ADRs in docs/adr/ for: ORM + raw SQL, locking, outbox, sweeper, idempotency.
- Never print or commit secrets. Use synthetic data only.

## Definition of done

`git clone && cp .env.example .env && make up && make migrate && make seed` works; `make test` is green; `make e2e` passes A1-A7; README quickstart and docs/demo-script.md exist; CI is green.
