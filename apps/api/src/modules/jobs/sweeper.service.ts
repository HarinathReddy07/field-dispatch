import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { Env } from '@dispatch/config';
import { APP_CONFIG } from '../../config/config.module';
import { PrismaService } from '../../infra/prisma.service';
import { lockRequest } from '../../infra/request-sql';
import { JobsService } from './jobs.service';

/**
 * Review-timeout auto-approval.
 *  - Restart-safe: the deadline is persisted (`review_deadline_at`); nothing lives in process memory.
 *  - Multi-instance-safe: each row is claimed with FOR UPDATE SKIP LOCKED, so two sweepers never process the same job.
 *  - Same domain path as a manual approval (JobsService.completeIn), so the settlement/audit/events are identical.
 */
@Injectable()
export class SweeperService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SweeperService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.cfg.BACKGROUND_JOBS) return;
    this.timer = setInterval(() => {
      this.runOnce().catch((e) =>
        this.logger.error(`sweep failed: ${e instanceof Error ? e.message : String(e)}`),
      );
    }, this.cfg.SWEEPER_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Auto-approves every overdue review. Returns how many jobs this instance completed. */
  async runOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const due = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id::text AS id FROM service_requests
        WHERE state = 'UNDER_REVIEW' AND review_deadline_at <= now()
        ORDER BY review_deadline_at LIMIT 50`;
      let completed = 0;
      for (const { id } of due) {
        const done = await this.prisma.tx(async (tx) => {
          // Claim: skip rows another instance holds; re-check the condition under the lock.
          const claimed = await tx.$queryRaw<{ id: string }[]>`
            SELECT id::text AS id FROM service_requests
            WHERE id = ${id}::uuid AND state = 'UNDER_REVIEW' AND review_deadline_at <= now()
            FOR UPDATE SKIP LOCKED`;
          if (claimed.length === 0) return false;
          await lockRequest(tx, id);
          await this.jobs.completeIn(tx, id, 'AUTO_APPROVE', { id: null, role: 'SYSTEM' });
          return true;
        });
        if (done) completed += 1;
      }
      if (completed > 0) this.logger.log(`auto-approved ${completed} overdue review(s)`);
      return completed;
    } finally {
      this.running = false;
    }
  }
}
