import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Account {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true })
  apiKeyHash!: string;

  @Prop({ required: true, default: 0 })
  balance!: number;
}

export type AccountDocument = HydratedDocument<Account>;
export const AccountSchema = SchemaFactory.createForClass(Account);
