import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LoginBody, RefreshBody } from '../../common/dtos';
import { AuthUser, CurrentUser, Public, Roles, Throttle } from '../../common/decorators';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle('login')
  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginBody) {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @Throttle('login')
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: RefreshBody) {
    return this.auth.refresh(body.refreshToken);
  }

  @ApiBearerAuth()
  @Roles('REQUESTER', 'TECHNICIAN', 'ADMIN')
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.logout(user.id);
  }

  @ApiBearerAuth()
  @Roles('REQUESTER', 'TECHNICIAN', 'ADMIN')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { id: user.id, name: user.name, role: user.role };
  }
}
