export function mongoUri(): string {
  return process.env.MONGO_URL ?? 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
}

export function mongoDbName(): string {
  return process.env.MONGO_DB ?? 'credit_ledger';
}

export function port(): number {
  return Number(process.env.PORT ?? 4000);
}

export function webhookSecret(): string {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) throw new Error('WEBHOOK_SECRET is not set');
  return secret;
}

export function demoApiKey(): string | undefined {
  return process.env.DEMO_API_KEY || undefined;
}

export function fakeProviderEnabled(): boolean {
  return process.env.FAKE_PROVIDER === 'true';
}

export function fakeFailureRate(): number {
  return Number(process.env.FAKE_FAILURE_RATE ?? 0.25);
}
