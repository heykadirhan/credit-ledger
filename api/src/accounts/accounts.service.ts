import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Connection, Model } from 'mongoose';
import { LedgerService } from '../ledger/ledger.service';
import { Account, AccountDocument } from './account.schema';

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
    @InjectConnection() private readonly connection: Connection,
    private readonly ledger: LedgerService,
  ) {}

  findByApiKey(apiKey: string) {
    return this.accounts.findOne({ apiKeyHash: hashApiKey(apiKey) });
  }

  /** Starting credits go through the ledger like any other change. */
  async create(name: string, apiKey: string, startingCredits: number): Promise<AccountDocument> {
    const id = await this.connection.transaction(async (session) => {
      const [account] = await this.accounts.create([{ name, apiKeyHash: hashApiKey(apiKey) }], {
        session,
      });
      if (startingCredits > 0) {
        await this.ledger.apply(
          {
            accountId: account._id,
            delta: startingCredits,
            reason: 'grant',
            refId: account.id,
            idempotencyKey: `grant:${account.id}`,
          },
          session,
        );
      }
      return account._id;
    });
    return this.accounts.findById(id).orFail();
  }
}
