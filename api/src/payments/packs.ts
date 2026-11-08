export const PACKS = {
  starter: { credits: 50, priceCents: 900 },
  pro: { credits: 200, priceCents: 2900 },
} as const;

export type PackId = keyof typeof PACKS;
export const PACK_IDS = Object.keys(PACKS) as PackId[];
