import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeSaleDeletion, checkLocalAdminSecret, classifyRpcError, outcomeFromRemote } from '../src/utils/adminAuth.ts';
import type { SaleDeletionDeps, RemoteDeleteResponse } from '../src/utils/adminAuth.ts';

const deps = (o: Partial<SaleDeletionDeps> & { remote?: RemoteDeleteResponse } = {}): SaleDeletionDeps & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    cloudConfigured: true,
    hasSession: async () => true,
    remoteDelete: async () => { calls.push('remote'); return o.remote ?? { status: 'ok', deleted: 1 }; },
    isLocalOnlySale: async () => false,
    localCheck: (s) => { calls.push('local'); return s === 'local-secret'; },
    ...o,
  } as any;
};

test('empty / whitespace password is rejected before any request is made', async () => {
  const d = deps();
  for (const v of ['', '   ', undefined, null]) {
    const r = await authorizeSaleDeletion(v as any, d);
    assert.equal(r.ok, false); assert.equal(r.reason, 'password_required');
  }
  assert.deepEqual(d.calls, []);
});

test('cloud sale: server decides; correct secret succeeds without consulting the browser value', async () => {
  const d = deps();
  const r = await authorizeSaleDeletion('anything', d);
  assert.equal(r.ok, true);
  assert.deepEqual(d.calls, ['remote']);
});

test('cloud sale: a wrong password is reported as wrong password and is NOT retried against the local secret', async () => {
  const d = deps({ remote: { status: 'invalid' }, isLocalOnlySale: async () => true });
  const r = await authorizeSaleDeletion('local-secret', d);
  assert.equal(r.ok, false); assert.equal(r.reason, 'invalid_password');
  assert.deepEqual(d.calls, ['remote']);
});

test('REGRESSION: non-password failures never say "incorrect password"', async () => {
  const cases: Array<[RemoteDeleteResponse, string]> = [
    [{ status: 'locked' }, 'locked'],
    [{ status: 'forbidden' }, 'forbidden'],
    [{ status: 'not_configured' }, 'not_configured'],
    [{ status: 'subscription_inactive' }, 'subscription_inactive'],
    [{ status: 'not_deployed' }, 'not_deployed'],
    [{ status: 'offline' }, 'offline'],
    [{ status: 'boom', message: 'db down' }, 'server_error'],
  ];
  for (const [remote, reason] of cases) {
    const r = await authorizeSaleDeletion('pw-123456', deps({ remote }));
    assert.equal(r.ok, false); assert.equal(r.reason, reason);
    assert.doesNotMatch(r.message, /incorrect/i, reason);
  }
});

test('cloud sale + no session => not_signed_in (cannot be deleted from the browser alone)', async () => {
  const d = deps({ hasSession: async () => false });
  const r = await authorizeSaleDeletion('local-secret', d);
  assert.equal(r.reason, 'not_signed_in');
  assert.deepEqual(d.calls, []);
});

test('local-only (never synced) sale: offline / unconfigured server falls back to the local check', async () => {
  for (const status of ['offline', 'not_configured', 'not_deployed']) {
    const ok = await authorizeSaleDeletion('local-secret', deps({ remote: { status }, isLocalOnlySale: async () => true }));
    assert.equal(ok.ok, true, status);
    const bad = await authorizeSaleDeletion('nope', deps({ remote: { status }, isLocalOnlySale: async () => true }));
    assert.equal(bad.reason, 'invalid_password', status);
  }
});

test('synced sale while offline is refused with an offline message, not deleted', async () => {
  const r = await authorizeSaleDeletion('local-secret', deps({ remote: { status: 'offline' }, isLocalOnlySale: async () => false }));
  assert.equal(r.ok, false); assert.equal(r.reason, 'offline');
});

test('cloud not configured at all: local check only', async () => {
  assert.equal((await authorizeSaleDeletion('local-secret', deps({ cloudConfigured: false }))).ok, true);
  assert.equal((await authorizeSaleDeletion('x', deps({ cloudConfigured: false }))).reason, 'invalid_password');
});

test('RPC error classification: missing function, RLS/privilege, network', () => {
  assert.equal(classifyRpcError({ code: 'PGRST202', message: 'x' }).status, 'not_deployed');
  assert.equal(classifyRpcError({ code: '42883', message: 'x' }).status, 'not_deployed');
  assert.equal(classifyRpcError({ code: '42501', message: 'x' }).status, 'forbidden');
  assert.equal(classifyRpcError({ message: 'TypeError: Failed to fetch' }).status, 'offline');
  assert.equal(classifyRpcError({ code: '57014', message: 'canceled' }).status, 'server_error');
  assert.equal(outcomeFromRemote({ status: 'ok', deleted: 0 }).ok, true);
});

test('REGRESSION: stored/typed whitespace no longer causes a false "incorrect password"', () => {
  const ctx = { profileSecret: ' MySecret1 ', staff: [{ role: 'admin', active: true, password: 'staffpw ' }], currentUser: null };
  assert.equal(checkLocalAdminSecret('MySecret1', ctx), true);
  assert.equal(checkLocalAdminSecret('  MySecret1', ctx), true);
  assert.equal(checkLocalAdminSecret('staffpw', ctx), true);
});

test('local check: wrong / empty / inactive-admin / cashier passwords are rejected', () => {
  const ctx = {
    profileSecret: 'Changed99',
    staff: [{ role: 'admin', active: false, password: 'oldadmin' }, { role: 'cashier', active: true, password: 'cash123' }],
    currentUser: { role: 'cashier', password: 'cash123' },
  };
  assert.equal(checkLocalAdminSecret('', ctx), false);
  assert.equal(checkLocalAdminSecret('oldadmin', ctx), false);
  assert.equal(checkLocalAdminSecret('cash123', ctx), false);
  assert.equal(checkLocalAdminSecret('wrong', ctx), false);
  assert.equal(checkLocalAdminSecret('Changed99', ctx), true);
});

test('local check: shipped default only works while no custom secret is configured', () => {
  assert.equal(checkLocalAdminSecret('admin123', { staff: [] }), true);
  assert.equal(checkLocalAdminSecret('admin123', { profileSecret: 'Changed99', staff: [] }), false);
});

import { voidFailureMessage } from '../src/utils/adminAuth.ts';
test('void failures give actionable, non-misleading messages', () => {
  assert.match(voidFailureMessage({ status: 'forbidden' }), /owner/i);
  assert.match(voidFailureMessage({ status: 'bad_request' }), /reason/i);
  assert.match(voidFailureMessage({ status: 'not_deployed' }), /v7/);
  assert.match(voidFailureMessage({ status: 'weird', message: 'db said no' }), /db said no/);
  assert.doesNotMatch(voidFailureMessage({ status: 'forbidden' }), /incorrect password/i);
});
