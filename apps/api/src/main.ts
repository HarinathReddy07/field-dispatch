import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { loadEnv } from '@dispatch/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks(); // SIGTERM/SIGINT: stop accepting, drain, close sockets, Redis and Prisma
  await configureApp(app, env);
  await app.listen(env.PORT, '0.0.0.0');
  const log = app.get(Logger);
  log.log(`API listening on :${env.PORT}`);
  if (env.INSECURE_LOCAL_DEV) {
    log.warn('INSECURE_LOCAL_DEV=true: plain HTTP/WS is accepted. Never use this in a deployed environment.');
  }
}

main().catch((err) => {
  // Logger may not be ready (config errors); fail loudly without printing secrets.
  process.stderr.write(`Fatal startup error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
