# ADR 0005: Idempotency keys stored inside the business transaction

**Status:** accepted

**Context.** Mobile networks time out; clients retry. Confirm, arrive, start, stop, evidence finalize, review and cancel must not repeat their effects.

**Decision.** The `Idempotency-Key` header is required on those routes. `IdempotencyService.run` inserts `(scope, key)` — scope = user + route + resource — with `ON CONFLICT DO NOTHING` **in the same transaction**,
runs the action, and stores the JSON response. A concurrent call with the same key blocks on the unique index until the first commits, then replays its stored result; if the first rolls back, the second simply executes.
Same key with a different body → `422 IDEMPOTENCY_MISMATCH`. For arrival the body fingerprint is a keyed HMAC of the code, so the table cannot be used to brute-force OTPs.

**Consequences.** A stored result can never exist without its business change. Failed attempts store nothing, so retrying after a _definite_ rejection re-evaluates it (same deterministic 409).
The mobile client keeps one key per user intent and reuses it after unknown outcomes (network/5xx). Old keys are not purged in the trial (see known limitations).
