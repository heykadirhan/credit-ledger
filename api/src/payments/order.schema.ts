import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { PACK_IDS, PackId } from './packs';

export type OrderStatus = 'pending' | 'paid';

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Account', required: true, index: true })
  accountId!: Types.ObjectId;

  @Prop({ required: true, enum: PACK_IDS })
  packId!: PackId;

  @Prop({ required: true })
  credits!: number;

  @Prop({ required: true })
  priceCents!: number;

  @Prop({ required: true, enum: ['pending', 'paid'], default: 'pending' })
  status!: OrderStatus;

  @Prop()
  paidAt?: Date;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
