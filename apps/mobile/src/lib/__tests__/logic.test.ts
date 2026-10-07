import { REQUEST_STATES, type RequestState } from '@dispatch/contracts';
import { base64ToBytes, bytesToHex, sniffImageType } from '../base64';
import { etaMinutes, haversineKm, simulateRoute } from '../route';
import { actionsFor, isFinished, stateUi } from '../state-ui';
import { elapsedSeconds, formatClock, secondsUntil, serverOffsetMs } from '../timer';

describe('server-driven timer', () => {
  it('uses the server clock offset, so a wrong device clock does not change elapsed time', () => {
    const startedAt = '2030-01-01T10:00:00.000Z';
    const serverTime = '2030-01-01T10:05:00.000Z'; // server: 5 minutes after start
    const deviceClockAtReceipt = Date.parse('2031-06-01T00:00:00Z'); // device clock is a year off
    const offset = serverOffsetMs(serverTime, deviceClockAtReceipt);
    expect(elapsedSeconds(startedAt, offset, deviceClockAtReceipt)).toBe(300);
    expect(elapsedSeconds(startedAt, offset, deviceClockAtReceipt + 45_000)).toBe(345); // keeps ticking
  });

  it('is null without a start time and never negative', () => {
    expect(elapsedSeconds(null, 0, Date.now())).toBeNull();
    expect(elapsedSeconds('2030-01-01T10:00:00Z', 0, Date.parse('2029-01-01T00:00:00Z'))).toBe(0);
  });

  it('counts down to the review deadline on server time', () => {
    const now = Date.parse('2030-01-01T10:00:00Z');
    expect(secondsUntil('2030-01-01T10:10:00Z', 0, now)).toBe(600);
    expect(secondsUntil('2030-01-01T09:00:00Z', 0, now)).toBe(0);
    expect(secondsUntil(null, 0, now)).toBeNull();
  });

  it('formats clocks', () => {
    expect(formatClock(null)).toBe('--:--');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('state to UI mapping', () => {
  it('every backend state has a label and tone for both app roles', () => {
    for (const s of REQUEST_STATES) {
      for (const role of ['REQUESTER', 'TECHNICIAN'] as const) {
        const ui = stateUi(role, s);
        expect(ui.label.length).toBeGreaterThan(0);
        expect(ui.tone).toBeDefined();
        expect(ui.headline.length).toBeGreaterThan(0);
      }
    }
  });

  const cases: [string, RequestState, string[]][] = [
    ['REQUESTER', 'REQUESTED', ['FIND_TECHNICIAN', 'CANCEL']],
    ['REQUESTER', 'MATCHED', ['PICK_TECHNICIAN', 'CANCEL']],
    ['REQUESTER', 'CONFIRMED', ['SHOW_OTP', 'CANCEL']],
    ['REQUESTER', 'UNDER_REVIEW', ['REVIEW']],
    ['REQUESTER', 'SETTLED', ['RECEIPT']],
    ['TECHNICIAN', 'CONFIRMED', ['ENTER_OTP']],
    ['TECHNICIAN', 'ARRIVED', ['START']],
    ['TECHNICIAN', 'IN_PROGRESS', ['UPLOAD_EVIDENCE', 'FINISH']],
    ['TECHNICIAN', 'REWORK', ['UPLOAD_EVIDENCE', 'FINISH']],
    ['TECHNICIAN', 'UNDER_REVIEW', []],
    ['ADMIN', 'IN_PROGRESS', []],
  ];
  it.each(cases)('%s in %s -> %j', (role, state, expected) => {
    expect(actionsFor(role as never, state)).toEqual(expected);
  });

  it('a requester is never offered technician controls and vice versa', () => {
    for (const s of REQUEST_STATES) {
      expect(actionsFor('REQUESTER', s)).not.toEqual(expect.arrayContaining(['ENTER_OTP']));
      expect(actionsFor('REQUESTER', s)).not.toEqual(expect.arrayContaining(['START']));
      expect(actionsFor('TECHNICIAN', s)).not.toEqual(expect.arrayContaining(['REVIEW']));
      expect(actionsFor('TECHNICIAN', s)).not.toEqual(expect.arrayContaining(['SHOW_OTP']));
    }
  });

  it('knows which states are finished', () => {
    expect(isFinished('SETTLED')).toBe(true);
    expect(isFinished('CANCELLED')).toBe(true);
    expect(isFinished('IN_PROGRESS')).toBe(false);
  });
});

describe('route simulation and geometry', () => {
  it('produces steps+1 samples ending exactly at the destination', () => {
    const r = simulateRoute({ lat: 0, lon: 0 }, { lat: 1, lon: 2 }, 4);
    expect(r).toHaveLength(5);
    expect(r[0]).toEqual({ lat: 0, lon: 0 });
    expect(r[4]).toEqual({ lat: 1, lon: 2 });
    expect(r[2]).toEqual({ lat: 0.5, lon: 1 });
  });
  it('haversine and eta are plausible', () => {
    const d = haversineKm({ lat: 12.9756, lon: 77.6068 }, { lat: 12.9784, lon: 77.6408 });
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(5);
    expect(etaMinutes(0)).toBe(1);
    expect(etaMinutes(25)).toBe(60);
  });
});

describe('base64 and image sniffing', () => {
  it('decodes base64 to bytes and hex', () => {
    expect(bytesToHex(base64ToBytes('SGVsbG8='))).toBe('48656c6c6f'); // "Hello"
    expect(base64ToBytes('')).toHaveLength(0);
    expect(() => base64ToBytes('!!!')).toThrow();
  });
  it('detects PNG/JPEG signatures and rejects everything else', () => {
    expect(sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      'image/png',
    );
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(Uint8Array.from([0x47, 0x49, 0x46]))).toBeNull(); // gif
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});
