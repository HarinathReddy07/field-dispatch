import {
  ACTIVE_JOB_STATES,
  CreateRequestSchema,
  REQUEST_STATES,
  ReviewSchema,
  TRANSITIONS,
  evaluateTransition,
} from './index';

describe('contracts', () => {
  it('rejects unknown keys (mass assignment)', () => {
    const r = CreateRequestSchema.safeParse({
      assetId: 'A1',
      category: 'ELECTRICAL_INSPECTION',
      location: { lat: 12.9, lon: 77.6 },
      windowStart: '2030-01-01T10:00:00Z',
      windowEnd: '2030-01-01T12:00:00Z',
      state: 'COMPLETED',
    });
    expect(r.success).toBe(false);
  });

  it('requires a reason for rework', () => {
    expect(ReviewSchema.safeParse({ decision: 'REQUEST_REWORK' }).success).toBe(false);
    expect(ReviewSchema.safeParse({ decision: 'APPROVE' }).success).toBe(true);
  });

  it('state table only references known states', () => {
    for (const t of TRANSITIONS) {
      expect(REQUEST_STATES).toContain(t.from);
      expect(REQUEST_STATES).toContain(t.to);
    }
    for (const s of ACTIVE_JOB_STATES) expect(REQUEST_STATES).toContain(s);
  });

  it('terminal states have no outgoing transitions', () => {
    expect(TRANSITIONS.filter((t) => t.from === 'COMPLETED' || t.from === 'CANCELLED')).toHaveLength(0);
  });

  it('evaluateTransition reports legality, actor and reason', () => {
    expect(evaluateTransition('ASSIGNED', 'ARRIVE', 'TECHNICIAN').ok).toBe(true);
    expect(evaluateTransition('ASSIGNED', 'ARRIVE', 'REQUESTER')).toEqual({
      ok: false,
      error: 'FORBIDDEN_ACTOR',
    });
    expect(evaluateTransition('CREATED', 'ARRIVE', 'TECHNICIAN')).toEqual({
      ok: false,
      error: 'ILLEGAL_TRANSITION',
    });
    expect(evaluateTransition('ASSIGNED', 'ADMIN_CANCEL', 'ADMIN')).toEqual({
      ok: false,
      error: 'REASON_REQUIRED',
    });
  });
});
