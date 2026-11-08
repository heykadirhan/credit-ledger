import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Account } from '../accounts/account.schema';
import { LedgerEntry, LedgerReason } from './ledger-entry.schema';

export class InsufficientCreditsError extends HttpException {
  constructor() {
    super('Insufficient credits', HttpStatus.PAYMENT_REQUIRED);
  }
}

export interface LedgerChange {
  accountId: Types.ObjectId;
  delta: number;
  reason: LedgerReason;
  refId: string;
  idempotencyKey: string;
}

export interface Reconciliation {
  balance: number;
  ledgerTotal: number;
  consistent: boolean;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
    @InjectModel(LedgerEntry.name) private readonly entries: Model<LedgerEntry>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async apply(change: LedgerChange, session: ClientSession): Promise<boolean> {
    if (!session.inTransaction()) {
      throw new Error('LedgerService.apply must run inside a transaction');
    }

    const existing = await this.entries
      .exists({ idempotencyKey: change.idempotencyKey })
      .session(session);
    if (existing) return false;

    // A concurrent debit gets a write conflict here, and connection.transaction() retries it.
    const onlyIfBalanceCoversDebit =
      change.delta < 0
        ? { _id: change.accountId, balance: { $gte: -change.delta } }
        : { _id: change.accountId };

    const account = await this.accounts.findOneAndUpdate(
      onlyIfBalanceCoversDebit,
      { $inc: { balance: change.delta } },
      { new: true, session },
    );
    if (!account) {
      if (change.delta < 0) throw new InsufficientCreditsError();
      throw new Error(`Account ${String(change.accountId)} not found`);
    }

    await this.entries.create([{ ...change, balanceAfter: account.balance }], { session });
    return true;
  }

  list(accountId: Types.ObjectId, limit = 50) {
    return this.entries.find({ accountId }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
  }

  async reconcile(accountId: Types.ObjectId): Promise<Reconciliation> {
    return this.connection.transaction<Reconciliation>(
      async (session) => {
        const account = await this.accounts.findById(accountId).session(session).orFail();
        const [sum] = await this.entries
          .aggregate<{ total: number }>([
            { $match: { accountId } },
            { $group: { _id: null, total: { $sum: '$delta' } } },
          ])
          .session(session);
        const ledgerTotal = sum?.total ?? 0;
        return { balance: account.balance, ledgerTotal, consistent: account.balance === ledgerTotal };
      },
      { readConcern: { level: 'snapshot' } },
    );
  }
}
