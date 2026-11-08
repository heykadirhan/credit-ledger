import { Types } from 'mongoose';
import { InsufficientCreditsError, LedgerService } from '../src/ledger/ledger.service';
import { TestApp, createTestApp } from './test-app';

describe('LedgerService', () => {
  let t: TestApp;
  let ledger: LedgerService;

  beforeAll(async () => {
    t = await createTestApp('ledger');
    ledger = t.app.get(LedgerService);
  });
  afterEach(() => t.reset());
  afterAll(() => t.close());

  function apply(accountId: Types.ObjectId, delta: number, idempotencyKey: string) {
    return t.connection.transaction((session) =>
      ledger.apply({ accountId, delta, reason: 'grant', refId: 'test', idempotencyKey }, session),
    );
  }

  it('moves credits and records the balance after each change', async () => {
    const { id } = await t.createAccount(10);

    await apply(id, 5, 'k1');
    await apply(id, -12, 'k2');

    const entries = await ledger.list(id);
    expect(entries.map((e) => [e.delta, e.balanceAfter])).toEqual([
      [-12, 3],
      [5, 15],
      [10, 10],
    ]);
    expect(await ledger.reconcile(id)).toEqual({ balance: 3, ledgerTotal: 3, consistent: true });
  });

  it('refuses a debit larger than the balance and changes nothing', async () => {
    const { id } = await t.createAccount(10);

    await expect(apply(id, -11, 'too-much')).rejects.toBeInstanceOf(InsufficientCreditsError);

    expect(await ledger.reconcile(id)).toEqual({ balance: 10, ledgerTotal: 10, consistent: true });
    expect(await ledger.list(id)).toHaveLength(1);
  });

  it('applies an idempotency key only once', async () => {
    const { id } = await t.createAccount(0);

    expect(await apply(id, 50, 'purchase:1')).toBe(true);
    expect(await apply(id, 50, 'purchase:1')).toBe(false);

    expect(await ledger.reconcile(id)).toEqual({ balance: 50, ledgerTotal: 50, consistent: true });
  });

  it('refuses to run outside a transaction', async () => {
    const { id } = await t.createAccount(10);
    const session = await t.connection.startSession();
    try {
      await expect(
        ledger.apply({ accountId: id, delta: 1, reason: 'grant', refId: 'x', idempotencyKey: 'x' }, session),
      ).rejects.toThrow('must run inside a transaction');
    } finally {
      await session.endSession();
    }
  });

  it('reconcile notices a balance that was changed without a ledger entry', async () => {
    const { id } = await t.createAccount(10);
    await t.connection.model('Account').updateOne({ _id: id }, { $inc: { balance: 5 } });

    expect(await ledger.reconcile(id)).toEqual({ balance: 15, ledgerTotal: 10, consistent: false });
  });
});
