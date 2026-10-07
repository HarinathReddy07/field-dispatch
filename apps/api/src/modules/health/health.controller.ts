import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const db = await this.prisma.$queryRaw`SELECT 1`.then(
      () => true,
      () => false,
    );
    const redis = await this.redis.ping();
    const ok = db && redis;
    if (!ok) res.status(503);
    return { status: ok ? 'ok' : 'degraded', checks: { database: db, redis } };
  }
}
