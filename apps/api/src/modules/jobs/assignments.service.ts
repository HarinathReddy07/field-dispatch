import { Injectable } from '@nestjs/common';
import { Db, Tx } from '../../infra/prisma.service';

@Injectable()
export class AssignmentsService {
  /** True when `userId` is the technician holding the ACTIVE assignment on the request. */
  async isActiveAssignee(db: Db, requestId: string, userId: string): Promise<boolean> {
    const rows = await db.$queryRaw<{ one: number }[]>`
      SELECT 1 AS one FROM assignments
      WHERE request_id = ${requestId}::uuid AND technician_id = ${userId}::uuid AND status = 'ACTIVE'`;
    return rows.length > 0;
  }

  async activeTechnician(
    db: Db,
    requestId: string,
  ): Promise<{ assignmentId: string; technicianId: string } | null> {
    const rows = await db.$queryRaw<{ assignment_id: string; technician_id: string }[]>`
      SELECT id::text AS assignment_id, technician_id::text AS technician_id
      FROM assignments WHERE request_id = ${requestId}::uuid AND status = 'ACTIVE'`;
    return rows[0] ? { assignmentId: rows[0].assignment_id, technicianId: rows[0].technician_id } : null;
  }

  /**
   * Ends the active assignment and frees the technician (BUSY -> AVAILABLE).
   * Call AFTER TransitionService.apply so the technician is still part of that event's audience.
   */
  async endActive(
    tx: Tx,
    requestId: string,
    status: 'COMPLETED' | 'CANCELLED' | 'REASSIGNED',
    reason?: string,
  ): Promise<string | null> {
    const rows = await tx.$queryRaw<{ technician_id: string }[]>`
      UPDATE assignments SET status = ${status}, ended_at = now(), end_reason = ${reason ?? null}
      WHERE request_id = ${requestId}::uuid AND status = 'ACTIVE'
      RETURNING technician_id::text AS technician_id`;
    const technicianId = rows[0]?.technician_id ?? null;
    if (technicianId) {
      await tx.$executeRaw`
        UPDATE technicians SET availability_status = 'AVAILABLE'
        WHERE user_id = ${technicianId}::uuid AND availability_status = 'BUSY'
          AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.technician_id = ${technicianId}::uuid AND a.status = 'ACTIVE')`;
    }
    return technicianId;
  }
}
