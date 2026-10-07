import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { AuthUser } from '../../common/decorators';
import { Db } from '../../infra/prisma.service';

/**
 * Ownership policy for a request. Anything the caller may not see is reported as NOT_FOUND (404),
 * never 403, so ids can't be probed (IDOR).
 *   REQUESTER  -> owns the request
 *   TECHNICIAN -> has (or had) an assignment on it
 *   ADMIN      -> any
 */
@Injectable()
export class AccessService {
  async canView(db: Db, user: Pick<AuthUser, 'id' | 'role'>, requestId: string): Promise<boolean> {
    const rows = await db.$queryRaw<{ requester_id: string; is_tech: boolean }[]>`
      SELECT r.requester_id::text AS requester_id,
             EXISTS (SELECT 1 FROM assignments a WHERE a.request_id = r.id AND a.technician_id = ${user.id}::uuid) AS is_tech
      FROM service_requests r WHERE r.id = ${requestId}::uuid`;
    const row = rows[0];
    if (!row) return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'REQUESTER') return row.requester_id === user.id;
    return user.role === 'TECHNICIAN' && row.is_tech;
  }

  async assertView(db: Db, user: Pick<AuthUser, 'id' | 'role'>, requestId: string): Promise<void> {
    if (!(await this.canView(db, user, requestId))) throw new AppException('NOT_FOUND');
  }
}
