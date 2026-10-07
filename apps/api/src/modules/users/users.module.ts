import { Controller, Get, Injectable, Module, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { PrismaService } from '../../infra/prisma.service';

/** Role-safe profile projection: never exposes password hash, status flags or other users' data. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, rating: true },
    });
    if (!u) throw new NotFoundException();
    return { id: u.id, name: u.name, role: u.role, rating: Number(u.rating) };
  }
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles('REQUESTER', 'TECHNICIAN', 'ADMIN')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.profile(user.id);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
