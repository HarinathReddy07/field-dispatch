import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import type { Env } from '@dispatch/config';
import {
  EventEnvelope,
  EventPayloads,
  SOCKET_SCHEMA_VERSION,
  SocketEventType,
  rooms,
} from '@dispatch/contracts';
import { AuthUser } from '../../common/decorators';
import { isSecureTransport } from '../../common/transport';
import { APP_CONFIG } from '../../config/config.module';
import { PrismaService } from '../../infra/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AccessService } from '../requests/access.service';
import { RealtimePublisher } from './realtime.tokens';

const SubscribeSchema = z.object({ requestId: z.string().uuid() }).strict();
const MAX_SUBSCRIPTIONS_PER_SOCKET = 25;

type SocketData = { user: AuthUser; subscriptions: Set<string> };

/**
 * Socket.io gateway. It never touches the database for writes and never decides business rules:
 *  - authenticates the JWT in the handshake (rejects before connecting),
 *  - joins only `user:{id}` (+ `admin` for admins) automatically,
 *  - joins `request:{id}` only after an ownership/assignment check, server-side,
 *  - disconnects when the access token expires (client refreshes and reconnects, then resyncs over REST).
 */
@WebSocketGateway({ transports: ['websocket', 'polling'] })
@Injectable()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, RealtimePublisher {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly auth: AuthService,
    private readonly access: AccessService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {}

  afterInit(server: Server): void {
    server.use(async (socket, next) => {
      // Deployable profile: WSS only (TLS terminates at the reverse proxy, which sets X-Forwarded-Proto).
      if (
        !this.cfg.INSECURE_LOCAL_DEV &&
        !isSecureTransport(socket.handshake.headers, socket.handshake.secure)
      ) {
        return next(new Error('HTTPS_REQUIRED'));
      }
      const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token !== 'string') return next(new Error('UNAUTHENTICATED'));
      try {
        const { user, exp } = await this.auth.verifyToken(token);
        socket.data = { user, subscriptions: new Set<string>() } satisfies SocketData;
        const ms = exp * 1000 - Date.now();
        if (ms <= 0) return next(new Error('UNAUTHENTICATED'));
        const timer = setTimeout(() => socket.disconnect(true), ms);
        timer.unref();
        socket.on('disconnect', () => clearTimeout(timer));
        next();
      } catch {
        next(new Error('UNAUTHENTICATED'));
      }
    });
  }

  handleConnection(socket: Socket): void {
    const { user } = socket.data as SocketData;
    void socket.join(rooms.user(user.id));
    if (user.role === 'ADMIN') void socket.join(rooms.admin);
  }

  @SubscribeMessage('request.subscribe')
  async subscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<{ ok: boolean; code?: string }> {
    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' };
    const data = socket.data as SocketData;
    const { requestId } = parsed.data;
    if (data.subscriptions.size >= MAX_SUBSCRIPTIONS_PER_SOCKET && !data.subscriptions.has(requestId)) {
      return { ok: false, code: 'RATE_LIMITED' };
    }
    // Unauthorized rooms are ignored server-side and answered exactly like a missing request.
    if (!(await this.access.canSubscribe(this.prisma, data.user, requestId)))
      return { ok: false, code: 'NOT_FOUND' };
    await socket.join(rooms.request(requestId));
    data.subscriptions.add(requestId);
    return { ok: true };
  }

  @SubscribeMessage('request.unsubscribe')
  async unsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<{ ok: boolean }> {
    const parsed = SubscribeSchema.safeParse(body);
    if (parsed.success) {
      await socket.leave(rooms.request(parsed.data.requestId));
      (socket.data as SocketData).subscriptions.delete(parsed.data.requestId);
    }
    return { ok: true };
  }

  /** Delivery of a committed outbox event. */
  publish(envelope: EventEnvelope, targets: string[]): void {
    if (targets.length === 0) return;
    this.server.to(targets).emit(envelope.type, envelope);
  }

  /** Non-persisted events (location samples): seq 0 means "not replayable via snapshot". */
  publishEphemeral<T extends SocketEventType>(
    type: T,
    requestId: string,
    targets: string[],
    data: z.infer<(typeof EventPayloads)[T]>,
  ): void {
    if (!this.server) return;
    const envelope: EventEnvelope = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      schemaVersion: SOCKET_SCHEMA_VERSION,
      seq: 0,
      type,
      requestId,
      data: EventPayloads[type].parse(data),
    };
    this.publish(envelope, targets);
  }

  /** After a reassignment/cancel/completion, drop sockets that may no longer follow the request live. */
  async revalidateRequestRoom(requestId: string): Promise<void> {
    try {
      const sockets = await this.server.in(rooms.request(requestId)).fetchSockets();
      for (const s of sockets) {
        const data = s.data as SocketData | undefined;
        if (!data?.user) continue;
        if (!(await this.access.canSubscribe(this.prisma, data.user, requestId))) {
          s.leave(rooms.request(requestId));
          data.subscriptions.delete(requestId);
        }
      }
    } catch (e) {
      this.logger.warn(`room revalidation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
