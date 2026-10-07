# Preliminary Project Report: Design, Security, Testing & Development

**Trial Product:** Field Asset Inspection & Repair Dispatch Module
**Document type:** Preliminary Project Report + Trial Development Specification
**Trial deadline:** 72 hours / 3 days from task handover
**Required core stack:** React Native (TypeScript), Next.js + Tailwind, NestJS, PostgreSQL + PostGIS, Redis, Socket.io
**External integrations:** Mocked for the trial unless the vendor already has reusable sandbox adapters
**Primary evaluation:** Architecture quality, real-time correctness, security, concurrency, testing, delivery discipline and UX design
**Status:** Vendor evaluation, preliminary / pre-award

> Transcribed from the text of the client brief. Figures 1-3 (state machine, architecture, data flow) are images in the original `Task_Project.docx` and are not reproduced here; see docs/architecture.md for the proposed state machine (assumption).

**Evaluation principle.** The 3-day task is a deliberately constrained vertical slice that preserves the difficult engineering behaviours of the real system. Delivering this slice cleanly, with evidence, demonstrates the maturity needed for the larger 25-day build.

## Executive Summary

A 72-hour trial for an outsourcing company being evaluated to build a real-time location-based service platform. The theme is field asset inspection and repair dispatch, retaining the real engineering complexity: proximity matching, real-time dispatch, OTP arrival verification, timed work execution, evidence capture, customer review/rework, state transitions, auditability, concurrency protection and a settlement ledger.

The supplier must deliver a working end-to-end vertical slice. It is judged on demonstrable engineering behaviour. Source code, runnable builds, database migrations, API contracts, tests, Docker setup, architecture notes and a short demo are mandatory.

**Important scope rule.** Do not implement real Aadhaar/e-PAN verification, production payment capture, or production-grade background GPS. Replace these with secure interfaces and deterministic mocks.

## 1. Trial Objective and Success Definition

### 1.1 Objective
- Assess whether the vendor can turn a complex PRD into an executable technical design without excessive supervision.
- Assess whether the vendor can produce a real-time, multi-role, location-aware workflow within a fixed timebox.
- Assess security, information hiding, transaction integrity, idempotency and concurrent-update handling.
- Assess whether the code is structured for extension to the full 25-day product rather than a one-off demo.
- Assess whether the team can document and test the product sufficiently for handover and maintenance.

### 1.2 Success Definition
The trial passes only when a fresh evaluator can clone the repository, start the complete stack, seed demo data, perform the happy-path scenario, trigger at least two edge cases, inspect automated tests, and understand the architecture from the submitted documents without the vendor explaining hidden setup steps.

## 2. Trial Module: Field Asset Inspection & Repair Dispatch

An equipment owner is connected to a nearby field technician for an asset inspection. The service is initiated from a mobile request, assigned by distance, verified on arrival, executed against a timer, supported by evidence images, reviewed, and settled.

| Concept | Trial concept | Competency tested |
|---|---|---|
| Customer | Asset Owner / Requester | Role-based mobile UX and account data |
| Technicians | Field Technician | Availability, dispatch and execution workflow |
| Service booking | Inspection / repair request | Booking lifecycle and validation |
| Nearest technician | Nearest available technician | PostGIS proximity query and dispatch logic |
| Arrival OTP | Site arrival code | OTP security, TTL and one-time validation |
| Service timer | Inspection work timer | Server-authoritative timing and state transitions |
| Before/after photos | Inspection evidence photos | Media handling and status gating |
| Approve / rework | Accept report / request re-inspection | Human review and timeout logic |
| Payment / revenue log | Mock settlement ledger | Transaction records and idempotency |
| Admin operations panel | Operations control panel | Real-time visibility and manual exception handling |

### 2.2 Roles

| Role | Responsibilities | Sensitive data |
|---|---|---|
| Requester | Create request, see nearby technicians, confirm booking, provide arrival OTP, monitor job, approve/rework, view settlement receipt | Own profile, request details, location, evidence, transaction summary |
| Field Technician | Maintain availability, accept assignments, navigate, verify arrival, start/stop work, upload evidence | Own profile, live location while active, assignment details, proof media |
| Operations Admin | Monitor jobs and technician status, intervene in exceptions, review audit activity | Cross-user operational data, assignment controls, audit logs |

### 2.3 Functional Requirements (trial scope)

| ID | Capability | Requirement |
|---|---|---|
| TR-01 | Authentication | Role-aware sign-in for Requester, Technician and Admin. Seeded users. Access tokens validated server-side. |
| TR-02 | Asset/request creation | Requester creates a service request with asset ID, category, location, desired time window and notes. |
| TR-03 | Proximity matching | Backend returns available technicians within a configurable radius using PostGIS. Result includes distance, rating, availability and estimated charge. |
| TR-04 | Atomic confirmation | Requester confirms one technician. The same technician must not be confirmed for two competing requests at the same time. |
| TR-05 | Real-time dispatch | Confirmed assignment is pushed to Technician and Admin through Socket.io without manual refresh. |
| TR-06 | Arrival OTP | Requester can display an OTP. Technician submits OTP. Backend validates one-time use and TTL, then marks ARRIVED. |
| TR-07 | Timed execution | Technician starts work. Server stores authoritative start time. Client displays elapsed time from server timestamps. |
| TR-08 | Proof gating | Technician must upload at least two evidence images before a job can transition to UNDER_REVIEW. |
| TR-09 | Review/rework | Requester can APPROVE or REQUEST_REWORK. Rework returns to evidence submission and preserves history. |
| TR-10 | Timeout auto-approval | A configurable 10-minute review timeout may auto-complete the job if no action is taken. Use a short test configuration for the demo. |
| TR-11 | Settlement ledger | On completion, create one mock settlement record with amount, reference and status. Repeated client retries must not duplicate settlement. |
| TR-12 | Audit log | Record security-relevant and state-transition events with actor, action, entity and timestamp. |
| TR-13 | Admin dashboard | Show active requests, assigned technician, current state, last location and exception flags in real time. |
| TR-14 | History / reorder-equivalent | Requester can view completed requests and initiate a new request using prior request information as a starting point. |

## 3. External Software Design

### 3.1 Mobile application: required screens

| Screen | Requester behaviour | Technician behaviour | Key acceptance points |
|---|---|---|---|
| Login / role session | Sign in; session persists securely | Sign in; session persists securely | Role is derived by backend, not trusted from client input |
| Home / jobs | Create request; view active/history | View availability; active assignment | No unrelated data exposed across roles |
| Request details | Asset, category, location, notes, time window | Assignment summary and navigation action | Required fields validated; location format normalized |
| Nearby options | View nearest technicians, rating, distance, quote | N/A | Results sourced from backend proximity query |
| Booking confirmation | Confirm selected technician | Receive assignment instantly | Shows final quoted amount and assignment ID |
| Arrival | Display site OTP; monitor ETA | Enter OTP; see verification result | Wrong/expired OTP blocked with safe error |
| Active job | Live state, technician location, timer | Start/stop job, timer, evidence upload | Server timestamps drive timer; controls are role-specific |
| Evidence / review | Approve or request rework | Upload minimum 2 images | Cannot complete without required evidence |
| History / receipt | View completed requests and settlement | View completed jobs | No cross-user financial visibility |

### 3.2 Admin web: required views
- Operations dashboard: counts by state, active technicians, active requests and exception count.
- Live job board/map: request, technician, distance, state, last update, elapsed time.
- Job detail drawer/page: full state history, evidence references, actor events and settlement status.
- Technician list: availability, current assignment, last location timestamp and rating.
- Audit view: filter by job, actor and action; admin-only data.
- Exception action: cancel or reassign a request with a mandatory reason and audit entry.

## 4. Internal Software Design

### 4.1 Backend module decomposition

| Module | Responsibility | Must not contain |
|---|---|---|
| AuthModule | Login, token validation, role/permission guard | Business rules for booking |
| UserModule | Profiles and role-safe user queries | Raw password or secret exposure |
| RequestModule | Create/update/cancel request; lifecycle validation | Socket delivery implementation details |
| DispatchModule | PostGIS candidate search, technician reservation, assignment | UI-specific formatting |
| JobModule | Arrival, start, stop, evidence, review, rework | Identity verification integrations |
| OtpModule | Generate/hash/store/verify OTP with TTL and one-time use | Plain OTP persistence |
| RealtimeModule | Socket rooms, event publishing, reconnect handling | Direct database mutation |
| MediaModule | Upload intent, object key generation, metadata, safe access | Public bucket assumptions |
| SettlementModule | Mock settlement ledger and idempotency | Real payment provider calls |
| AuditModule | Immutable event records and operational trace | Editing/deleting historical events |
| AdminModule | Operational queries and privileged commands | Bypassing domain state rules |

### 4.2 Domain state machine
Figure 1 (image in the original docx) shows the request/job state machine. State transitions must be enforced by the backend. The client may request a transition, but the backend determines whether it is legal. Every accepted transition must create an audit event.

### 4.3 Suggested core entities

| Entity | Key attributes | Concurrency / security note |
|---|---|---|
| users | id, role, name, rating, status, created_at | Never expose password hash, auth secrets or admin-only flags to mobile clients |
| technicians | user_id, service_categories, availability_status, lat/lon, last_seen_at | Location is access-controlled and time-bounded |
| service_requests | id, requester_id, category, asset_id, lat/lon, requested_window, state, quote, version | Version and state guard protect updates |
| assignments | id, request_id, technician_id, status, confirmed_at | Unique active assignment constraint |
| otp_challenges | request_id, otp_hash, expires_at, consumed_at, attempts | Short TTL; only hash persisted; brute-force attempts limited |
| job_events | id, request_id, state_from, state_to, actor_id, occurred_at | Append-only transition evidence |
| evidence_media | id, request_id, object_key, checksum, uploaded_at, actor_id | Store reference not binary; access via signed URL |
| settlements | id, request_id, amount, currency, idempotency_key, status, provider_ref | Unique request/idempotency key prevents duplicate settlement |
| audit_logs | id, actor_id, action, entity_type, entity_id, metadata, created_at | Append-only; restricted to Admin/ops |

### 4.4 Internal design principles
- **Single source of truth:** PostgreSQL is authoritative for persistent business state; Redis is for ephemeral state, TTL data and high-frequency presence, never the only copy of a business transaction.
- **Information hiding:** controllers expose DTOs; services hide persistence; repositories hide SQL/ORM; media and OTP internals sit behind service interfaces.
- **Server authority:** client clocks, roles and state strings are never trusted for final decisions.
- **Idempotency:** confirmation, review actions, evidence finalization and settlement creation accept idempotency keys or equivalent uniqueness constraints.
- **Observable behaviour:** important changes emit structured logs and auditable events with correlation IDs.

## 5. Architectural Design

Figure 2 (target architecture): React Native app (Requester + Technician) and Next.js + Tailwind admin talk HTTPS JSON to NestJS (REST + WebSockets: auth, booking, dispatch, jobs). NestJS uses PostgreSQL + PostGIS (system of record: jobs, users, locations, audit; transactions), Redis (TTL, presence, idempotency, fast ephemeral state; OTP TTL), Socket.io (real-time events; state/ETA to mobile, dispatch/job state to admin), and S3-compatible object storage (signed media refs for proof images).

### 5.1 Layer responsibilities

| Layer | Technology | Responsibility |
|---|---|---|
| Client | React Native + TypeScript | Requester and Technician workflows, local caching, media capture, socket client, UI state |
| Operations UI | Next.js + Tailwind CSS | Admin dashboard, live operations view, exception workflows |
| Application/API | NestJS + TypeScript | REST APIs, domain orchestration, authorization, validation, sockets |
| Realtime | Socket.io | State/assignment/event delivery; reconnect and room management |
| Ephemeral state | Redis | OTP TTL, technician presence, socket/session hints, short-lived locks/idempotency |
| System of record | PostgreSQL + PostGIS | Users, requests, assignment, state transitions, audit, settlement, geo queries |
| Object storage | S3-compatible or trial mock | Evidence images and secure object access |

### 5.2 Required repository structure
```
/apps
  /mobile          React Native + TypeScript
  /admin           Next.js + Tailwind
  /api             NestJS
/packages
  /contracts       shared DTOs, enums, validation schemas
  /config          environment/config helpers
/infra
  docker-compose.yml
  migrations/
  seed/
docs
  architecture.md
  api.md
  test-plan.md
  runbook.md
```

### 5.3 Data flow (Figure 3)
Requester App -> NestJS API: create request + location. API -> PostGIS: nearest available; PostGIS -> API: candidate list. API -> Requester: options + quote. Requester -> API: confirm. API -> PostGIS: persist job transitions; API -> Redis: reserve / idempotency, presence + OTP TTL. API -> Admin Web (socket): live state. API -> Technician App (socket): assignment. Technician -> API: OTP / start / proof; GPS sample. API -> Requester: live ETA/status.

High-frequency or short-lived data need not be persisted at event frequency. GPS may be simulated as sampled coordinates. The persistent record must still capture the last trusted location and the final state transitions needed for audit.

## 6. Security, Data Protection and Information Hiding

### 6.1 Minimum security controls

| Control | Requirement |
|---|---|
| Authentication | Short-lived access token; secure token storage in mobile client; server-side token validation |
| Authorization | Role/permission guard on every protected API and socket room. Never rely on hidden UI buttons |
| Input validation | DTO/schema validation for every external payload; reject unknown or malformed fields |
| OTP protection | Cryptographically strong OTP; store only a hash; short TTL; one-time consume; rate-limit attempts |
| Secrets | No secrets in source control. Provide .env.example with placeholders; document all variables |
| PII minimization | No Aadhaar/e-PAN. Synthetic users and locations. Production design separates identity/KYC from operational profiles |
| Media security | Private object storage or mock; signed/short-lived URLs; server validates media ownership before issuing access |
| Transport | HTTPS/WSS in deployable configuration; local dev may use HTTP with a clear environment boundary |
| Logging | Do not log passwords, OTP values, auth tokens, full private addresses or secret headers |
| Auditability | Record who changed a booking/job, what, when and why for privileged operations |

### 6.2 Information hiding test cases

| Test | Expected result |
|---|---|
| Requester requests another requester's job by changing an ID | 403/404 equivalent; no data leakage |
| Technician requests all technician identities / private profile fields | Only fields explicitly permitted for the assignment are returned |
| Technician subscribes to a room for a job not assigned to them | Connection denied or room ignored server-side |
| Admin-only API called with technician token | Rejected at authorization layer |
| Client submits state=COMPLETED while evidence is missing | Backend ignores/rejects illegal transition |
| Client changes price/amount field in settlement request | Server recalculates/validates authoritative amount |

## 7. Data Concurrency and Consistency

### 7.1 Mandatory concurrency rules
- Only one active request can reserve a technician for the same overlapping work period.
- Booking confirmation must be atomic. Two simultaneous confirms result in one winner and one safe failure.
- OTP can be consumed once only. Two simultaneous verifications cannot both transition ARRIVED.
- Start/stop/review requests must be state-checked transactionally. Duplicate retries must not create duplicate events or settlement entries.
- Every critical write uses a transaction, conditional update, row lock or database uniqueness constraint as appropriate.
- Use a version field or equivalent optimistic concurrency control for mutable request/job records where two actors can update the same resource.

### 7.2 Recommended implementation pattern
```sql
BEGIN;
SELECT id, state, version FROM service_requests WHERE id = $1 FOR UPDATE;
-- Validate allowed transition + evidence count + actor permission
-- Write transition + audit event in the same transaction
UPDATE service_requests SET state = $2, version = version + 1
WHERE id = $1 AND version = $3;
COMMIT;
```
The exact implementation may vary, but a stale or duplicate command must never silently overwrite a newer valid transition.

## 8. API and Real-time Contract

### 8.1 Minimum REST endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /auth/login | Role-aware sign-in for seeded accounts |
| POST | /requests | Create a service request |
| GET | /requests/:id | Retrieve requester-authorized request details |
| GET | /requests/:id/nearby-technicians | Proximity-ranked candidates |
| POST | /requests/:id/confirm | Confirm technician assignment |
| POST | /requests/:id/otp | Create/display an arrival challenge |
| POST | /requests/:id/arrive | Validate OTP and mark ARRIVED |
| POST | /requests/:id/start | Start timed work |
| POST | /requests/:id/evidence | Create/upload evidence metadata |
| POST | /requests/:id/stop | Move to UNDER_REVIEW only when proof requirements are satisfied |
| POST | /requests/:id/review | Approve or request rework |
| GET | /requests/history | Requester history |
| POST | /requests/:id/reorder | Create a new request from prior data |
| GET | /admin/jobs | Admin job list |
| POST | /admin/jobs/:id/reassign | Privileged reassignment with audit reason |

### 8.2 Required realtime events

| Event | Direction | When emitted |
|---|---|---|
| request.created | Server -> admin | New request created |
| assignment.created | Server -> technician/requester/admin | Assignment confirmed |
| technician.location.updated | Server -> authorized viewers | Location sample changes while active |
| request.state.changed | Server -> relevant roles | Any valid lifecycle transition |
| evidence.uploaded | Server -> requester/admin | Evidence becomes available |
| review.requested | Server -> technician/admin | Requester requests rework |
| settlement.created | Server -> requester/admin | Final ledger entry created |
| admin.override | Server -> affected clients | Privileged intervention changes assignment or state |

## 9. Testing and QA

### 9.1 Test strategy
Testing is part of delivery. Automated coverage for domain-critical rules and at least one end-to-end flow is required. UI snapshot testing is not required; backend invariants need direct tests.

| Level | Minimum expectation | Evidence |
|---|---|---|
| Unit | State transitions, OTP verification, proximity ranking helper, price calculation, idempotency guards | Automated test output |
| Integration | API + PostgreSQL/Redis for booking, arrival, proof gating and settlement | Automated suite or scripted run |
| Concurrency | Competing confirmations; duplicate OTP; duplicate settlement/retry | Automated or reproducible concurrent script |
| Realtime | Assignment/state events reach correct rooms; unauthorized room subscription denied | Test script + screenshot/log |
| Security | Auth, role isolation, IDOR-style access, malformed payloads | Test cases + expected responses |
| E2E | Request -> dispatch -> OTP -> work -> evidence -> review -> settlement | Demo recording or live walkthrough |
| Build / deploy | Clean startup from documented commands; migrations and seed from scratch | README + command transcript |

### 9.2 Mandatory acceptance scenarios

| ID | Scenario | Acceptance |
|---|---|---|
| A1 Happy path | Requester creates request -> nearest technicians returned -> selects technician -> assignment appears in real time -> OTP arrival -> start -> upload two images -> stop -> approve -> settlement created | PASS only if no manual database edits needed |
| A2 Rework path | Requester requests rework -> technician receives event -> uploads new evidence -> requester approves | History retains prior proof/review events |
| A3 OTP security | Wrong, expired and repeated OTP attempted | All invalid attempts blocked; successful OTP cannot be replayed |
| A4 Concurrency | Two confirmations for the same technician submitted nearly simultaneously | Only one succeeds; other gets deterministic conflict response |
| A5 Authorization | Requester accesses another user's job; technician accesses admin endpoint | No sensitive data returned; audit/log not leaked |
| A6 Duplicate settlement | Client retries finalization multiple times | Exactly one settlement record per request |
| A7 Restart resilience | API restarts after assignment or evidence upload | Persistent business state recoverable; transient state recreated safely |

### 9.3 Data security test matrix

| Risk | Test | Pass condition |
|---|---|---|
| IDOR / object access | Change request ID in URL/body | No unauthorized record returned |
| Privilege escalation | Change role in client payload | Server ignores/rejects |
| OTP replay | Reuse valid OTP | Second use rejected |
| OTP brute force | Repeated wrong OTP attempts | Rate limit / temporary block |
| Mass assignment | Send unexpected protected fields | Fields ignored/rejected |
| Sensitive logging | Trigger errors with credentials/OTP | Secrets absent from logs |
| Media exposure | Open evidence URL after expiry / as wrong user | Access denied / expired |
| SQL injection baseline | Special characters in search/filter fields | No query manipulation / unsafe error leakage |
| Duplicate commands | Repeat same mutation request | Idempotent result where specified |

## 10. Three-Day Delivery Plan

| Day | Required outcome | Evidence |
|---|---|---|
| 0 | Confirm architecture, assumptions, state model and repository structure | Architecture page, ERD/data model, API skeleton, repo created |
| 1 | Backend foundation: auth, request, PostGIS proximity, atomic confirmation, migrations, seed data | Working API + DB + tests for core domain |
| 2 | Mobile + admin flows, Socket.io events, OTP, timer, evidence upload | End-to-end happy path reaches UNDER_REVIEW |
| 3 | Review/rework, settlement ledger, concurrency/security tests, polish, documentation, deployable package | Final build + tests + README + demo + architecture/test docs |

### 10.1 Non-negotiable time-boxing rule
Surface blockers early. Hidden scope reduction, manual database fixes, hard-coded status changes, fake API responses presented as production behaviour, or omission of core concurrency/security controls are competency failures even if the UI appears complete.

## 11. Deliverables Required at 72 Hours
- Source repository with clear commit history showing incremental development.
- React Native mobile build covering Requester and Technician workflows through role-gated screens.
- Next.js admin dashboard with real-time active-job monitoring.
- NestJS API with DTO validation, role guards and domain services.
- PostgreSQL/PostGIS schema, migrations and seed data.
- Redis configuration for OTP TTL / presence / idempotency or lock behaviour.
- Socket.io event contracts and room authorization.
- Object storage or S3-compatible trial adapter for evidence media.
- Automated unit/integration tests plus a reproducible concurrency test.
- Architecture/design document, API document, test plan and setup/runbook.
- Demo recording or live demo script covering A1-A7.

## 12. Constraints and Deliberate Omissions

| Included in 3-day trial | Excluded from 3-day trial |
|---|---|
| Real-time dispatch and state synchronisation | Production KYC/Aadhaar/e-PAN verification |
| PostGIS proximity search | Production payment gateway authorization/capture |
| OTP with security controls | Production payout split to technicians |
| Server-authoritative timer | Production-grade background GPS tuning on Android/iOS |
| Evidence upload and review/rework | Full-scale geofencing, battery optimisation, dead reckoning |
| Mock settlement ledger | Production monitoring/alerting/SIEM |
| Role-based admin dashboard | Full design system / brand polish / app-store submission |
| Automated security/concurrency tests | Production infrastructure hardening beyond the trial environment |

The deliverable is a working vertical slice, not a slide deck or static prototype.

## Appendix A: Seed Data Contract

| Object | Minimum seed set |
|---|---|
| Users | 2 Requesters, 3 Technicians, 1 Admin |
| Technician locations | At least 3 active technicians with distinct coordinates and ratings |
| Categories | At least 2 inspection categories with fixed trial rates |
| Requests | 1 completed request for history/reorder; 1 fresh request for live demo |
| OTP | Generated dynamically during the demo; never hard-coded in production code path |
| Evidence | Synthetic images only; no personal documents |

## Appendix B: Suggested Demo Script
1. Login as Requester and create a field inspection request with a map location.
2. Query nearby technicians and select the nearest suitable technician.
3. Show Admin dashboard receiving the new assignment in real time.
4. Login/act as Technician and verify the arrival OTP.
5. Start work and show the timer based on server timestamps.
6. Upload one image and show completion is blocked until the required second image exists.
7. Submit evidence and show Requester receiving the review state instantly.
8. Request rework once, update the evidence, and approve the job.
9. Show exactly one settlement record and the full audit trail.
10. Run the concurrency test and security test cases from the repository.
