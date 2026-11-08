import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module';
import { configureApp, ensureIndexes } from './app.setup';
import { port } from './config';

async function bootstrap() {
  if (existsSync('.env')) process.loadEnvFile();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);
  await ensureIndexes(app);
  await app.listen(port());
  Logger.log(`API listening on http://localhost:${port()}`, 'Bootstrap');
}

void bootstrap();
