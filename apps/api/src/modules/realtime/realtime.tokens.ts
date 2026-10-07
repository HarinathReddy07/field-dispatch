import type { EventPayloads, SocketEventType } from '@dispatch/contracts';
import type { z } from 'zod';

export const REALTIME_PUBLISHER = 'REALTIME_PUBLISHER';

/** Emits ephemeral events straight to rooms (not persisted; e.g. technician location samples). */
export interface RealtimePublisher {
  publishEphemeral<T extends SocketEventType>(
    type: T,
    requestId: string,
    rooms: string[],
    data: z.infer<(typeof EventPayloads)[T]>,
  ): void;
}
