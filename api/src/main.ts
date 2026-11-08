import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, ensureIndexes } from './app.setup';
import { port } from './config';

async function bootstrap() {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file
  }

  // rawBody: webhook signatures are checked against the exact bytes.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);
  await ensureIndexes(app);
  await app.listen(port());
  Logger.log(`API listening on http://localhost:${port()}`, 'Bootstrap');
}

void bootstrap();
