import { IsIn } from 'class-validator';
import { JOB_KINDS, JobKind } from './job.schema';

export class CreateJobDto {
  @IsIn(JOB_KINDS)
  kind!: JobKind;
}
