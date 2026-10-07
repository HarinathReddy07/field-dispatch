import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import type { Env } from '@dispatch/config';
import { APP_CONFIG } from '../config/config.module';

export type Tx = Prisma.TransactionClient;
/** Anything that can run raw SQL: the client or an interactive transaction. */
export type Db = Pick<PrismaClient, '$queryRaw' | '$executeRaw'>;

function withPool(url: string): string {
  const u = new URL(url);
  if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '20');
  return u.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) cfg: Env) {
    super({ datasourceUrl: withPool(cfg.DATABASE_URL), log: [] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Interactive transaction (READ COMMITTED). Critical sections take explicit row locks inside. */
  tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(fn, { maxWait: 10_000, timeout: 30_000 });
  }
}

/** Extracts a PostgreSQL SQLSTATE from a Prisma raw-query error, if any. */
export function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; meta?: { code?: string; message?: string } };
  if (err?.meta?.code) return err.meta.code;
  const m =
    /SQLSTATE\s*\(?(\w{5})\)?/.exec(err?.meta?.message ?? '') ??
    /code: "(\w{5})"/.exec(String((e as Error)?.message ?? ''));
  return m?.[1];
}
