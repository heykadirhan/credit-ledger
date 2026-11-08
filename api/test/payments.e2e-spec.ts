import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { sign } from '../src/payments/signature';
import { TEST_WEBHOOK_SECRET, TestApp, createTestApp } from './test-app';

describe('Payments', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp('payments');
  });
  afterEach(() => t.reset());
  afterAll(() => t.close());

  async function checkout(apiKey: string, packId = 'starter'): Promise<string> {
    const res = await t.http.post('/checkout').set('x-api-key', apiKey).send({ packId }).expect(201);
    return res.body.orderId;
  }

  function webhook(orderId: string, opts: { type?: string; secret?: string } = {}) {
    const body = JSON.stringify({ eventId: randomUUID(), type: opts.type ?? 'order.paid', orderId });
    const signature = sign(body, opts.secret ?? TEST_WEBHOOK_SECRET);
    return {
      send: () =>
        t.http
          .post('/webhooks/payments')
          .set('content-type', 'application/json')
          .set('x-signature', signature)
          .send(body),
    };
  }

  async function balance(apiKey: string): Promise<number> {
    const res = await t.http.get('/me').set('x-api-key', apiKey).expect(200);
    return res.body.balance;
  }

  async function reconcile(apiKey: string) {
    const res = await t.http.get('/me/reconcile').set('x-api-key', apiKey).expect(200);
    return res.body;
  }

  it('requires an API key to check out', async () => {
    await t.http.post('/checkout').send({ packId: 'starter' }).expect(401);
  });

  it('rejects an unknown pack', async () => {
    const { apiKey } = await t.createAccount(0);
    await t.http.post('/checkout').set('x-api-key', apiKey).send({ packId: 'free' }).expect(400);
  });

  it('credits the account when the order is paid', async () => {
    const { apiKey } = await t.createAccount(0);
    const orderId = await checkout(apiKey);

    const res = await webhook(orderId).send().expect(200);

    expect(res.body).toEqual({ status: 'credited' });
    expect(await balance(apiKey)).toBe(50);
  });

  it('rejects a webhook with a bad signature', async () => {
    const { apiKey } = await t.createAccount(0);
    const orderId = await checkout(apiKey);

    await webhook(orderId, { secret: 'wrong-secret' }).send().expect(401);

    expect(await balance(apiKey)).toBe(0);
  });

  it('credits once when the same webhook arrives 50 times at once', async () => {
    const { id, apiKey } = await t.createAccount(0);
    const orderId = await checkout(apiKey);
    const event = webhook(orderId);

    const responses = await Promise.all(Array.from({ length: 50 }, () => event.send()));

    expect(responses.map((r) => r.status)).toEqual(Array(50).fill(200));
    expect(responses.filter((r) => r.body.status === 'credited')).toHaveLength(1);
    expect(responses.filter((r) => r.body.status === 'duplicate')).toHaveLength(49);
    expect(await balance(apiKey)).toBe(50);
    expect(await t.countLedgerEntries(id, 'purchase')).toBe(1);
    expect(await reconcile(apiKey)).toEqual({ balance: 50, ledgerTotal: 50, consistent: true });
  });

  it('credits every order when 50 different orders are paid at once', async () => {
    const { apiKey } = await t.createAccount(0);
    const orderIds = await Promise.all(Array.from({ length: 50 }, () => checkout(apiKey)));

    const responses = await Promise.all(orderIds.map((orderId) => webhook(orderId).send()));

    expect(responses.every((r) => r.body.status === 'credited')).toBe(true);
    expect(await balance(apiKey)).toBe(50 * 50);
    expect(await reconcile(apiKey)).toEqual({ balance: 2500, ledgerTotal: 2500, consistent: true });
  });

  it('returns 404 for an order it does not know', async () => {
    await webhook(new Types.ObjectId().toString()).send().expect(404);
  });

  it('ignores event types it does not handle', async () => {
    const { apiKey } = await t.createAccount(0);
    const orderId = await checkout(apiKey);

    const res = await webhook(orderId, { type: 'order.refunded' }).send().expect(200);

    expect(res.body).toEqual({ status: 'ignored' });
    expect(await balance(apiKey)).toBe(0);
  });
});
