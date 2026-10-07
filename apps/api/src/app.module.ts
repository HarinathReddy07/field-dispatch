import { DynamicModule, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '@dispatch/config';
import { CorrelationIdMiddleware } from './common/correlation.middleware';
import { resolveCorrelationId } from './common/context';
import { ConfigModule } from './config/config.module';
import { InfraModule } from './infra/infra.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { RequestsModule } from './modules/requests/requests.module';
import { TechniciansModule } from './modules/technicians/technicians.module';
import { UsersModule } from './modules/users/users.module';

@Module({})
export class AppModule implements NestModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      imports: [
        ConfigModule.forRoot(env),
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.NODE_ENV === 'test' ? 'silent' : 'info',
            genReqId: (req) => resolveCorrelationId(req as never),
            customProps: (req) => ({ correlationId: (req as { id?: string }).id }),
            // Only an allow-list of request fields is logged (no headers, no bodies), plus defence-in-depth redaction.
            serializers: {
              req: (req: { id: string; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url.split('?')[0],
              }),
              res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.otp',
                'req.body.refreshToken',
                '*.password',
                '*.otp',
                '*.token',
                '*.accessToken',
                '*.refreshToken',
                '*.otp_hmac',
              ],
              censor: '[REDACTED]',
            },
            autoLogging: { ignore: (req) => (req.url ?? '').includes('/health/') },
          },
        }),
        InfraModule,
        AuthModule,
        UsersModule,
        RequestsModule,
        TechniciansModule,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
