# Field Asset Inspection & Repair Dispatch

A comprehensive, real-time, location-aware service platform designed for field asset inspection and repair. The application allows requesters to book the nearest available field technician, who is then dispatched live. The technician verifies arrival with a one-time code, works against a server-driven timer, and uploads evidence. The requester can then approve the work or request rework, ultimately recording exactly one settlement with concurrency protection, an audit trail, and an administrative operations console.

## 🏗️ Project Structure

The project is structured as a robust pnpm monorepo using Turborepo, allowing for modular separation of concerns across different applications and shared packages.

```text
field-dispatch/
├── apps/
│   ├── api/          # Backend (NestJS, REST + WebSocket, PostgreSQL/PostGIS, Redis, RustFS)
│   ├── admin/        # Admin web console (Next.js App Router, Tailwind, Leaflet)
│   └── mobile/       # Mobile application (React Native / Expo, Zustand, TanStack Query)
├── packages/
│   ├── config/       # Shared configuration (zod-parsed env schemas)
│   ├── contracts/    # Shared types (zod DTOs, enums, state machine table, error codes)
│   └── ui-tokens/    # Shared design tokens used by admin and mobile
├── docs/             # Documentation (Architecture, APIs, test plans, ADRs, etc.)
├── infra/            # Infrastructure setup (Docker Compose, Outbox services)
├── Makefile          # GNU Make commands for quickstart and operations
├── turbo.json        # Turborepo configuration
└── package.json      # Monorepo root package & scripts
```

## 🚀 What's Developed

We have built a full vertical slice covering 14 core trial requirements (TR-01 through TR-14), providing a production-like foundation:

- **Strict State Machine**: A pure transition table ensuring safe, strict state transitions across all 12 job states.
- **Atomic Concurrency Protection**: Lock-tight concurrency mechanisms utilizing row-lock ordering, partial unique indexes, and overlap exclusion constraints.
- **Security & Authorization**: Features argon2id password hashing, rotating refresh tokens, a default-deny AccessGuard, HMAC-based OTP validation, strict Zod DTO validation, and fully redacted structured logs.
- **Transactional Consistency**: Real-time Socket.io events are backed by a transactional outbox, guaranteeing events are emitted only after the DB transaction commits.
- **Append-only Auditing**: Full database trigger enforcement to strictly allow `INSERT`-only writes to `job_events` and `audit_logs`.
- **Infrastructure Automation**: Docker Compose configuration spanning PostgreSQL 16 + PostGIS, Redis 7, and RustFS (S3-compatible) running behind automated health checks and pinned digests.

## ✨ Features by Module

### 🔧 Backend (`apps/api`)

- **Proximity Search**: Utilizes PostGIS `ST_DWithin` on a GiST index with availability, category, freshness, and overlap filters to find the nearest technicians.
- **Atomic Booking Confirmation**: Robust assignment management ensuring no double bookings.
- **Arrival Verification (OTP)**: Secure HMAC-based OTP storage with configurable TTL and attempt limits to verify technician arrival.
- **Proof Gating**: Strict rules requiring at least 2 finalized image uploads before a technician can mark a job for review.
- **Review-Timeout Sweeper**: A restart-safe cron process (`FOR UPDATE SKIP LOCKED`) to auto-approve reviews that exceed the configurable `REVIEW_TIMEOUT_SECONDS`.
- **Idempotent Settlements**: Ensures exactly one settlement record per request (`UNIQUE(request_id)`), preventing duplicate payments across network retries.
- **Correlation IDs**: End-to-end request tracing via `x-correlation-id` for every HTTP request and descendant log.
- **Robust Throttling**: Granular per-IP, per-user, and per-email rate limiting that fails closed on Redis outages.

### 🖥️ Admin Console (`apps/admin`)

- **Real-Time Job Board & Map**: Live updates over Socket.io to view active field agents and jobs dynamically without page reloads.
- **Comprehensive Views**: Dashboard, Job Detail Drawer, Technician List, Audit View, and Cancel/Reassign modules with mandatory reasoning.
- **Accessibility & UX**: Dark mode support, full keyboard accessibility, and automated Playwright smoke and axe tests.

### 📱 Mobile App (`apps/mobile`)

- **Dual Role Support**: Nine bespoke screens optimized for both Requesters and Technicians.
- **Secure State & Fetching**: Uses `expo-secure-store` for token management, alongside TanStack Query for robust data fetching and caching with seamless loading/empty/error states.
- **Server-Driven Timer**: Client-side countdown driven entirely by server authority, enforcing accurate work cycles.

## 🏁 Quickstart (fresh clone)

**Prerequisites:** Docker with Compose v2, GNU make, Node 20+, and pnpm 12 (`npm i -g pnpm@12.10.1`).

```bash
git clone <repo-url> field-dispatch && cd field-dispatch
pnpm install --frozen-lockfile   # install tooling
make up                          # builds & starts postgres+postgis, redis, storage, api, admin
make seed                        # load synthetic demo data (idempotent)
make test                        # run unit + integration suites
make e2e                         # run full acceptance scenarios (A1-A7) + realtime flow
```

- **API:** `http://localhost:3000`
- **Admin Console:** `http://localhost:3001`
- **Storage Console:** `http://localhost:9001`

_For more operations (like `make reset`), troubleshooting, or non-Docker paths, refer to our [Runbook](docs/runbook.md)._

## 📖 Documentation Reference

- **[Architecture](docs/architecture.md)**
- **[API Specs](docs/api.md)**
- **[Test Plan](docs/test-plan.md)**
- **[Runbook](docs/runbook.md)**
- **[Changelog](CHANGELOG.md)**
