import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, IdempotencyKey, Roles } from '../../common/decorators';
import { ConfirmBody, NearbyQueryDto } from '../../common/dtos';
import { DispatchService } from './dispatch.service';

@ApiTags('dispatch')
@ApiBearerAuth()
@Controller('requests')
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Roles('REQUESTER')
  @Get(':id/nearby-technicians')
  nearby(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: NearbyQueryDto,
  ) {
    return this.dispatch.nearby(user, id, query);
  }

  @Roles('REQUESTER')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post(':id/confirm')
  @HttpCode(200)
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmBody,
    @IdempotencyKey() key: string,
  ) {
    return this.dispatch.confirm(user, id, body.technicianId, key);
  }
}
