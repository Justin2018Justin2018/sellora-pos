import test from 'node:test';
import assert from 'node:assert/strict';
import { nextBackoffDelay, classifySyncError, isStaleSyncing, STALE_SYNCING_MS, BACKOFF_SCHEDULE_MS } from '../src/services/syncPolicy.ts';

test('backoff grows then caps at 30 minutes, and never goes out of range', () => {
  assert.equal(nextBackoffDelay(0), 30_000);
  assert.equal(nextBackoffDelay(1), 120_000);
  assert.equal(nextBackoffDelay(4), 1_800_000);
  assert.equal(nextBackoffDelay(999), 1_800_000);
  assert.equal(nextBackoffDelay(-3), BACKOFF_SCHEDULE_MS[0]);
});
test('network failure is transient (retry)', () => {
  assert.equal(classifySyncError(new TypeError('Failed to fetch')).kind, 'transient');
});
test('RLS / auth refusal is blocked, not discarded', () => {
  assert.equal(classifySyncError({ code: '42501', message: 'new row violates row-level security policy' }).kind, 'blocked');
  assert.equal(classifySyncError({ status: 401, message: 'x' }).kind, 'blocked');
  assert.equal(classifySyncError({ code: 'PGRST301', message: 'JWT expired' }).kind, 'blocked');
});
test('constraint / type / schema errors are permanent with actionable text', () => {
  const unique = classifySyncError({ code: '23505', message: 'duplicate key value' });
  assert.equal(unique.kind, 'permanent');
  assert.match(unique.message, /constraint/i);
  const col = classifySyncError({ code: 'PGRST204', message: "Could not find the 'payload' column" });
  assert.equal(col.kind, 'permanent');
  assert.match(col.message, /migration/i);
  assert.equal(classifySyncError({ code: '22P02', message: 'invalid input syntax for type bigint' }).kind, 'permanent');
});
test('non-error values do not throw', () => {
  assert.equal(classifySyncError(undefined).kind, 'transient');
  assert.equal(classifySyncError('boom').kind, 'transient');
});
test('stale syncing entries (tab closed mid-request) are detected; fresh ones are not', () => {
  const now = Date.now();
  assert.equal(isStaleSyncing({ status: 'syncing', lastAttemptAt: new Date(now - STALE_SYNCING_MS - 1000).toISOString() }, now), true);
  assert.equal(isStaleSyncing({ status: 'syncing', lastAttemptAt: new Date(now - 5000).toISOString() }, now), false);
  assert.equal(isStaleSyncing({ status: 'syncing' }, now), true);
  assert.equal(isStaleSyncing({ status: 'pending' }, now), false);
});
