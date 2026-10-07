import { DynamicModule, Global, Module } from '@nestjs/common';
import type { Env } from '@dispatch/config';

export const APP_CONFIG = 'APP_CONFIG';

@Global()
@Module({})
export class ConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      providers: [{ provide: APP_CONFIG, useValue: env }],
      exports: [APP_CONFIG],
    };
  }
}
