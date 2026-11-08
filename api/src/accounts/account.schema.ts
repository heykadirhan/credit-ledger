import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Account {
  @Prop({ required: true })
  name!: string;

  /** SHA-256 of the API key. The key itself is never stored. */
  @Prop({ required: true, unique: true })
  apiKeyHash!: string;

  /** Cached ledger total. Only LedgerService.apply writes it. */
  @Prop({ required: true, default: 0 })
  balance!: number;
}

export type AccountDocument = HydratedDocument<Account>;
export const AccountSchema = SchemaFactory.createForClass(Account);
