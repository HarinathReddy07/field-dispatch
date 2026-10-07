import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import type { Env } from '@dispatch/config';

/** Socket.io over the Redis adapter (so emits reach sockets on every API instance) with strict CORS from env. */
export class RedisIoAdapter extends IoAdapter {
  private pub?: Redis;
  private sub?: Redis;
  private adapter?: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly env: Env,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    this.pub = new Redis(this.env.REDIS_URL);
    this.sub = this.pub.duplicate();
    this.pub.on('error', () => undefined);
    this.sub.on('error', () => undefined);
    this.adapter = createAdapter(this.pub, this.sub);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      serveClient: false,
      maxHttpBufferSize: 100_000,
      cors: {
        origin: this.env.CORS_ORIGINS.split(',')
          .map((o) => o.trim())
          .filter(Boolean),
        credentials: false,
      },
    }) as Server;
    if (this.adapter) server.adapter(this.adapter);
    return server;
  }

  override async dispose(): Promise<void> {
    await super.dispose();
    this.pub?.disconnect();
    this.sub?.disconnect();
  }
}
