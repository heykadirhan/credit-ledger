import { Controller, Get, UseGuards } from '@nestjs/common';
import { toLedgerView } from '../ledger/ledger-entry.schema';
import { LedgerService } from '../ledger/ledger.service';
import { AccountDocument } from './account.schema';
import { ApiKeyGuard, CurrentAccount } from './api-key.guard';

@Controller('me')
@UseGuards(ApiKeyGuard)
export class MeController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  me(@CurrentAccount() account: AccountDocument) {
    return { id: account.id, name: account.name, balance: account.balance };
  }

  @Get('ledger')
  async ledgerEntries(@CurrentAccount() account: AccountDocument) {
    const entries = await this.ledger.list(account._id);
    return entries.map(toLedgerView);
  }

  @Get('reconcile')
  reconcile(@CurrentAccount() account: AccountDocument) {
    return this.ledger.reconcile(account._id);
  }
}
