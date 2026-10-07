import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  AdminAuditQuerySchema,
  AdminCancelSchema,
  AdminJobsQuerySchema,
  AdminReassignSchema,
  ArriveSchema,
  AvailabilityUpdateSchema,
  ConfirmSchema,
  CreateRequestSchema,
  EvidenceFinalizeSchema,
  EvidenceIntentSchema,
  LocationPingSchema,
  LoginSchema,
  NearbyQuerySchema,
  RefreshSchema,
  ReviewSchema,
  SnapshotQuerySchema,
  UpdateRequestSchema,
} from '@dispatch/contracts';

// DTO classes are derived from the shared zod schemas (all .strict(): unknown keys are rejected).
export class LoginBody extends createZodDto(LoginSchema) {}
export class RefreshBody extends createZodDto(RefreshSchema) {}
export class CreateRequestBody extends createZodDto(CreateRequestSchema) {}
export class UpdateRequestBody extends createZodDto(UpdateRequestSchema) {}
export class NearbyQueryDto extends createZodDto(NearbyQuerySchema) {}
export class ConfirmBody extends createZodDto(ConfirmSchema) {}
export class ArriveBody extends createZodDto(ArriveSchema) {}
export class EvidenceIntentBody extends createZodDto(EvidenceIntentSchema) {}
export class EvidenceFinalizeBody extends createZodDto(EvidenceFinalizeSchema) {}
export class ReviewBody extends createZodDto(ReviewSchema) {}
export class AvailabilityBody extends createZodDto(AvailabilityUpdateSchema) {}
export class LocationPingBody extends createZodDto(LocationPingSchema) {}
export class SnapshotQueryDto extends createZodDto(SnapshotQuerySchema) {}
export class AdminReassignBody extends createZodDto(AdminReassignSchema) {}
export class AdminCancelBody extends createZodDto(AdminCancelSchema) {}
export class AdminJobsQueryDto extends createZodDto(AdminJobsQuerySchema) {}
export class AdminAuditQueryDto extends createZodDto(AdminAuditQuerySchema) {}

export class HistoryQueryDto extends createZodDto(
  z.object({ page: z.coerce.number().int().positive().default(1) }).strict(),
) {}
