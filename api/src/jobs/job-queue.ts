import { Injectable, Logger } from '@nestjs/common';
import { JobProcessor } from './job-processor';

export const JOB_QUEUE = Symbol('JOB_QUEUE');

export interface JobQueue {
  enqueue(jobId: string): void;
}

@Injectable()
export class InProcessJobQueue implements JobQueue {
  private readonly logger = new Logger(InProcessJobQueue.name);

  constructor(private readonly processor: JobProcessor) {}

  enqueue(jobId: string): void {
    setImmediate(() => {
      this.processor.process(jobId).catch((err: unknown) => {
        this.logger.error(`Job ${jobId} crashed`, err instanceof Error ? err.stack : err);
      });
    });
  }
}
