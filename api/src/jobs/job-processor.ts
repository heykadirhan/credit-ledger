import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { LedgerService } from '../ledger/ledger.service';
import { Job } from './job.schema';
import { RENDER_ENGINE, RenderEngine } from './render-engine';

@Injectable()
export class JobProcessor {
  constructor(
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(RENDER_ENGINE) private readonly engine: RenderEngine,
    private readonly ledger: LedgerService,
  ) {}

  async process(jobId: string): Promise<void> {
    // Claim it. Only one worker can move a job out of "queued".
    const job = await this.jobs.findOneAndUpdate(
      { _id: jobId, status: 'queued' },
      { $set: { status: 'running' } },
      { new: true },
    );
    if (!job) return;

    try {
      await this.engine.run({ id: job.id, kind: job.kind });
    } catch (err) {
      await this.fail(job.id, err instanceof Error ? err.message : 'Render failed');
      return;
    }

    await this.jobs.updateOne(
      { _id: job._id, status: 'running' },
      { $set: { status: 'succeeded', finishedAt: new Date() } },
    );
  }

  /** Fails the job and refunds it. Safe to call twice (status filter + refund key). */
  async fail(jobId: string, reason: string): Promise<void> {
    await this.connection.transaction(async (session) => {
      const job = await this.jobs.findOneAndUpdate(
        { _id: jobId, status: { $in: ['queued', 'running'] } },
        { $set: { status: 'failed', error: reason, finishedAt: new Date() } },
        { new: true, session },
      );
      if (!job) return;

      await this.ledger.apply(
        {
          accountId: job.accountId,
          delta: job.cost,
          reason: 'refund',
          refId: job.id,
          idempotencyKey: `refund:${job.id}`,
        },
        session,
      );
    });
  }
}
