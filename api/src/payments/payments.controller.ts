import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AccountDocument } from '../accounts/account.schema';
import { ApiKeyGuard, CurrentAccount } from '../accounts/api-key.guard';
import { CheckoutDto, PaymentWebhookDto } from './dto';
import { PaymentsService, WebhookOutcome } from './payments.service';
import { SignatureGuard } from './signature.guard';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('checkout')
  @UseGuards(ApiKeyGuard)
  async checkout(@CurrentAccount() account: AccountDocument, @Body() dto: CheckoutDto) {
    const order = await this.payments.createOrder(account._id, dto.packId);
    return {
      orderId: order.id,
      packId: order.packId,
      credits: order.credits,
      priceCents: order.priceCents,
    };
  }

  @Post('webhooks/payments')
  @HttpCode(200) // Duplicates too, or the provider keeps retrying.
  @UseGuards(SignatureGuard)
  async webhook(@Body() event: PaymentWebhookDto): Promise<{ status: WebhookOutcome }> {
    if (event.type !== 'order.paid') return { status: 'ignored' };
    return { status: await this.payments.markPaid(event.orderId) };
  }
}
