import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/** Shared by main.ts and the tests. */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
}

// Idempotency relies on unique indexes, so wait for them before taking traffic.
export async function ensureIndexes(app: INestApplication): Promise<void> {
  const connection = app.get<Connection>(getConnectionToken());
  await Promise.all(Object.values(connection.models).map((model) => model.init()));
}
