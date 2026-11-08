import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../common/mongo-errors';
import { LedgerService } from '../ledger/ledger.service';
import { JOB_COSTS, Job, JobDocument, JobKind } from './job.schema';

export interface CreateJobResult {
  job: JobDocument;
  /** False when the Idempotency-Key matched an earlier job. */
  created: boolean;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectConnection() private readonly connection: Connection,
    private readonly ledger: LedgerService,
  ) {}

  /** Creates and charges in one transaction. A repeated key returns the original job. */
  async create(
    accountId: Types.ObjectId,
    kind: JobKind,
    idempotencyKey: string,
  ): Promise<CreateJobResult> {
    const existing = await this.jobs.findOne({ accountId, idempotencyKey });
    if (existing) return this.replay(existing, kind);

    try {
      const job = await this.connection.transaction(async (session) => {
        const [job] = await this.jobs.create(
          [{ accountId, kind, cost: JOB_COSTS[kind], idempotencyKey }],
          { session },
        );
        await this.ledger.apply(
          {
            accountId,
            delta: -job.cost,
            reason: 'job',
            refId: job.id,
            idempotencyKey: `job:${job.id}`,
          },
          session,
        );
        return job;
      });
      return { job, created: true };
    } catch (err) {
      // Lost the race to a concurrent request with the same key.
      if (isDuplicateKeyError(err)) {
        const winner = await this.jobs.findOne({ accountId, idempotencyKey });
        if (winner) return this.replay(winner, kind);
      }
      throw err;
    }
  }

  list(accountId: Types.ObjectId) {
    return this.jobs.find({ accountId }).sort({ createdAt: -1 }).limit(20).lean();
  }

  private replay(job: JobDocument, kind: JobKind): CreateJobResult {
    if (job.kind !== kind) {
      throw new UnprocessableEntityException(
        'This Idempotency-Key was already used for a different request',
      );
    }
    return { job, created: false };
  }
}
