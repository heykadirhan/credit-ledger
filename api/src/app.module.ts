import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsModule } from './accounts/accounts.module';
import { mongoDbName, mongoUri } from './config';
import { JobsModule } from './jobs/jobs.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    // Async so tests can set MONGO_DB before the connection opens.
    MongooseModule.forRootAsync({
      useFactory: () => ({ uri: mongoUri(), dbName: mongoDbName() }),
    }),
    AccountsModule,
    PaymentsModule,
    JobsModule,
  ],
})
export class AppModule {}
