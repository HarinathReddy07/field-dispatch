import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ZodValidationPipe, patchNestJsSwagger } from 'nestjs-zod';
import type { Env } from '@dispatch/config';
import { AllExceptionsFilter } from './common/exception.filter';
import { resolveCorrelationId } from './common/context';
import { landingDocument } from './common/landing';
import { requireHttps } from './common/transport';
import { API_NAME, API_VERSION } from './common/version';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';

/** HTTP configuration shared by main.ts and the test harness so tests exercise the real pipeline. */
export async function configureApp(app: NestExpressApplication, env: Env): Promise<void> {
  const ws = new RedisIoAdapter(app, env);
  await ws.connectToRedis();
  app.useWebSocketAdapter(ws);
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
  app.set('trust proxy', 1);
  app.use(helmet()); // includes HSTS; meaningful behind TLS
  if (!env.INSECURE_LOCAL_DEV) app.use(requireHttps); // deployable profile: HTTPS/WSS only
  app.enableCors({
    origin: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
    maxAge: 600,
  });
  app.useBodyParser('json', { limit: '100kb' });
  // GET / lives outside the /api/v1 prefix; a plain Express route keeps it out of the Nest router, guards and prefix rules.
  (app.getHttpAdapter().getInstance() as Express).get('/', (req: Request, res: Response) => {
    res.setHeader('x-correlation-id', resolveCorrelationId(req as never));
    res.json(landingDocument(env));
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ZodValidationPipe());

  if (env.SWAGGER_ENABLED) {
    patchNestJsSwagger();
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle(API_NAME)
        .setDescription(
          'Field asset inspection & repair dispatch (trial). Mocks: payments, storage (tests), GPS.',
        )
        .setVersion(API_VERSION)
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }
}
