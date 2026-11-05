import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadConfig } from './common/config';

async function main() {
  const cfg = loadConfig();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableCors({ origin: true, credentials: true });
  await app.listen(cfg.port);
}
main();
