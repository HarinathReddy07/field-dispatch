import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { Env } from '@dispatch/config';
import { APP_CONFIG } from '../config/config.module';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(APP_CONFIG) cfg: Env) {
    this.client = new Redis(cfg.REDIS_URL, { maxRetriesPerRequest: 2, enableReadyCheck: true });
    this.client.on('error', () => undefined); // surfaced through /health/ready, not crashes
  }

  duplicate(): Redis {
    return this.client.duplicate();
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Fixed-window counter. The key is created with its TTL first (SET NX EX) so a crash
   * between INCR and EXPIRE can never leave a counter without an expiry.
   * Returns the count after increment.
   */
  async hit(key: string, windowSeconds: number): Promise<number> {
    await this.client.set(key, 0, 'EX', windowSeconds, 'NX');
    return this.client.incr(key);
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
