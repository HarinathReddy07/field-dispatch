import { CATEGORY_RATES_MINOR, Category } from '@dispatch/contracts';
import { calculateQuote, metersToKm } from './pricing';
import { rankCandidates, toNearby } from './ranking';
import { evaluateOtpAttempt, generateOtp, hmacOtp, verifyOtp } from './otp';
import { requestHash, stableStringify } from './hash';

describe('pricing', () => {
  it.each([
    ['ELECTRICAL_INSPECTION', 0, 45000],
    ['ELECTRICAL_INSPECTION', 1, 46500],
    ['ELECTRICAL_INSPECTION', 2.34, 48510],
    ['MECHANICAL_INSPECTION', 0, 60000],
    ['MECHANICAL_INSPECTION', 3.5, 66300],
  ] as [Category, number, number][])('%s at %s km -> %s', (category, km, expected) => {
    expect(calculateQuote(category, km)).toBe(expected);
  });

  it('uses only server rates and rejects invalid distance', () => {
    expect(CATEGORY_RATES_MINOR.ELECTRICAL_INSPECTION.base).toBe(45000);
    expect(() => calculateQuote('ELECTRICAL_INSPECTION', -1)).toThrow(RangeError);
    expect(() => calculateQuote('ELECTRICAL_INSPECTION', NaN)).toThrow(RangeError);
    expect(() => calculateQuote('BOGUS' as Category, 1)).toThrow(RangeError);
  });

  it('metersToKm rounds to 2 decimals', () => {
    expect(metersToKm(1234)).toBe(1.23);
    expect(metersToKm(0)).toBe(0);
    expect(metersToKm(1005)).toBe(1.01);
  });
});

describe('ranking', () => {
  const c = (id: string, d: number, r: number) => ({
    technicianId: id,
    name: id,
    distanceKm: d,
    rating: r,
    availability: 'AVAILABLE' as const,
  });

  it('orders by distance, then rating desc, then id', () => {
    const out = rankCandidates([c('d', 2, 4), c('b', 1, 4.1), c('a', 1, 4.9), c('c', 1, 4.1)]);
    expect(out.map((x) => x.technicianId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('applies the limit without mutating input', () => {
    const input = [c('a', 3, 1), c('b', 1, 1), c('c', 2, 1)];
    expect(rankCandidates(input, 2).map((x) => x.technicianId)).toEqual(['b', 'c']);
    expect(input[0]!.technicianId).toBe('a');
  });

  it('handles empty input', () => {
    expect(rankCandidates([])).toEqual([]);
  });

  it('toNearby exposes only the public fields with a server quote', () => {
    const n = toNearby(c('x', 1, 4.5), 'ELECTRICAL_INSPECTION');
    expect(Object.keys(n).sort()).toEqual([
      'availability',
      'distanceKm',
      'name',
      'quoteMinor',
      'rating',
      'technicianId',
    ]);
    expect(n.quoteMinor).toBe(46500);
  });
});

describe('otp', () => {
  const secret = 's'.repeat(32);

  it('generates 6 digits, zero padded, from the injected rng', () => {
    expect(generateOtp(() => 42)).toBe('000042');
    expect(generateOtp(() => 999999)).toBe('999999');
    expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it('verifies in constant time and binds to the request', () => {
    const h = hmacOtp(secret, 'req-1', '123456');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyOtp(secret, 'req-1', '123456', h)).toBe(true);
    expect(verifyOtp(secret, 'req-1', '123457', h)).toBe(false);
    expect(verifyOtp(secret, 'req-2', '123456', h)).toBe(false);
    expect(verifyOtp(secret, 'req-1', '123456', 'zz')).toBe(false);
  });

  const now = new Date('2030-01-01T00:00:00Z');
  const base = {
    attempts: 0,
    maxAttempts: 3,
    lockedUntil: null,
    now,
    lockSeconds: 60,
    correct: false,
    expired: false,
    consumed: false,
  };

  it.each([
    ['correct code', { correct: true }, 'OK', 0, false],
    ['wrong code increments', { attempts: 1 }, 'INVALID', 2, false],
    ['final wrong attempt locks and resets counter', { attempts: 2 }, 'INVALID', 0, true],
    ['expired is uniform INVALID and not counted', { expired: true, correct: true }, 'INVALID', 0, false],
    ['consumed (replay) is INVALID', { consumed: true, correct: true }, 'INVALID', 0, false],
    [
      'active lock blocks even correct code',
      { lockedUntil: new Date(now.getTime() + 5000), correct: true, attempts: 2 },
      'LOCKED',
      2,
      true,
    ],
    [
      'expired lock grants fresh budget',
      { lockedUntil: new Date(now.getTime() - 1000), attempts: 2 },
      'INVALID',
      1,
      false,
    ],
  ] as [string, Partial<typeof base>, string, number, boolean][])(
    '%s',
    (_n, patch, outcome, attempts, locked) => {
      const r = evaluateOtpAttempt({ ...base, ...patch });
      expect(r.outcome).toBe(outcome);
      expect(r.attempts).toBe(attempts);
      expect(r.lockedUntil !== null).toBe(locked);
    },
  );

  it('lock duration is applied from now', () => {
    const r = evaluateOtpAttempt({ ...base, attempts: 2 });
    expect(r.lockedUntil!.getTime()).toBe(now.getTime() + 60_000);
  });
});

describe('hash', () => {
  it('is key-order independent and ignores undefined', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}');
    expect(requestHash({ a: 1, b: 2 })).toBe(requestHash({ b: 2, a: 1 }));
    expect(requestHash({ a: 1 })).not.toBe(requestHash({ a: 2 }));
    expect(stableStringify(undefined)).toBe('null');
  });
});
