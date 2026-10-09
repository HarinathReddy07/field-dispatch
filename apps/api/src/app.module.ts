import { DynamicModule, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '@dispatch/config';
import { CorrelationIdMiddleware } from './common/correlation.middleware';
import { buildPinoHttpOptions } from './common/logging';
import type { Writable } from 'node:stream';
import { ConfigModule } from './config/config.module';
import { InfraModule } from './infra/infra.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { JobsModule } from './modules/jobs/jobs.module';
import { MediaModule } from './modules/media/media.module';
import { OtpModule } from './modules/otp/otp.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { TechniciansModule } from './modules/technicians/technicians.module';
import { UsersModule } from './modules/users/users.module';

@Module({})
export class AppModule implements NestModule {
  static forRoot(env: Env, logging: { stream?: Writable; level?: string } = {}): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      imports: [
        ConfigModule.forRoot(env),
        LoggerModule.forRoot({ pinoHttp: buildPinoHttpOptions(env, logging) }),
        InfraModule,
        AuditModule,
        AuthModule,
        UsersModule,
        RequestsModule,
        DispatchModule,
        OtpModule,
        MediaModule,
        SettlementModule,
        JobsModule,
        TechniciansModule,
        RealtimeModule,
        AdminModule,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
