import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { STORAGE_PROVIDER } from '../../src/modules/jobs/storage/storage.provider';
import { MemoryStorageProvider } from '../../src/modules/jobs/storage/memory.storage';
import { ACCOUNTS, TECH_ID, TestCtx, newRequestBody } from './app';

const API = '/api/v1';

export type Who = keyof typeof ACCOUNTS;

/** Drives the real HTTP API through the job lifecycle. No shortcuts: every step is an API call. */
export class Flow {
  private tokens = new Map<string, string>();
  private created: string[] = [];
  constructor(readonly ctx: TestCtx) {}

  async token(who: Who): Promise<string> {
    let t = this.tokens.get(who);
    if (!t) {
      t = await this.ctx.login(ACCOUNTS[who]);
      this.tokens.set(who, t);
    }
    return t;
  }

  get storage(): MemoryStorageProvider {
    return this.ctx.app.get(STORAGE_PROVIDER, { strict: false }) as MemoryStorageProvider;
  }

  private async call(
    method: 'get' | 'post' | 'patch',
    who: Who,
    path: string,
    body?: unknown,
    key?: string | null,
  ) {
    const http = this.ctx.http();
    let req = http[method](`${API}${path}`).set('Authorization', `Bearer ${await this.token(who)}`);
    if (key !== null && method === 'post') req = req.set('Idempotency-Key', key ?? randomUUID());
    return body === undefined ? req : req.send(body as object);
  }

  get = (who: Who, path: string) => this.call('get', who, path);
  post = (who: Who, path: string, body?: unknown, key?: string | null) =>
    this.call('post', who, path, body ?? {}, key);

  async create(requester: Who = 'requester1', over: Record<string, unknown> = {}): Promise<string> {
    const res = await this.post(requester, '/requests', newRequestBody(over), null);
    if (res.status !== 201) throw new Error(`create failed: ${res.status} ${JSON.stringify(res.body)}`);
    this.created.push(res.body.id as string);
    return res.body.id as string;
  }

  /** Cancels every still-open request created by this flow via the real admin API (frees technicians between tests). */
  async cleanup(): Promise<void> {
    const ids = this.created.splice(0);
    for (const id of ids) {
      const job = await this.get('admin', `/admin/jobs/${id}`);
      const state = job.body?.job?.state as string | undefined;
      if (state && state !== 'SETTLED' && state !== 'CANCELLED') {
        await this.post('admin', `/admin/jobs/${id}/cancel`, { reason: 'test cleanup' }, null);
      }
    }
  }

  confirm(id: string, techN = 1, requester: Who = 'requester1', key?: string) {
    return this.post(requester, `/requests/${id}/confirm`, { technicianId: TECH_ID(techN) }, key);
  }

  async assigned(techN = 1, requester: Who = 'requester1'): Promise<string> {
    const id = await this.create(requester);
    await this.get(requester, `/requests/${id}/nearby-technicians`); // REQUESTED -> MATCHED
    const res = await this.confirm(id, techN, requester);
    if (res.status !== 200) throw new Error(`confirm failed: ${res.status} ${JSON.stringify(res.body)}`);
    return id;
  }

  async otp(id: string, requester: Who = 'requester1'): Promise<string> {
    const res = await this.post(requester, `/requests/${id}/otp`, {}, null);
    if (res.status !== 200) throw new Error(`otp failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.otp as string;
  }

  arrive(id: string, tech: Who, otp: string, key?: string) {
    return this.post(tech, `/requests/${id}/arrive`, { otp }, key);
  }

  start = (id: string, tech: Who, key?: string) => this.post(tech, `/requests/${id}/start`, {}, key);
  stop = (id: string, tech: Who, key?: string) => this.post(tech, `/requests/${id}/stop`, {}, key);
  review = (id: string, body: unknown, requester: Who = 'requester1', key?: string) =>
    this.post(requester, `/requests/${id}/review`, body, key);

  async arrived(techN = 1, requester: Who = 'requester1'): Promise<{ id: string; tech: Who }> {
    const id = await this.assigned(techN, requester);
    const tech = `tech${techN}` as Who;
    const res = await this.arrive(id, tech, await this.otp(id, requester));
    if (res.status !== 200) throw new Error(`arrive failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { id, tech };
  }

  async inProgress(techN = 1, requester: Who = 'requester1') {
    const job = await this.arrived(techN, requester);
    const res = await this.start(job.id, job.tech);
    if (res.status !== 200) throw new Error(`start failed: ${res.status} ${JSON.stringify(res.body)}`);
    return job;
  }

  /** intent -> upload to the (mock) presigned URL -> finalize. Returns the finalize response. */
  async uploadEvidence(
    id: string,
    tech: Who,
    opts: { bytes?: Buffer; declared?: 'image/png' | 'image/jpeg' } = {},
  ) {
    const bytes =
      opts.bytes ??
      Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(64)]);
    const intent = await this.post(
      tech,
      `/requests/${id}/evidence/intent`,
      {
        contentType: opts.declared ?? 'image/png',
        sizeBytes: bytes.length,
        checksumSha256: createHash('sha256').update(bytes).digest('hex'),
      },
      null,
    );
    if (intent.status !== 200) return intent;
    expectOk(this.storage.put(intent.body.uploadUrl, bytes));
    return this.post(tech, `/requests/${id}/evidence`, { mediaId: intent.body.mediaId });
  }

  async twoImages(id: string, tech: Who) {
    for (let i = 0; i < 2; i++) {
      const r = await this.uploadEvidence(id, tech);
      if (r.status !== 200) throw new Error(`evidence failed: ${r.status} ${JSON.stringify(r.body)}`);
    }
  }

  async underReview(techN = 1, requester: Who = 'requester1') {
    const job = await this.inProgress(techN, requester);
    await this.twoImages(job.id, job.tech);
    const res = await this.stop(job.id, job.tech);
    if (res.status !== 200) throw new Error(`stop failed: ${res.status} ${JSON.stringify(res.body)}`);
    return job;
  }
}

function expectOk(status: number): void {
  if (status !== 200) throw new Error(`mock upload failed with ${status}`);
}
