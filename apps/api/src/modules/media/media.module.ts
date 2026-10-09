import { Module } from '@nestjs/common';
import type { Env } from '@dispatch/config';
import { APP_CONFIG } from '../../config/config.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { RequestsModule } from '../requests/requests.module';
import { MediaService } from './media.service';
import { MemoryStorageProvider } from './storage/memory.storage';
import { MinioStorageProvider } from './storage/minio.storage';
import { STORAGE_PROVIDER } from './storage/storage.provider';

/** Upload intents, server-generated object keys, metadata and safe (signed, short-lived) access. The bucket is always private. */
@Module({
  imports: [RequestsModule, DispatchModule],
  providers: [
    MediaService,
    {
      provide: STORAGE_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (cfg: Env) =>
        cfg.STORAGE_PROVIDER === 'memory' ? new MemoryStorageProvider() : new MinioStorageProvider(cfg),
    },
  ],
  exports: [MediaService, STORAGE_PROVIDER],
})
export class MediaModule {}
