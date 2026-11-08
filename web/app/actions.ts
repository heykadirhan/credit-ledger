'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, api } from '@/lib/api';
import type { ActionResult, JobKind, JobView, PackId } from '@/lib/types';

export async function startJob(kind: JobKind, idempotencyKey: string): Promise<ActionResult> {
  try {
    const job = await api<JobView>('/jobs', {
      method: 'POST',
      headers: { 'idempotency-key': idempotencyKey },
      body: JSON.stringify({ kind }),
    });
    revalidatePath('/');
    return { ok: true, message: `Job started: ${job.kind}, ${plural(job.cost, 'credit')} charged` };
  } catch (err) {
    if (err instanceof ApiError && err.status === 402) {
      return { ok: false, message: 'Not enough credits' };
    }
    throw err;
  }
}

export async function buyPack(packId: PackId): Promise<ActionResult> {
  const order = await api<{ orderId: string; credits: number }>('/checkout', {
    method: 'POST',
    body: JSON.stringify({ packId }),
  });
  // Pretend the customer paid on the provider's checkout page.
  const { deliveries } = await api<{ deliveries: string[] }>(
    `/dev/fake-provider/pay/${order.orderId}`,
    { method: 'POST' },
  );
  revalidatePath('/');
  const credited = deliveries.filter((d) => d === 'credited').length;
  return {
    ok: true,
    message: `Webhook arrived ${plural(deliveries.length, 'time')}, credited ${plural(credited, 'time')}: +${order.credits}`,
  };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
