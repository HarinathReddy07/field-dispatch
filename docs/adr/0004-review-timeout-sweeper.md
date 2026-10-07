# ADR 0004: Persisted deadline + SKIP LOCKED sweeper for review auto-approval

**Status:** accepted

**Context.** A review that nobody acts on must auto-approve after a configurable time (10 min default, short for demos), even if the API restarts, and even with several API instances.

**Decision.** `stop` writes `review_deadline_at` (database clock). A sweeper (interval `SWEEPER_INTERVAL_MS`) selects overdue `UNDER_REVIEW` rows, and for each row opens its own transaction that
claims it with `FOR UPDATE SKIP LOCKED`, re-checks the condition under the lock, and calls the **same** `JobsService.completeIn` used by manual approval (system actor).

**Consequences.** No in-memory timers: a restart loses nothing (`restart.int.spec.ts` kills the app during review and the new instance completes the job). Two sweepers never process the same row.
A poisoned row cannot block others (per-row transactions). Accuracy is `SWEEPER_INTERVAL_MS` (default 5 s).
