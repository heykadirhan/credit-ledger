import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const LEDGER_REASONS = ['grant', 'purchase', 'job', 'refund'] as const;
export type LedgerReason = (typeof LEDGER_REASONS)[number];

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class LedgerEntry {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Account', required: true })
  accountId!: Types.ObjectId;

  @Prop({ required: true })
  delta!: number;

  @Prop({ required: true, enum: LEDGER_REASONS })
  reason!: LedgerReason;

  @Prop({ required: true })
  refId!: string;

  @Prop({ required: true, unique: true })
  idempotencyKey!: string;

  @Prop({ required: true })
  balanceAfter!: number;

  createdAt!: Date;
}

export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;
export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);
LedgerEntrySchema.index({ accountId: 1, createdAt: -1 });

export function toLedgerView(entry: LedgerEntry & { _id: Types.ObjectId }) {
  return {
    id: String(entry._id),
    delta: entry.delta,
    reason: entry.reason,
    refId: entry.refId,
    balanceAfter: entry.balanceAfter,
    createdAt: entry.createdAt,
  };
}
