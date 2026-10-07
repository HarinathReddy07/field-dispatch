import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ctxStore, resolveCorrelationId } from './context';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = resolveCorrelationId(req as never);
    res.setHeader('x-correlation-id', correlationId);
    ctxStore.run({ correlationId }, next);
  }
}
