import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, IdempotencyKey, Roles } from '../../common/decorators';
import {
  ConfirmBody,
  CreateRequestBody,
  HistoryQueryDto,
  NearbyQueryDto,
  SnapshotQueryDto,
} from '../../common/dtos';
import { DispatchService } from './dispatch.service';
import { RequestsService } from './requests.service';

@ApiTags('requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly dispatch: DispatchService,
  ) {}

  @Roles('REQUESTER')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateRequestBody) {
    return this.requests.create(user, body);
  }

  // Static routes are declared before ':id' so they are never captured by the param route.
  @Roles('REQUESTER', 'TECHNICIAN')
  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query() query: HistoryQueryDto) {
    return this.requests.history(user, query.page);
  }

  @Roles('REQUESTER', 'TECHNICIAN')
  @Get('active')
  active(@CurrentUser() user: AuthUser) {
    return this.requests.active(user);
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'ADMIN')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.get(user, id);
  }

  @Roles('REQUESTER', 'TECHNICIAN', 'ADMIN')
  @Get(':id/snapshot')
  snapshot(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SnapshotQueryDto,
  ) {
    return this.requests.snapshot(user, id, query.since ?? 0);
  }

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

  @Roles('REQUESTER')
  @Post(':id/reorder')
  reorder(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.reorder(user, id);
  }
}
