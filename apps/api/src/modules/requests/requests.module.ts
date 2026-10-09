import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { RequestsController } from './requests.controller';
import { RequestsRepository } from './requests.repository';
import { RequestsService } from './requests.service';

@Module({
  controllers: [RequestsController],
  providers: [RequestsService, RequestsRepository, AccessService],
  exports: [RequestsService, RequestsRepository, AccessService],
})
export class RequestsModule {}
