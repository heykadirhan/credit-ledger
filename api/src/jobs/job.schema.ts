import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const JOB_COSTS = { render: 3, upscale: 1 } as const;
export type JobKind = keyof typeof JOB_COSTS;
export const JOB_KINDS = Object.keys(JOB_COSTS) as JobKind[];

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

@Schema({ timestamps: true })
export class Job {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Account', required: true })
  accountId!: Types.ObjectId;

  @Prop({ required: true, enum: JOB_KINDS })
  kind!: JobKind;

  /** Credits charged when the job was created, and refunded if it fails. */
  @Prop({ required: true })
  cost!: number;

  @Prop({ required: true, enum: JOB_STATUSES, default: 'queued' })
  status!: JobStatus;

  /** The client's Idempotency-Key header. Unique per account. */
  @Prop({ required: true })
  idempotencyKey!: string;

  @Prop()
  error?: string;

  @Prop()
  finishedAt?: Date;

  createdAt!: Date;
}

export type JobDocument = HydratedDocument<Job>;
export const JobSchema = SchemaFactory.createForClass(Job);
JobSchema.index({ accountId: 1, idempotencyKey: 1 }, { unique: true });
JobSchema.index({ accountId: 1, createdAt: -1 });

export function toJobView(job: Job & { _id: Types.ObjectId }) {
  return {
    id: String(job._id),
    kind: job.kind,
    cost: job.cost,
    status: job.status,
    error: job.error ?? null,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt ?? null,
  };
}
