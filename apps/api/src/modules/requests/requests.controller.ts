import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { CreateRequestBody, HistoryQueryDto, SnapshotQueryDto, UpdateRequestBody } from '../../common/dtos';
import { RequestsService } from './requests.service';

@ApiTags('requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Roles('REQUESTER')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateRequestBody) {
    return this.requests.create(user, body);
  }

  @Roles('REQUESTER')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRequestBody,
  ) {
    return this.requests.update(user, id, body);
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
  @Post(':id/reorder')
  reorder(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.reorder(user, id);
  }
}
