import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STATE_TONE,
  elapsedSeconds,
  formatDuration,
  formatMoney,
  haversineKm,
  timeAgo,
} from '../../lib/format.ts';
import { jwtExpiry } from '../../lib/jwt.ts';

test('elapsed time follows server timestamps, not the client clock', () => {
  const startedAt = '2030-01-01T10:00:00.000Z';
  const serverTime = '2030-01-01T10:05:00.000Z'; // server says 5 min have passed at fetch time
  // client clock is hours off, but only the DELTA since fetch is used
  const fetchedAt = Date.parse('2099-06-01T00:00:00Z');
  assert.equal(elapsedSeconds(startedAt, serverTime, fetchedAt, fetchedAt), 300);
  assert.equal(elapsedSeconds(startedAt, serverTime, fetchedAt, fetchedAt + 30_000), 330);
  assert.equal(elapsedSeconds(null, serverTime, fetchedAt, fetchedAt), null);
  assert.equal(elapsedSeconds(serverTime, startedAt, fetchedAt, fetchedAt), 0); // never negative
});

test('formatDuration', () => {
  assert.equal(formatDuration(null), '—');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3725), '1:02:05');
});

test('formatMoney uses minor units', () => {
  assert.match(formatMoney(52500), /525\.00/);
  assert.equal(formatMoney(null), '—');
});

test('haversine distance is plausible (MG Road to Indiranagar ~4.5 km)', () => {
  const d = haversineKm({ lat: 12.9756, lon: 77.6068 }, { lat: 12.9784, lon: 77.6408 });
  assert.ok(d > 3 && d < 5, String(d));
  assert.equal(haversineKm({ lat: 1, lon: 1 }, { lat: 1, lon: 1 }), 0);
});

test('timeAgo buckets', () => {
  const now = Date.parse('2030-01-01T12:00:00Z');
  assert.equal(timeAgo(null, now), 'never');
  assert.equal(timeAgo('2030-01-01T11:59:58Z', now), 'just now');
  assert.equal(timeAgo('2030-01-01T11:59:00Z', now), '1m ago');
  assert.equal(timeAgo('2030-01-01T09:00:00Z', now), '3h ago');
});

test('every request state has a badge tone', () => {
  for (const s of [
    'DRAFT',
    'REQUESTED',
    'MATCHED',
    'CONFIRMED',
    'ARRIVED',
    'IN_PROGRESS',
    'PROOF_UPLOADED',
    'UNDER_REVIEW',
    'REWORK',
    'COMPLETED',
    'SETTLED',
    'CANCELLED',
  ]) {
    assert.ok(STATE_TONE[s], s);
  }
});

test('jwtExpiry reads exp without verifying', () => {
  const body = Buffer.from(JSON.stringify({ exp: 1234 })).toString('base64url');
  assert.equal(jwtExpiry(`a.${body}.c`), 1234);
  assert.equal(jwtExpiry('garbage'), null);
});
