import { Injectable, NotFoundException } from '@nestjs/common';
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
