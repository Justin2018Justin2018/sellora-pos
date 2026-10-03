import test from 'node:test';
import assert from 'node:assert/strict';
import { toMinor, addMoney, subMoney, mulMoney, roundMoney, proportionalMoney, isValidAmount, exceedsBalance } from '../src/utils/money.ts';

test('float drift: 0.1 + 0.2 is exactly 0.3', () => {
  assert.notEqual(0.1 + 0.2, 0.3); // the bug being guarded against
  assert.equal(addMoney(0.1, 0.2), 0.3);
});
test('rounding is half away from zero and ignores binary noise (1.005 -> 1.01)', () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(-1.005), -1.01);
  assert.equal(roundMoney('2.675'), 2.68);
});
test('line totals: 19.99 x 3 = 59.97, fractional qty 0.5 x 150', () => {
  assert.equal(mulMoney(19.99, 3), 59.97);
  assert.equal(mulMoney(150, 0.5), 75);
});
test('subtraction keeps exact balance', () => {
  assert.equal(subMoney(100.1, 0.1), 100);
});
test('invalid input throws rather than silently producing NaN', () => {
  assert.throws(() => toMinor(NaN), RangeError);
  assert.throws(() => toMinor(Infinity), RangeError);
  assert.throws(() => toMinor('abc'), RangeError);
});
test('no negative zero', () => {
  assert.ok(Object.is(toMinor(-0.001), 0));
});
test('isValidAmount rejects zero, negatives, NaN, strings and >2dp', () => {
  assert.equal(isValidAmount(50), true);
  assert.equal(isValidAmount(50.25), true);
  assert.equal(isValidAmount(0), false);
  assert.equal(isValidAmount(0, { allowZero: true }), true);
  assert.equal(isValidAmount(-5), false);
  assert.equal(isValidAmount(NaN), false);
  assert.equal(isValidAmount('50'), false);
  assert.equal(isValidAmount(10.001), false);
  assert.equal(isValidAmount(200, { max: 100 }), false);
});
test('exceedsBalance is exact at the boundary (0.1+0.2 vs 0.3)', () => {
  assert.equal(0.1 + 0.2 > 0.3, true); // naive comparison wrongly says it exceeds
  assert.equal(exceedsBalance(addMoney(0.1, 0.2), 0.3), false);
  assert.equal(exceedsBalance(0.31, 0.3), true);
});
test('proportional profit on a partial debt payment', () => {
  // debt 1000, material 400, pays 250 -> recognised profit = (1000-400) * 250/1000 = 150
  assert.equal(proportionalMoney(600, 250, 1000), 150);
  assert.equal(proportionalMoney(600, 250, 0), 0);
  // three equal payments of 1/3 of 100 must not over-recognise beyond the total by more than rounding
  const p = proportionalMoney(100, 33.33, 100);
  assert.equal(p, 33.33);
});
