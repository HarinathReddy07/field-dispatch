# ADR 0002: Pessimistic row locks backed by database constraints

**Status:** accepted

**Context.** Two requesters can try to book the same technician at the same instant; two technician devices can submit the same OTP; clients retry.

**Decision.** Every critical write is one transaction that (1) locks the request row `FOR UPDATE`, (2) locks other rows in a fixed order (request, then technician),
(3) validates against the pure state machine, (4) updates with `version = version + 1 … WHERE version = $expected`.
Each invariant is _also_ a database constraint (partial unique indexes, exclusion constraint on technician + time window, `UNIQUE(request_id)` on settlements) so a bug in application code
cannot violate it. Constraint violations are mapped to deterministic `409` codes.

**Alternatives.** Optimistic-only (retries under contention), serializable isolation (more aborts, harder to reason about), Redis locks (second source of truth).

**Consequences.** Lost races are cheap and deterministic (`STATE_CONFLICT`, `TECHNICIAN_UNAVAILABLE`). Throughput per request row is serialized, which is correct for this domain.
Tested by 20× loops of 10 parallel confirms (`apps/api/test/integration/concurrency.int.spec.ts`).
