import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { AdminAuditQueryDto, AdminCancelBody, AdminJobsQueryDto, AdminReassignBody } from '../../common/dtos';
import { AdminService } from './admin.service';

/** Every route here is ADMIN-only (RolesGuard is default-deny; a technician/requester token gets 403). */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('summary')
  summary() {
    return this.admin.summary();
  }

  @Get('jobs')
  jobs(@Query() query: AdminJobsQueryDto) {
    return this.admin.jobs(query);
  }

  @Get('jobs/:id')
  job(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.jobDetail(id);
  }

  @Get('technicians')
  technicians() {
    return this.admin.technicians();
  }

  @Get('audit')
  audit(@Query() query: AdminAuditQueryDto) {
    return this.admin.auditLog(query);
  }

  @Post('jobs/:id/reassign')
  @HttpCode(200)
  reassign(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminReassignBody,
  ) {
    return this.admin.reassign(admin, id, body.technicianId, body.reason);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminCancelBody,
  ) {
    return this.admin.cancel(admin, id, body.reason);
  }
}
