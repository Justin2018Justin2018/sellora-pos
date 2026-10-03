import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReceiptNumber, parseReceiptSeq, deviceTagFromId } from '../src/utils/receipt.ts';

const base = { prefix: 'MJRC', datePart: '20260926', width: 5 };

test('first receipt of the day', () => {
  assert.equal(nextReceiptNumber({ ...base, existing: [] }), 'MJRC-20260926-00001');
});
test('continues after the highest existing sequence, preserving the legacy format', () => {
  assert.equal(nextReceiptNumber({ ...base, existing: ['MJRC-20260926-00345', 'MJRC-20260926-00346'] }), 'MJRC-20260926-00347');
});
test('REGRESSION: deleting a receipt never causes number reuse (old scheme used list length + 1)', () => {
  const issued = ['MJRC-20260926-00001', 'MJRC-20260926-00002', 'MJRC-20260926-00003'];
  const afterDeletingFirst = issued.slice(1); // length 2 -> old scheme would issue ...00003 again
  assert.equal(nextReceiptNumber({ ...base, existing: afterDeletingFirst }), 'MJRC-20260926-00004');
  assert.notEqual(nextReceiptNumber({ ...base, existing: afterDeletingFirst }), issued[2]);
});
test('other dates and prefixes are ignored', () => {
  assert.equal(nextReceiptNumber({ ...base, existing: ['MJRC-20260925-00099', 'GAS-000050', undefined, null] }), 'MJRC-20260926-00001');
});
test('imported historical receipts are respected', () => {
  assert.equal(nextReceiptNumber({ ...base, existing: ['MJRC-20260926-00346'] }), 'MJRC-20260926-00347');
});
test('no date segment (GAS-000001 / RCP-DEBT-00005 styles)', () => {
  assert.equal(nextReceiptNumber({ prefix: 'GAS', width: 6, existing: ['GAS-000007'] }), 'GAS-000008');
  assert.equal(nextReceiptNumber({ prefix: 'RCP-DEBT', width: 5, existing: ['RCP-DEBT-00004'] }), 'RCP-DEBT-00005');
});
test('two devices with different tags never mint the same receipt, even from identical state', () => {
  const a = nextReceiptNumber({ ...base, existing: ['MJRC-20260926-00010'], deviceTag: deviceTagFromId('a3f1c2d4-0000-4000-8000-000000000000') });
  const b = nextReceiptNumber({ ...base, existing: ['MJRC-20260926-00010'], deviceTag: deviceTagFromId('7be1c2d4-0000-4000-8000-000000000000') });
  assert.equal(a, 'MJRC-20260926-00011-A3F');
  assert.equal(b, 'MJRC-20260926-00011-7BE');
  assert.notEqual(a, b);
});
test('tagged receipts are still parsed so the sequence keeps advancing', () => {
  assert.equal(parseReceiptSeq('MJRC-20260926-00011-A3F', 'MJRC', '20260926'), 11);
  assert.equal(nextReceiptNumber({ ...base, existing: ['MJRC-20260926-00011-A3F'] }), 'MJRC-20260926-00012');
});
test('regex metacharacters in prefix are escaped', () => {
  assert.equal(parseReceiptSeq('A.B-00001', 'A.B'), 1);
  assert.equal(parseReceiptSeq('AxB-00001', 'A.B'), null);
});
