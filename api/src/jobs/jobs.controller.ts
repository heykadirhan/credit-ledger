import { Body, Controller, Get, HttpStatus, Inject, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AccountDocument } from '../accounts/account.schema';
import { ApiKeyGuard, CurrentAccount } from '../accounts/api-key.guard';
import { CreateJobDto } from './dto';
import { IdempotencyKey } from './idempotency-key.decorator';
import { JOB_QUEUE, JobQueue } from './job-queue';
import { toJobView } from './job.schema';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(ApiKeyGuard)
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
  ) {}

  @Post()
  async create(
    @CurrentAccount() account: AccountDocument,
    @Body() dto: CreateJobDto,
    @IdempotencyKey() idempotencyKey: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { job, created } = await this.jobs.create(account._id, dto.kind, idempotencyKey);
    if (created) {
      this.queue.enqueue(job.id);
    } else {
      res.status(HttpStatus.OK);
    }
    return toJobView(job);
  }

  @Get()
  async list(@CurrentAccount() account: AccountDocument) {
    const jobs = await this.jobs.list(account._id);
    return jobs.map(toJobView);
  }
}
