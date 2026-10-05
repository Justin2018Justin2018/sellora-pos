import { addMoney, subMoney } from './money.ts';

interface CostBearing {
  total: number;
  profit?: number;
  materialTotal?: number;
}

/**
 * Cost of goods for one recorded sale, in money units, derived so that revenue - cost === recorded profit.
 *
 * Why not just `materialTotal`? A customer repayment (payment: 'Debt Payment') is stored with materialTotal = 0 and
 * `profit` = the profit portion recognised for that instalment, so reading materialTotal alone reports the whole
 * repayment as profit. `profit` is the figure the sale/repayment code actually computed, so cost = total - profit.
 * Falls back to materialTotal when profit is missing/invalid (legacy or imported rows).
 */
export function saleCost(t: CostBearing): number {
  if (typeof t.profit === 'number' && Number.isFinite(t.profit) && Number.isFinite(t.total)) {
    return Math.max(0, subMoney(t.total, t.profit));
  }
  return Math.max(0, t.materialTotal || 0);
}

export function sumSaleCosts(list: CostBearing[]): number {
  return list.reduce((acc, t) => addMoney(acc, saleCost(t)), 0);
}
