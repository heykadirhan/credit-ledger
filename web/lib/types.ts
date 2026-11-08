export type JobKind = 'render' | 'upscale';
export type PackId = 'starter' | 'pro';

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface Me {
  id: string;
  name: string;
  balance: number;
}

export interface Reconciliation {
  balance: number;
  ledgerTotal: number;
  consistent: boolean;
}

export interface JobView {
  id: string;
  kind: JobKind;
  cost: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface LedgerEntryView {
  id: string;
  delta: number;
  reason: 'grant' | 'purchase' | 'job' | 'refund';
  refId: string;
  balanceAfter: number;
  createdAt: string;
}

export const PACK_OPTIONS = [
  { id: 'starter', credits: 50, price: '$9' },
  { id: 'pro', credits: 200, price: '$29' },
] as const satisfies ReadonlyArray<{ id: PackId; credits: number; price: string }>;

export const JOB_OPTIONS = [
  { kind: 'render', cost: 3 },
  { kind: 'upscale', cost: 1 },
] as const satisfies ReadonlyArray<{ kind: JobKind; cost: number }>;
