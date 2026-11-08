import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsModule } from '../accounts/accounts.module';
import { LedgerModule } from '../ledger/ledger.module';
import { FakeProviderController } from './fake-provider.controller';
import { Order, OrderSchema } from './order.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    LedgerModule,
    AccountsModule,
  ],
  controllers: [PaymentsController, FakeProviderController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
