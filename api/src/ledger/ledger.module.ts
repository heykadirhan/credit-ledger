import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from '../accounts/account.schema';
import { LedgerEntry, LedgerEntrySchema } from './ledger-entry.schema';
import { LedgerService } from './ledger.service';

// Account is registered here because only LedgerService writes balances.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
    ]),
  ],
  providers: [LedgerService],
  exports: [LedgerService, MongooseModule],
})
export class LedgerModule {}
