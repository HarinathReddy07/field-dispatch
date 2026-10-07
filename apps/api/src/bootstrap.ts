import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ZodValidationPipe, patchNestJsSwagger } from 'nestjs-zod';
import type { Env } from '@dispatch/config';
import { AllExceptionsFilter } from './common/exception.filter';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';

/** HTTP configuration shared by main.ts and the test harness so tests exercise the real pipeline. */
export async function configureApp(app: NestExpressApplication, env: Env): Promise<void> {
  const ws = new RedisIoAdapter(app, env);
  await ws.connectToRedis();
  app.useWebSocketAdapter(ws);
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
  app.set('trust proxy', 1);
  app.use(helmet());
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
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ZodValidationPipe());

  if (env.SWAGGER_ENABLED) {
    patchNestJsSwagger();
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Field Dispatch API')
        .setDescription(
          'Field asset inspection & repair dispatch (trial). Mocks: payments, storage (tests), GPS.',
        )
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }
}
