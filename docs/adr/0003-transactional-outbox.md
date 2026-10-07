# ADR 0003: Transactional outbox for socket events

**Status:** accepted

**Context.** Emitting a socket event inside a request handler can announce a change that later rolls back, or lose an event if the process dies between commit and emit.

**Decision.** Events are inserted into `outbox_events` in the same transaction as the change (payload validated against the shared zod contract). A publisher polls unpublished rows with
`FOR UPDATE SKIP LOCKED`, emits to the stored rooms, then marks them published. Delivery is at-least-once; every event has `eventId` (clients de-dupe) and a monotonically assigned `seq`.
Reconnecting clients refetch REST state (`/requests/:id/snapshot?since=`), so a missed or reordered event can never leave a client wrong.

**Consequences.** Events are never emitted for rolled-back work (`realtime.int.spec.ts`: losing confirms emit nothing). Latency is bounded by `OUTBOX_POLL_MS` (default 500 ms).
Multiple API instances can run the publisher concurrently; the Redis adapter fans emits out to sockets on every instance. Published rows are retained (no purge job in the trial).
