import { createHmac, timingSafeEqual } from 'node:crypto';

export function sign(payload: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignature(payload: string | Buffer, signature: string, secret: string): boolean {
  const expected = Buffer.from(sign(payload, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
