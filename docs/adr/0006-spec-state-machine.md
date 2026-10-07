# ADR 0006: Adopt the BUILD_SPEC state machine (replacing the first draft)

**Status:** accepted (supersedes the initial CREATED/MATCHING/ASSIGNED/… draft)

**Context.** The first implementation used a state set inferred from the original brief (the diagram was an image). The condensed BUILD_SPEC §2 defines the authoritative states
(DRAFT, REQUESTED, MATCHED, CONFIRMED, ARRIVED, IN_PROGRESS, PROOF_UPLOADED, UNDER_REVIEW, REWORK, COMPLETED, SETTLED).

**Decision.** Migrations, contracts, API, seed and tests were converted in place. `CANCELLED` is kept as an added terminal state (admin cancel and pre-booking cancel need a terminal;
the spec's `CONFIRMED -cancel-> REQUESTED` is implemented as releasing the booking). The table is exhaustively tested (every state × action × actor, 776 cases) in `packages/contracts`.

**Consequences.** Rework no longer restarts the timer: `REWORK → PROOF_UPLOADED` after new proofs in a new work cycle. Confirm requires a prior search (`MATCHED`).
