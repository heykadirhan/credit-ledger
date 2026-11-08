import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { AccountsService } from './accounts.service';
import { DemoSeed } from './demo-seed';
import { MeController } from './me.controller';

@Module({
  imports: [LedgerModule],
  controllers: [MeController],
  providers: [AccountsService, DemoSeed],
  // ApiKeyGuard needs it in other modules.
  exports: [AccountsService],
})
export class AccountsModule {}
