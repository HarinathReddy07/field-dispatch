import {
  ACTIVE_JOB_STATES,
  Actor,
  CreateRequestSchema,
  REQUEST_STATES,
  ReviewSchema,
  TERMINAL_STATES,
  TRANSITIONS,
  TransitionAction,
  evaluateTransition,
} from './index';

const ACTIONS = [...new Set(TRANSITIONS.map((t) => t.action))] as TransitionAction[];
const ACTORS: Actor[] = ['REQUESTER', 'TECHNICIAN', 'ADMIN', 'SYSTEM'];

describe('contracts', () => {
  it('rejects unknown keys (mass assignment)', () => {
    const r = CreateRequestSchema.safeParse({
      assetId: 'A1',
      category: 'ELECTRICAL_INSPECTION',
      location: { lat: 12.9, lon: 77.6 },
      windowStart: '2030-01-01T10:00:00Z',
      windowEnd: '2030-01-01T12:00:00Z',
      state: 'SETTLED',
    });
    expect(r.success).toBe(false);
  });

  it('requires a reason for rework', () => {
    expect(ReviewSchema.safeParse({ decision: 'REQUEST_REWORK' }).success).toBe(false);
    expect(ReviewSchema.safeParse({ decision: 'APPROVE' }).success).toBe(true);
  });
});

describe('state machine table', () => {
  it('only references known states and has no duplicate (from, action) rows', () => {
    const seen = new Set<string>();
    for (const t of TRANSITIONS) {
      expect(REQUEST_STATES).toContain(t.from);
      expect(REQUEST_STATES).toContain(t.to);
      const key = `${t.from}:${t.action}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    for (const s of ACTIVE_JOB_STATES) expect(REQUEST_STATES).toContain(s);
  });

  it('terminal states have no outgoing transitions', () => {
    for (const s of TERMINAL_STATES) expect(TRANSITIONS.filter((t) => t.from === s)).toHaveLength(0);
  });

  it('every non-terminal state can reach SETTLED or CANCELLED', () => {
    for (const start of REQUEST_STATES.filter((s) => !TERMINAL_STATES.includes(s))) {
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const t of TRANSITIONS.filter((x) => x.from === cur)) {
          if (!seen.has(t.to)) {
            seen.add(t.to);
            queue.push(t.to);
          }
        }
      }
      expect(seen.has('SETTLED') || seen.has('CANCELLED')).toBe(true);
    }
  });

  it('follows the BUILD_SPEC happy path edge by edge', () => {
    const path: [string, TransitionAction, Actor, string][] = [
      ['DRAFT', 'SUBMIT', 'REQUESTER', 'REQUESTED'],
      ['REQUESTED', 'SEARCH', 'REQUESTER', 'MATCHED'],
      ['MATCHED', 'CONFIRM', 'REQUESTER', 'CONFIRMED'],
      ['CONFIRMED', 'ARRIVE', 'TECHNICIAN', 'ARRIVED'],
      ['ARRIVED', 'START', 'TECHNICIAN', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'STOP', 'TECHNICIAN', 'PROOF_UPLOADED'],
      ['PROOF_UPLOADED', 'SUBMIT_REVIEW', 'TECHNICIAN', 'UNDER_REVIEW'],
      ['UNDER_REVIEW', 'APPROVE', 'REQUESTER', 'COMPLETED'],
      ['COMPLETED', 'SETTLE', 'SYSTEM', 'SETTLED'],
      ['UNDER_REVIEW', 'AUTO_APPROVE', 'SYSTEM', 'COMPLETED'],
      ['UNDER_REVIEW', 'REQUEST_REWORK', 'REQUESTER', 'REWORK'],
      ['REWORK', 'STOP', 'TECHNICIAN', 'PROOF_UPLOADED'],
      ['REQUESTED', 'EDIT', 'REQUESTER', 'DRAFT'],
      ['CONFIRMED', 'CANCEL_ASSIGNMENT', 'REQUESTER', 'REQUESTED'],
    ];
    for (const [from, action, actor, to] of path) {
      const r = evaluateTransition(from as never, action, actor, 'because');
      expect(r).toMatchObject({ ok: true, rule: { to } });
    }
  });

  // Exhaustive: every (state, action, actor) combination not allowed by the table is rejected.
  const combos: [string, TransitionAction, Actor][] = [];
  for (const s of REQUEST_STATES)
    for (const a of ACTIONS) for (const actor of ACTORS) combos.push([s, a, actor]);

  it.each(combos)('%s + %s by %s agrees with the table', (state, action, actor) => {
    const row = TRANSITIONS.find((t) => t.from === state && t.action === action);
    const r = evaluateTransition(state as never, action, actor, 'a reason');
    if (!row) expect(r).toEqual({ ok: false, error: 'ILLEGAL_TRANSITION' });
    else if (!row.actors.includes(actor)) expect(r).toEqual({ ok: false, error: 'FORBIDDEN_ACTOR' });
    else expect(r).toMatchObject({ ok: true });
  });

  it('requires a reason where the table says so', () => {
    for (const t of TRANSITIONS.filter((x) => x.reasonRequired)) {
      const actor = t.actors[0]!;
      expect(evaluateTransition(t.from, t.action, actor)).toEqual({ ok: false, error: 'REASON_REQUIRED' });
      expect(evaluateTransition(t.from, t.action, actor, '   ')).toEqual({
        ok: false,
        error: 'REASON_REQUIRED',
      });
      expect(evaluateTransition(t.from, t.action, actor, 'ok')).toMatchObject({ ok: true });
    }
  });

  it('technicians and requesters can never trigger admin overrides', () => {
    for (const t of TRANSITIONS.filter((x) => x.override)) {
      expect(t.actors).toEqual(['ADMIN']);
    }
  });
});
