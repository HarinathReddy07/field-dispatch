import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, IdempotencyKey, Roles, Throttle } from '../../common/decorators';
import { ArriveBody, EvidenceFinalizeBody, EvidenceIntentBody, ReviewBody } from '../../common/dtos';
import { JobsService } from './jobs.service';
import { MediaService } from '../media/media.service';
import { OtpService } from '../otp/otp.service';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('requests')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly otp: OtpService,
    private readonly media: MediaService,
  ) {}

  @Roles('REQUESTER')
  @Post(':id/otp')
  @HttpCode(200)
  issueOtp(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.otp.issue(user, id);
  }

  @Roles('TECHNICIAN')
  @Throttle('arrive')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post(':id/arrive')
  @HttpCode(200)
  arrive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ArriveBody,
    @IdempotencyKey() key: string,
  ) {
    return this.otp.arrive(user, id, body.otp, key);
  }

  @Roles('TECHNICIAN')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post(':id/start')
  @HttpCode(200)
  start(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @IdempotencyKey() key: string,
  ) {
    return this.jobs.start(user, id, key);
  }

  @Roles('TECHNICIAN')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post(':id/stop')
  @HttpCode(200)
  stop(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @IdempotencyKey() key: string) {
    return this.jobs.stop(user, id, key);
  }

  @Roles('REQUESTER')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post(':id/review')
  @HttpCode(200)
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewBody,
    @IdempotencyKey() key: string,
  ) {
    return this.jobs.review(user, id, body, key);
  }

  @Roles('REQUESTER')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @IdempotencyKey() key: string,
  ) {
    return this.jobs.cancel(user, id, key);
  }

  @Roles('TECHNICIAN')
  @Post(':id/evidence/intent')
  @HttpCode(200)
  evidenceIntent(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EvidenceIntentBody,
  ) {
    return this.media.createIntent(user, id, body);
  }

  @Roles('TECHNICIAN')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post(':id/evidence')
  @HttpCode(200)
  evidenceFinalize(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EvidenceFinalizeBody,
    @IdempotencyKey() key: string,
  ) {
    return this.media.finalize(user, id, body.mediaId, key);
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'ADMIN')
  @Get(':id/evidence')
  evidence(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.media.list(user, id);
  }
}
