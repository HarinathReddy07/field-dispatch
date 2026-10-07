import type { EvidenceIntentResponse } from '@dispatch/contracts';
import { runUpload, type PipelineDeps, type UploadItem } from '../pipeline';

const intent: EvidenceIntentResponse = {
  mediaId: '11111111-1111-4111-8111-111111111111',
  uploadUrl: 'http://storage.test/put',
  method: 'PUT',
  headers: { 'Content-Type': 'image/png' },
  expiresAt: new Date().toISOString(),
};

const base = (): UploadItem => ({
  id: 'i1',
  uri: 'file:///p.png',
  status: 'preparing',
  progress: 0,
  finalizeKey: 'finalize-key-1',
});

function deps(over: Partial<PipelineDeps> = {}): PipelineDeps & { spies: Record<string, jest.Mock> } {
  const spies = {
    prepare: jest.fn(async () => ({
      sizeBytes: 10,
      sha256: 'a'.repeat(64),
      contentType: 'image/png' as const,
    })),
    intent: jest.fn(async () => intent),
    upload: jest.fn(async (_u: string, _f: string, _h: Record<string, string>, p: (f: number) => void) =>
      p(0.5),
    ),
    finalize: jest.fn(async () => ({ finalizedCount: 1 })),
  };
  return { ...spies, ...over, spies };
}

describe('evidence upload pipeline', () => {
  it('runs capture -> intent -> upload -> finalize and reports progress', async () => {
    const d = deps();
    const patches: Partial<UploadItem>[] = [];
    const out = await runUpload(base(), d, (p) => patches.push(p));
    expect(out.status).toBe('done');
    expect(d.spies.intent).toHaveBeenCalledWith({
      contentType: 'image/png',
      sizeBytes: 10,
      checksumSha256: 'a'.repeat(64),
    });
    expect(d.spies.finalize).toHaveBeenCalledWith(intent.mediaId, 'finalize-key-1');
    expect(patches.some((p) => p.progress === 0.5)).toBe(true);
    expect(patches.map((p) => p.status).filter(Boolean)).toEqual([
      'preparing',
      'uploading',
      'finalizing',
      'done',
    ]);
  });

  it('a failed finalize keeps the upload; retry skips prepare/intent/upload and reuses the same Idempotency-Key', async () => {
    let attempt = 0;
    const d = deps({
      finalize: jest.fn(async () => {
        if (++attempt === 1) throw new Error('Network request failed');
        return {};
      }),
    });
    const first = await runUpload(base(), d, () => undefined);
    expect(first.status).toBe('error');
    expect(first.uploaded).toBe(true);

    const second = await runUpload(first, d, () => undefined);
    expect(second.status).toBe('done');
    expect(d.spies.prepare).toHaveBeenCalledTimes(1);
    expect(d.spies.intent).toHaveBeenCalledTimes(1);
    expect(d.spies.upload).toHaveBeenCalledTimes(1); // never uploaded twice
    const keys = (d.finalize as jest.Mock).mock.calls.map((c) => c[1]);
    expect(keys).toEqual(['finalize-key-1', 'finalize-key-1']);
  });

  it('a failed upload is retried from the upload step with the SAME presigned intent', async () => {
    let attempt = 0;
    const d = deps({
      upload: jest.fn(async () => {
        if (++attempt === 1) throw new Error('Upload failed (503)');
      }),
    });
    const failed = await runUpload(base(), d, () => undefined);
    expect(failed).toMatchObject({ status: 'error', error: 'Upload failed (503)' });
    const done = await runUpload(failed, d, () => undefined);
    expect(done.status).toBe('done');
    expect(d.spies.intent).toHaveBeenCalledTimes(1);
  });

  it('surfaces a rejected photo (e.g. not a JPEG/PNG) without calling the API', async () => {
    const d = deps({
      prepare: jest.fn(async () => {
        throw new Error('Only JPEG or PNG photos are accepted.');
      }),
    });
    const out = await runUpload(base(), d, () => undefined);
    expect(out).toMatchObject({ status: 'error', error: 'Only JPEG or PNG photos are accepted.' });
    expect(d.spies.intent).not.toHaveBeenCalled();
  });
});
