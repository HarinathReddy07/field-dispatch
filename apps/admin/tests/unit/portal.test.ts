import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { ApiError } from '../../lib/client.ts';
import { correlationOf, friendlyMessage, outcomeUnknown } from '../../lib/errors.ts';
import { preparePhoto, sha256Fallback, sniffImageType } from '../../lib/evidence.ts';
import { isAllowedGatewayPath } from '../../lib/gateway.ts';
import { uuid } from '../../lib/ids.ts';
import {
  defaultWindow,
  formatLatLon,
  fromLocalInput,
  isValidLatLon,
  toLocalInput,
} from '../../lib/location.ts';
import { clock, etaMinutes, jobHref, nextStepLabel, secondsUntilServer } from '../../lib/portal.ts';
import { homeFor, isRole } from '../../lib/roles.ts';

test('every role lands in its own area; unknown roles go to login', () => {
  assert.equal(homeFor('ADMIN'), '/admin');
  assert.equal(homeFor('REQUESTER'), '/app');
  assert.equal(homeFor('TECHNICIAN'), '/tech');
  assert.equal(homeFor('SOMETHING'), '/login');
  assert.equal(isRole('ADMIN'), true);
  assert.equal(isRole('admin'), false);
});

test('gateway forwards only the routes the web UI uses', () => {
  const ok = [
    ['admin', 'summary'],
    ['admin', 'jobs', '3f9a1c5e-0000-4000-8000-000000000000', 'cancel'],
    ['requests'],
    ['requests', 'active'],
    ['requests', 'history'],
    ['requests', '3f9a1c5e-0000-4000-8000-000000000000', 'evidence', 'intent'],
    ['requests', '3f9a1c5e-0000-4000-8000-000000000000', 'nearby-technicians'],
    ['technicians', 'me', 'availability'],
    ['technicians', 'me', 'location'],
    ['users', 'me'],
    ['auth', 'me'],
  ];
  for (const p of ok) assert.equal(isAllowedGatewayPath(p), true, p.join('/'));

  const refused = [
    [],
    ['auth', 'login'],
    ['auth', 'refresh'],
    ['auth', 'logout'],
    ['health', 'ready'],
    ['admin'],
    ['..', 'auth', 'login'],
    ['admin', '..', 'auth', 'login'],
    ['requests', '.', 'x'],
    ['requests', '..%2fauth'],
    ['requests', 'a/b'],
    ['requests', 'a\\b'],
    ['requests', ''],
    ['technicians', 'me', 'other'],
    ['technicians', 'someone-else', 'availability'],
    ['users', 'other'],
  ];
  for (const p of refused) assert.equal(isAllowedGatewayPath(p), false, JSON.stringify(p));
});

test('image sniffing and SHA-256 agree with Node for JPEG and PNG', async () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  assert.equal(sniffImageType(jpeg), 'image/jpeg');
  assert.equal(sniffImageType(png), 'image/png');
  assert.equal(sniffImageType(Uint8Array.from([0x47, 0x49, 0x46, 0x38])), null); // GIF
  assert.equal(sniffImageType(new Uint8Array(0)), null);

  const p = await preparePhoto(new Blob([jpeg]));
  assert.equal(p.contentType, 'image/jpeg');
  assert.equal(p.sizeBytes, jpeg.length);
  assert.equal(p.sha256, createHash('sha256').update(jpeg).digest('hex'));

  await assert.rejects(preparePhoto(new Blob([new Uint8Array(10)])), /JPEG or PNG/);
  await assert.rejects(preparePhoto(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)])), /larger than 5 MB/);
});

test('the pure SHA-256 fallback matches known vectors and Node on awkward sizes', () => {
  const enc = new TextEncoder();
  assert.equal(
    sha256Fallback(enc.encode('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    sha256Fallback(new Uint8Array(0)),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
  for (const n of [1, 55, 56, 57, 63, 64, 65, 119, 120, 1000, 70_000]) {
    const bytes = new Uint8Array(randomBytes(n));
    assert.equal(sha256Fallback(bytes), createHash('sha256').update(bytes).digest('hex'), `length ${n}`);
  }
});

test('idempotency keys are valid and unique', () => {
  const a = uuid();
  const b = uuid();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_.:-]{8,128}$/);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('errors are shown in plain words, never as codes', () => {
  const cases: [ApiError, RegExp][] = [
    [new ApiError(0, 'NETWORK', 'x'), /reach the server/],
    [new ApiError(409, 'TECHNICIAN_UNAVAILABLE', 'x'), /pick another/i],
    [new ApiError(409, 'EVIDENCE_REQUIRED', 'x'), /two photos/],
    [new ApiError(400, 'OTP_INVALID', 'x'), /isn’t valid/],
    [new ApiError(429, 'OTP_LOCKED', 'x'), /Too many attempts/],
    [new ApiError(500, 'INTERNAL', 'boom'), /our side/],
    [new ApiError(418, 'WHO_KNOWS', 'raw message'), /didn’t work/],
  ];
  for (const [e, re] of cases) {
    assert.match(friendlyMessage(e), re);
    assert.doesNotMatch(friendlyMessage(e), /[A-Z]{3,}_[A-Z]{3,}/);
  }
  assert.match(friendlyMessage(new Error('x')), /Something went wrong/);
  assert.equal(correlationOf(new ApiError(500, 'INTERNAL', 'x', undefined, 'abc-123')), 'abc-123');
  assert.equal(outcomeUnknown(new ApiError(0, 'NETWORK', 'x')), true);
  assert.equal(outcomeUnknown(new ApiError(503, 'X', 'x')), true);
  assert.equal(outcomeUnknown(new ApiError(409, 'STATE_CONFLICT', 'x')), false);
});

test('job links and button labels follow role and state', () => {
  const id = 'abc';
  assert.equal(jobHref('REQUESTER', { id, state: 'REQUESTED' }), '/app/requests/abc/technicians');
  assert.equal(jobHref('REQUESTER', { id, state: 'MATCHED' }), '/app/requests/abc/technicians');
  assert.equal(jobHref('REQUESTER', { id, state: 'CONFIRMED' }), '/app/requests/abc');
  assert.equal(jobHref('TECHNICIAN', { id, state: 'CONFIRMED' }), '/tech/jobs/abc');
  assert.equal(nextStepLabel('REQUESTER', 'CONFIRMED'), 'Show my code');
  assert.equal(nextStepLabel('REQUESTER', 'UNDER_REVIEW'), 'Review the work');
  assert.equal(nextStepLabel('TECHNICIAN', 'ARRIVED'), 'Start work');
  assert.equal(nextStepLabel('TECHNICIAN', 'UNDER_REVIEW'), null);
});

test('countdowns follow the server clock, not the device clock', () => {
  const fetchedAt = Date.parse('2099-01-01T00:00:00Z'); // device clock is far off
  const serverTime = '2030-01-01T10:00:00Z';
  const deadline = '2030-01-01T10:10:00Z';
  assert.equal(secondsUntilServer(deadline, serverTime, fetchedAt, fetchedAt), 600);
  assert.equal(secondsUntilServer(deadline, serverTime, fetchedAt, fetchedAt + 90_000), 510);
  assert.equal(secondsUntilServer(deadline, serverTime, fetchedAt, fetchedAt + 9_999_000), 0);
  assert.equal(secondsUntilServer(null, serverTime, fetchedAt, fetchedAt), null);
  assert.equal(clock(null), '--:--');
  assert.equal(clock(65), '01:05');
  assert.equal(clock(3725), '1:02:05');
  assert.equal(etaMinutes(0.1), 1);
  assert.equal(etaMinutes(5), 12);
});

test('booking window helpers', () => {
  const now = new Date(2030, 0, 1, 9, 7, 30); // local time
  const w = defaultWindow(now);
  assert.equal(w.start, '2030-01-01T10:15'); // 10:07 rounds up to the next quarter hour
  assert.equal(w.end, '2030-01-01T12:15');
  assert.equal(toLocalInput(new Date(2030, 5, 7, 4, 5)), '2030-06-07T04:05');
  assert.equal(fromLocalInput(''), null);
  assert.equal(fromLocalInput('not a date'), null);
  assert.equal(fromLocalInput(w.start), new Date(2030, 0, 1, 10, 15).toISOString());
  assert.equal(isValidLatLon({ lat: 12.9, lon: 77.6 }), true);
  assert.equal(isValidLatLon({ lat: 91, lon: 0 }), false);
  assert.equal(isValidLatLon({ lat: Number.NaN, lon: 0 }), false);
  assert.equal(formatLatLon({ lat: 12.97483, lon: 77.60331 }), '12.9748, 77.6033');
});

test('booking validation explains each problem in plain words', async () => {
  const { validateBooking } = await import('../../lib/booking.ts');
  const now = new Date(2030, 0, 1, 9, 0);
  const good = {
    assetId: ' PANEL-BLR-0042 ',
    category: 'ELECTRICAL_INSPECTION' as const,
    site: { lat: 12.9748, lon: 77.6033 },
    start: '2030-01-01T10:00',
    end: '2030-01-01T12:00',
    notes: '  ',
  };
  const ok = validateBooking(good, now);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.dto.assetId, 'PANEL-BLR-0042'); // trimmed
    assert.equal(ok.dto.notes, undefined); // blank notes are not sent
    assert.equal(ok.dto.windowStart, new Date(2030, 0, 1, 10, 0).toISOString());
  }

  const bad = validateBooking({ ...good, assetId: ' ', site: null, start: '', end: '' }, now);
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.match(bad.errors.assetId ?? '', /asset ID/);
    assert.match(bad.errors.site ?? '', /map/);
    assert.match(bad.errors.start ?? '', /start/);
    assert.match(bad.errors.end ?? '', /ends/);
  }

  const backwards = validateBooking({ ...good, start: '2030-01-01T12:00', end: '2030-01-01T10:00' }, now);
  assert.equal(backwards.ok, false);
  if (!backwards.ok) assert.match(backwards.errors.end ?? '', /after it starts/);

  const past = validateBooking({ ...good, start: '2030-01-01T08:00', end: '2030-01-01T10:00' }, now);
  assert.equal(past.ok, false);
  if (!past.ok) assert.match(past.errors.start ?? '', /past/);

  const recent = validateBooking({ ...good, start: '2030-01-01T08:57', end: '2030-01-01T10:00' }, now);
  assert.equal(recent.ok, true); // a few minutes of grace for a form left open

  const longNotes = validateBooking({ ...good, notes: 'x'.repeat(1001) }, now);
  assert.equal(longNotes.ok, false);
});

test('csv export neutralises spreadsheet formulas and quotes awkward text', async () => {
  const { csvCell, toCsv } = await import('../../lib/csv.ts');
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell(42), '42');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  for (const evil of ['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd']) {
    assert.ok(csvCell(evil).startsWith("'") || csvCell(evil).startsWith('"\''), evil);
  }
  assert.equal(
    toCsv([
      ['a', 1],
      ['b,c', null],
    ]),
    'a,1\r\n"b,c",\r\n',
  );
});

test('timeline merges photo uploads and attaches the rework reason to its step', async () => {
  const { toEntries } = await import('../../lib/timeline.ts');
  let seq = 0;
  const ev = (type: string, data: Record<string, unknown>) => ({
    eventId: `e${++seq}`,
    occurredAt: `2030-01-01T10:00:${String(seq).padStart(2, '0')}Z`,
    schemaVersion: 1 as const,
    seq,
    type: type as never,
    requestId: 'r',
    data,
  });
  const entries = toEntries([
    ev('request.created', {}),
    ev('request.state.changed', { from: 'REQUESTED', to: 'MATCHED' }),
    ev('request.state.changed', { from: 'MATCHED', to: 'CONFIRMED' }),
    ev('evidence.uploaded', {}),
    ev('evidence.uploaded', {}),
    ev('evidence.uploaded', {}),
    ev('request.state.changed', { from: 'UNDER_REVIEW', to: 'REWORK' }),
    ev('review.requested', { reason: 'Too blurry' }),
    ev('evidence.uploaded', {}),
    ev('settlement.created', { amountMinor: 46500 }),
  ]);
  assert.deepEqual(
    entries.map((e) => e.text),
    [
      'Request created',
      'Technician booked',
      '3 photos were added',
      'Rework requested',
      'A photo was added',
      'Payment recorded',
    ],
  );
  const rework = entries.find((e) => e.state === 'REWORK');
  assert.equal(rework?.detail, 'Too blurry');
  assert.equal(rework?.detailKind, 'reason');
  const pay = entries.at(-1);
  assert.equal(pay?.detail, '₹465.00');
  assert.equal(pay?.detailKind, 'plain'); // an amount is not a quoted reason

  // the reason may arrive before the status change; duplicates by eventId are ignored
  const rev = ev('review.requested', { reason: 'Redo it' });
  const st = ev('request.state.changed', { from: 'UNDER_REVIEW', to: 'REWORK' });
  const dup = ev('evidence.uploaded', {});
  const flipped = toEntries([rev, st, dup, dup]);
  assert.equal(flipped.filter((e) => e.text.startsWith('Rework')).length, 1);
  assert.equal(flipped[0]?.detail, 'Redo it');
  assert.equal(flipped.filter((e) => e.photos).length, 1);
});
