/**
 * Money helpers. All arithmetic is done on integer minor units (cents) so
 * that sums such as 0.1 + 0.2 or 19.99 * 3 never drift by floating-point
 * error. Values cross the app boundary as plain numbers rounded to 2dp,
 * so persisted shapes (Transaction.total etc.) are unchanged.
 */

export const MONEY_DECIMALS = 2;
const FACTOR = 10 ** MONEY_DECIMALS;

/** Converts a number/numeric string to integer minor units (half away from zero). Throws on NaN/Infinity. */
export function toMinor(value: number | string): number {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new RangeError(`Invalid money value: ${String(value)}`);
  }
  const sign = n < 0 ? -1 : 1;
  // toPrecision(12) strips binary float noise (1.005 * 100 = 100.49999999999999) before rounding.
  const scaled = parseFloat((Math.abs(n) * FACTOR).toPrecision(12));
  const minor = Math.round(scaled) * sign;
  return minor === 0 ? 0 : minor; // avoid -0
}

export function fromMinor(minor: number): number {
  return minor / FACTOR;
}

/** Rounds to 2 decimal places using minor-unit rounding. */
export function roundMoney(value: number | string): number {
  return fromMinor(toMinor(value));
}

export function addMoney(...values: Array<number | string>): number {
  return fromMinor(values.reduce<number>((sum, v) => sum + toMinor(v), 0));
}

export function subMoney(a: number | string, b: number | string): number {
  return fromMinor(toMinor(a) - toMinor(b));
}

/** unit price x quantity (quantity may be fractional, e.g. kg). */
export function mulMoney(amount: number | string, qty: number): number {
  if (!Number.isFinite(qty)) throw new RangeError(`Invalid quantity: ${qty}`);
  return fromMinor(Math.round(parseFloat((toMinor(amount) * qty).toPrecision(12))));
}

/** Share of `whole` represented by `part`, applied to `amount` (e.g. profit recognised on a partial debt payment). */
export function proportionalMoney(amount: number | string, part: number | string, whole: number | string): number {
  const w = toMinor(whole);
  if (w === 0) return 0;
  return fromMinor(Math.round(parseFloat(((toMinor(amount) * toMinor(part)) / w).toPrecision(12))));
}

export interface AmountRules {
  allowZero?: boolean;
  max?: number;
}

/** True only for a finite, positive (or zero if allowed) amount with at most 2 decimals. */
export function isValidAmount(value: unknown, rules: AmountRules = {}): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value < 0) return false;
  if (value === 0 && !rules.allowZero) return false;
  if (Math.abs(value * FACTOR - Math.round(value * FACTOR)) > 1e-6) return false; // more than 2 decimals
  if (rules.max !== undefined && toMinor(value) > toMinor(rules.max)) return false;
  return true;
}

/** Exact comparison: does `amount` exceed `balance`? */
export function exceedsBalance(amount: number, balance: number): boolean {
  return toMinor(amount) > toMinor(balance);
}
