import { computeExceptionFlags } from './exceptions';
import { detectImageType, extensionFor } from './media';

describe('media magic bytes', () => {
  it('detects PNG and JPEG by signature, not by declared type', () => {
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe(
      'image/png',
    );
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('image/jpeg');
  });
  it.each([
    ['empty', []],
    ['text', [...Buffer.from('<?php echo 1;')]],
    ['gif', [...Buffer.from('GIF89a')]],
    ['truncated png', [0x89, 0x50, 0x4e]],
    ['svg', [...Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')]],
  ])('rejects %s', (_n, bytes) => {
    expect(detectImageType(Buffer.from(bytes))).toBeNull();
  });
  it('maps extensions', () => {
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/jpeg')).toBe('jpg');
  });
});

describe('exception flags', () => {
  const now = new Date('2030-01-01T12:00:00Z');
  const base = {
    state: 'IN_PROGRESS' as const,
    workCycle: 1,
    createdAt: new Date('2030-01-01T11:59:00Z'),
    reviewDeadlineAt: null,
    technicianLastSeenAt: new Date('2030-01-01T11:59:30Z'),
    now,
    freshnessSeconds: 300,
  };
  it('healthy in-progress job has no flags', () => expect(computeExceptionFlags(base)).toEqual([]));
  it('flags a stale technician on a field job', () => {
    expect(
      computeExceptionFlags({ ...base, technicianLastSeenAt: new Date('2030-01-01T11:00:00Z') }),
    ).toEqual(['TECHNICIAN_STALE']);
    expect(computeExceptionFlags({ ...base, technicianLastSeenAt: null })).toEqual(['TECHNICIAN_STALE']);
  });
  it('flags requests without a technician after 5 minutes', () => {
    const old = { ...base, state: 'MATCHING' as const, createdAt: new Date('2030-01-01T11:50:00Z') };
    expect(computeExceptionFlags(old)).toEqual(['NO_TECHNICIAN']);
    expect(computeExceptionFlags({ ...old, createdAt: new Date('2030-01-01T11:58:00Z') })).toEqual([]);
  });
  it('flags overdue review only past the sweeper grace window', () => {
    const review = { ...base, state: 'UNDER_REVIEW' as const };
    expect(computeExceptionFlags({ ...review, reviewDeadlineAt: new Date('2030-01-01T11:59:50Z') })).toEqual(
      [],
    );
    expect(computeExceptionFlags({ ...review, reviewDeadlineAt: new Date('2030-01-01T11:50:00Z') })).toEqual([
      'REVIEW_OVERDUE',
    ]);
  });
  it('flags open and repeated rework; terminal states are never flagged', () => {
    expect(computeExceptionFlags({ ...base, state: 'REWORK_REQUESTED', workCycle: 3 })).toEqual([
      'REWORK_OPEN',
      'MULTIPLE_REWORKS',
    ]);
    expect(computeExceptionFlags({ ...base, state: 'COMPLETED', workCycle: 4 })).toEqual([]);
  });
});
