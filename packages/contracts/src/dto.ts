import { z } from 'zod';
import {
  AvailabilityStatusSchema,
  CategorySchema,
  RequestStateSchema,
  RoleSchema,
  SettlementStatusSchema,
} from './enums';

const strict = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const LatSchema = z.number().min(-90).max(90);
export const LonSchema = z.number().min(-180).max(180);
export const LocationSchema = strict({ lat: LatSchema, lon: LonSchema });
export type Location = z.infer<typeof LocationSchema>;

// ---------- Auth ----------
export const LoginSchema = strict({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginDto = z.infer<typeof LoginSchema>;
export const RefreshSchema = strict({ refreshToken: z.string().min(20).max(512) });
export type RefreshDto = z.infer<typeof RefreshSchema>;
export const SessionUserSchema = z.object({ id: z.string().uuid(), name: z.string(), role: RoleSchema });
export type SessionUser = z.infer<typeof SessionUserSchema>;
export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
  user: SessionUserSchema,
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

// ---------- Requests ----------
export const CreateRequestSchema = strict({
  assetId: z.string().trim().min(1).max(64),
  category: CategorySchema,
  location: LocationSchema,
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  notes: z.string().trim().max(1000).optional(),
});
export type CreateRequestDto = z.infer<typeof CreateRequestSchema>;

/** Edit a REQUESTED request (REQUESTED -> DRAFT -> REQUESTED). At least one field is required. */
export const UpdateRequestSchema = strict({
  assetId: z.string().trim().min(1).max(64).optional(),
  category: CategorySchema.optional(),
  location: LocationSchema.optional(),
  windowStart: z.string().datetime().optional(),
  windowEnd: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
})
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field is required' })
  .refine((v) => (v.windowStart === undefined) === (v.windowEnd === undefined), {
    message: 'windowStart and windowEnd must be provided together',
  });
export type UpdateRequestDto = z.infer<typeof UpdateRequestSchema>;

export const NearbyQuerySchema = strict({
  radiusKm: z.coerce.number().positive().max(100).optional(),
  limit: z.coerce.number().int().positive().max(20).optional(),
});
export type NearbyQuery = z.infer<typeof NearbyQuerySchema>;

export const NearbyTechnicianSchema = z.object({
  technicianId: z.string().uuid(),
  name: z.string(),
  rating: z.number(),
  distanceKm: z.number(),
  quoteMinor: z.number().int(),
  availability: AvailabilityStatusSchema,
});
export type NearbyTechnician = z.infer<typeof NearbyTechnicianSchema>;

export const ConfirmSchema = strict({ technicianId: z.string().uuid() });
export type ConfirmDto = z.infer<typeof ConfirmSchema>;

export const ArriveSchema = strict({ otp: z.string().regex(/^\d{6}$/) });
export type ArriveDto = z.infer<typeof ArriveSchema>;

export const OtpResponseSchema = z.object({ otp: z.string(), expiresAt: z.string() });
export type OtpResponse = z.infer<typeof OtpResponseSchema>;

export const EvidenceIntentSchema = strict({
  contentType: z.enum(['image/jpeg', 'image/png']),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type EvidenceIntentDto = z.infer<typeof EvidenceIntentSchema>;

export const EvidenceIntentResponseSchema = z.object({
  mediaId: z.string().uuid(),
  uploadUrl: z.string(),
  method: z.literal('PUT'),
  headers: z.record(z.string()),
  expiresAt: z.string(),
});
export type EvidenceIntentResponse = z.infer<typeof EvidenceIntentResponseSchema>;

export const EvidenceFinalizeSchema = strict({ mediaId: z.string().uuid() });
export type EvidenceFinalizeDto = z.infer<typeof EvidenceFinalizeSchema>;

export const ReviewSchema = strict({
  decision: z.enum(['APPROVE', 'REQUEST_REWORK']),
  reason: z.string().trim().min(3).max(500).optional(),
}).superRefine((v, ctx) => {
  if (v.decision === 'REQUEST_REWORK' && !v.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: 'reason is required to request rework',
    });
  }
  if (v.decision === 'APPROVE' && v.reason !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: 'reason is only allowed with REQUEST_REWORK',
    });
  }
});
export type ReviewDto = z.infer<typeof ReviewSchema>;

export const AvailabilityUpdateSchema = strict({ status: z.enum(['AVAILABLE', 'OFFLINE']) });
export type AvailabilityUpdateDto = z.infer<typeof AvailabilityUpdateSchema>;
export const LocationPingSchema = strict({ lat: LatSchema, lon: LonSchema });
export type LocationPingDto = z.infer<typeof LocationPingSchema>;

export const SnapshotQuerySchema = strict({ since: z.coerce.number().int().nonnegative().optional() });
export type SnapshotQuery = z.infer<typeof SnapshotQuerySchema>;

// ---------- Admin ----------
export const ReasonSchema = z.string().trim().min(5).max(500);
export const AdminReassignSchema = strict({ technicianId: z.string().uuid(), reason: ReasonSchema });
export type AdminReassignDto = z.infer<typeof AdminReassignSchema>;
export const AdminCancelSchema = strict({ reason: ReasonSchema });
export type AdminCancelDto = z.infer<typeof AdminCancelSchema>;
export const AdminJobsQuerySchema = strict({
  state: RequestStateSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});
export type AdminJobsQuery = z.infer<typeof AdminJobsQuerySchema>;
export const AdminAuditQuerySchema = strict({
  requestId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().max(64).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});
export type AdminAuditQuery = z.infer<typeof AdminAuditQuerySchema>;

// ---------- Responses ----------
export const RequestViewSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string(),
  category: CategorySchema,
  location: LocationSchema,
  windowStart: z.string(),
  windowEnd: z.string(),
  notes: z.string().nullable(),
  state: RequestStateSchema,
  version: z.number().int(),
  workCycle: z.number().int(),
  quoteMinor: z.number().int().nullable(),
  startedAt: z.string().nullable(),
  reviewDeadlineAt: z.string().nullable(),
  technician: z.object({ id: z.string().uuid(), name: z.string(), rating: z.number() }).nullable(),
  settlement: z
    .object({ amountMinor: z.number().int(), status: SettlementStatusSchema, providerRef: z.string() })
    .nullable(),
  serverTime: z.string(),
});
export type RequestView = z.infer<typeof RequestViewSchema>;
