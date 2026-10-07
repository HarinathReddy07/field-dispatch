import { z } from 'zod';

export const RoleSchema = z.enum(['REQUESTER', 'TECHNICIAN', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const REQUEST_STATES = [
  'DRAFT',
  'REQUESTED',
  'MATCHED',
  'CONFIRMED',
  'ARRIVED',
  'IN_PROGRESS',
  'PROOF_UPLOADED',
  'UNDER_REVIEW',
  'REWORK',
  'COMPLETED',
  'SETTLED',
  'CANCELLED',
] as const;
export const RequestStateSchema = z.enum(REQUEST_STATES);
export type RequestState = z.infer<typeof RequestStateSchema>;

/** COMPLETED is transient: completion and settlement commit together, so it only exists inside a transaction. */
export const TERMINAL_STATES: readonly RequestState[] = ['SETTLED', 'CANCELLED'];

export const AssignmentStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'REASSIGNED']);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

export const MediaStatusSchema = z.enum(['PENDING', 'FINALIZED']);
export type MediaStatus = z.infer<typeof MediaStatusSchema>;

export const SettlementStatusSchema = z.enum(['PENDING', 'SETTLED', 'FAILED']);
export type SettlementStatus = z.infer<typeof SettlementStatusSchema>;

export const AvailabilityStatusSchema = z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']);
export type AvailabilityStatus = z.infer<typeof AvailabilityStatusSchema>;

export const CategorySchema = z.enum(['ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION']);
export type Category = z.infer<typeof CategorySchema>;

/** Fixed trial rates in minor units (paise). Server-side source of truth for quotes. */
export const CATEGORY_RATES_MINOR: Record<Category, { base: number; perKm: number }> = {
  ELECTRICAL_INSPECTION: { base: 45000, perKm: 1500 },
  MECHANICAL_INSPECTION: { base: 60000, perKm: 1800 },
};
