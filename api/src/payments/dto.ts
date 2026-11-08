import { IsIn, IsMongoId, IsNotEmpty, IsString } from 'class-validator';
import { PACK_IDS, PackId } from './packs';

export class CheckoutDto {
  @IsIn(PACK_IDS)
  packId!: PackId;
}

export class PaymentWebhookDto {
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsString()
  type!: string;

  @IsMongoId()
  orderId!: string;
}
