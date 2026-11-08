import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
}

// Idempotency depends on the unique indexes, so don't take traffic before they exist.
export async function ensureIndexes(app: INestApplication): Promise<void> {
  const connection = app.get<Connection>(getConnectionToken());
  await Promise.all(Object.values(connection.models).map((model) => model.init()));
}
