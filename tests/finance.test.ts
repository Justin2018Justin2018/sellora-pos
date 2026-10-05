import test from 'node:test';
import assert from 'node:assert/strict';
import { saleCost, sumSaleCosts } from '../src/utils/finance.ts';

test('normal sale: cost = total - profit = materialTotal', () => {
  assert.equal(saleCost({ total: 100, profit: 60, materialTotal: 40 }), 40);
});
test('REGRESSION: debt repayment stored with materialTotal 0 is not reported as 100% profit', () => {
  // a 500 instalment of a debt whose recognised profit share is 200 => cost 300
  assert.equal(saleCost({ total: 500, profit: 200, materialTotal: 0 }), 300);
});
test('REGRESSION: dashboard cost is not zero when materialTotal is the only field (legacy rows)', () => {
  assert.equal(saleCost({ total: 100, materialTotal: 35 }), 35);
});
test('decimal-safe: 0.1 + 0.2 style amounts do not drift', () => {
  assert.equal(sumSaleCosts([{ total: 0.3, profit: 0.2 }, { total: 0.3, profit: 0.2 }]), 0.2);
  assert.equal(saleCost({ total: 10.1, profit: 3.3 }), 6.8);
});
test('never negative, never NaN, empty list is 0', () => {
  assert.equal(saleCost({ total: 10, profit: 15 }), 0);
  assert.equal(saleCost({ total: 10, profit: NaN, materialTotal: 4 }), 4);
  assert.equal(sumSaleCosts([]), 0);
});
