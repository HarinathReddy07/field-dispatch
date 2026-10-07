import { z } from 'zod';
import { RequestStateSchema } from './enums';

export const SOCKET_SCHEMA_VERSION = 1;

export const SOCKET_EVENTS = [
  'request.created',
  'assignment.created',
  'technician.location.updated',
  'request.state.changed',
  'evidence.uploaded',
  'review.requested',
  'settlement.created',
  'admin.override',
] as const;
export const SocketEventTypeSchema = z.enum(SOCKET_EVENTS);
export type SocketEventType = z.infer<typeof SocketEventTypeSchema>;

export const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  schemaVersion: z.literal(SOCKET_SCHEMA_VERSION),
  /** Monotonic cursor (outbox sequence) used for `since` resync. */
  seq: z.number().int().nonnegative(),
  type: SocketEventTypeSchema,
  requestId: z.string().uuid().nullable(),
  data: z.record(z.unknown()),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

const base = { requestId: z.string().uuid() };
export const EventPayloads = {
  'request.created': z.object({ ...base, category: z.string(), state: RequestStateSchema }),
  'assignment.created': z.object({
    ...base,
    assignmentId: z.string().uuid(),
    technicianId: z.string().uuid(),
    quoteMinor: z.number().int(),
  }),
  'technician.location.updated': z.object({
    ...base,
    technicianId: z.string().uuid(),
    lat: z.number(),
    lon: z.number(),
    at: z.string(),
  }),
  'request.state.changed': z.object({
    ...base,
    from: RequestStateSchema,
    to: RequestStateSchema,
    version: z.number().int(),
  }),
  'evidence.uploaded': z.object({ ...base, mediaId: z.string().uuid(), workCycle: z.number().int() }),
  'review.requested': z.object({ ...base, reason: z.string(), workCycle: z.number().int() }),
  'settlement.created': z.object({
    ...base,
    settlementId: z.string().uuid(),
    amountMinor: z.number().int(),
    providerRef: z.string(),
  }),
  'admin.override': z.object({ ...base, action: z.enum(['REASSIGN', 'CANCEL']), reason: z.string() }),
} as const;

/** Rooms: user:{id}, request:{id}, admin */
export const rooms = {
  user: (id: string) => `user:${id}`,
  request: (id: string) => `request:${id}`,
  admin: 'admin',
} as const;
