import { Controller, HttpCode, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiKeyGuard } from '../accounts/api-key.guard';
import { fakeProviderEnabled, port, webhookSecret } from '../config';
import { sign } from './signature';

const DELIVERIES_PER_PAYMENT = 3;

@Controller('dev/fake-provider')
export class FakeProviderController {
  @Post('pay/:orderId')
  @HttpCode(200)
  @UseGuards(ApiKeyGuard)
  async pay(@Param('orderId') orderId: string): Promise<{ deliveries: string[] }> {
    if (!fakeProviderEnabled()) throw new NotFoundException();

    const body = JSON.stringify({ eventId: randomUUID(), type: 'order.paid', orderId });
    const headers = {
      'content-type': 'application/json',
      'x-signature': sign(body, webhookSecret()),
    };

    const deliveries = await Promise.all(
      Array.from({ length: DELIVERIES_PER_PAYMENT }, async () => {
        const res = await fetch(`http://127.0.0.1:${port()}/webhooks/payments`, {
          method: 'POST',
          headers,
          body,
        });
        const json = (await res.json()) as { status?: string };
        return json.status ?? `http ${res.status}`;
      }),
    );
    return { deliveries };
  }
}
