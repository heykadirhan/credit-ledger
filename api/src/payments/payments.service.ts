import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { LedgerService } from '../ledger/ledger.service';
import { Order } from './order.schema';
import { PACKS, PackId } from './packs';

export type WebhookOutcome = 'credited' | 'duplicate' | 'ignored';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectConnection() private readonly connection: Connection,
    private readonly ledger: LedgerService,
  ) {}

  createOrder(accountId: Types.ObjectId, packId: PackId) {
    const pack = PACKS[packId];
    return this.orders.create({
      accountId,
      packId,
      credits: pack.credits,
      priceCents: pack.priceCents,
    });
  }

  async markPaid(orderId: string): Promise<WebhookOutcome> {
    return this.connection.transaction<WebhookOutcome>(async (session) => {
      const order = await this.orders.findOneAndUpdate(
        { _id: orderId, status: 'pending' },
        { $set: { status: 'paid', paidAt: new Date() } },
        { new: true, session },
      );
      if (!order) {
        const exists = await this.orders.exists({ _id: orderId }).session(session);
        if (!exists) throw new NotFoundException('Unknown order');
        return 'duplicate';
      }

      const applied = await this.ledger.apply(
        {
          accountId: order.accountId,
          delta: order.credits,
          reason: 'purchase',
          refId: order.id,
          idempotencyKey: `purchase:${order.id}`,
        },
        session,
      );
      return applied ? 'credited' : 'duplicate';
    });
  }
}
