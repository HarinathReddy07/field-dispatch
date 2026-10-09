import { Body, Controller, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { AvailabilityBody, LocationPingBody } from '../../common/dtos';
import { TechniciansService } from './technicians.service';

@ApiTags('technicians')
@ApiBearerAuth()
@Controller('technicians/me')
export class TechniciansController {
  constructor(private readonly technicians: TechniciansService) {}

  @Roles('TECHNICIAN')
  @Patch('availability')
  availability(@CurrentUser() user: AuthUser, @Body() body: AvailabilityBody) {
    return this.technicians.setAvailability(user, body.status);
  }

  @Roles('TECHNICIAN')
  @Post('location')
  @HttpCode(202)
  location(@CurrentUser() user: AuthUser, @Body() body: LocationPingBody) {
    return this.technicians.ingestLocation(user, body.lat, body.lon);
  }
}
