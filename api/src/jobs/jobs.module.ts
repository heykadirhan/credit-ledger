import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsModule } from '../accounts/accounts.module';
import { LedgerModule } from '../ledger/ledger.module';
import { Job, JobSchema } from './job.schema';
import { JobProcessor } from './job-processor';
import { InProcessJobQueue, JOB_QUEUE } from './job-queue';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { FakeRenderEngine, RENDER_ENGINE } from './render-engine';

@Module({
  imports: [MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]), LedgerModule, AccountsModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobProcessor,
    { provide: RENDER_ENGINE, useClass: FakeRenderEngine },
    { provide: JOB_QUEUE, useClass: InProcessJobQueue },
  ],
})
export class JobsModule {}
