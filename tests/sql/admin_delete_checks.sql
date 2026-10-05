-- ==========================================================
-- v6 checks: server-verified admin secret, audited delete, immutable sale amounts, append-only audit log.
-- Runs in one transaction that ends in ROLLBACK. Any failed check raises an EXCEPTION; the final NOTICE proves all passed.
-- ==========================================================
BEGIN;

CREATE FUNCTION public.t_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  IF p_uid IS NULL THEN SET LOCAL ROLE anon; PERFORM set_config('request.jwt.claim.sub', '', true);
  ELSE SET LOCAL ROLE authenticated; PERFORM set_config('request.jwt.claim.sub', p_uid::text, true); END IF;
END $$;
CREATE FUNCTION public.t_db() RETURNS void LANGUAGE plpgsql AS $$ BEGIN RESET ROLE; END $$;
-- runs a statement, requires it to fail with the given SQLSTATE
CREATE FUNCTION public.t_expect_err(p_sql text, p_state text, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = p_state THEN RETURN; END IF;
    RAISE EXCEPTION 'FAIL: % (expected %, got % %)', p_msg, p_state, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL: % (statement succeeded)', p_msg;
END $$;
CREATE FUNCTION public.t_eq(p_got anyelement, p_want anyelement, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_got IS DISTINCT FROM p_want THEN RAISE EXCEPTION 'FAIL: % (got %, want %)', p_msg, p_got, p_want; END IF; END $$;

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000000a0','owner-a@t.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000b0','owner-b@t.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000c0','staff-a@t.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000d0','owner-x@t.local','authenticated','authenticated');
INSERT INTO saas_tenants (id, shop_name, owner_name, phone, email, username, status, plan, expiry_date) VALUES
  ('s_a','A','','','a@x','s_a','ACTIVE','BASIC', current_date + 30),
  ('s_b','B','','','b@x','s_b','ACTIVE','BASIC', current_date + 30),
  ('s_x','X','','','x@x','s_x','ACTIVE','BASIC', current_date - 30);
INSERT INTO shop_members (user_id, shop_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a0','s_a','owner'),
  ('00000000-0000-0000-0000-0000000000b0','s_b','owner'),
  ('00000000-0000-0000-0000-0000000000c0','s_a','staff'),
  ('00000000-0000-0000-0000-0000000000d0','s_x','owner');
INSERT INTO pos_transactions (id, receipt, service, qty, unit_price, total, shop_id, date) VALUES
  ('a1','R-A-1','print',2,50,100,'s_a', now()),
  ('b1','R-B-1','print',1,70,70,'s_b', now()),
  ('d1','R-DUP','print',1,10,10,'s_a', now() - interval '1 day'),
  ('d2','R-DUP','print',1,20,20,'s_a', now()),
  ('x1','R-X-1','print',1,5,5,'s_x', now());

-- ---- A. direct API access to the secret / audit tables and to destructive operations ----
SELECT public.t_as('00000000-0000-0000-0000-0000000000a0');
SELECT public.t_expect_err($$SELECT * FROM shop_admin_credentials$$, '42501', 'owner could read credentials table');
SELECT public.t_expect_err($$INSERT INTO shop_admin_credentials (shop_id, secret_hash) VALUES ('s_a','x')$$, '42501', 'owner wrote credentials directly');
SELECT public.t_expect_err($$DELETE FROM pos_transactions WHERE id = 'a1'$$, '42501', 'owner deleted a sale directly (must go through admin_delete_transaction)');
SELECT public.t_expect_err($$TRUNCATE pos_transactions$$, '42501', 'owner truncated sales');
SELECT public.t_expect_err($$INSERT INTO pos_audit_log (shop_id, action) VALUES ('s_a','FORGED')$$, '42501', 'owner forged an audit row');
SELECT public.t_as(NULL);
SELECT public.t_expect_err($$SELECT admin_delete_transaction('s_a','R-A-1',NULL,NULL,'x')$$, '42501', 'anon can call admin_delete_transaction');
SELECT public.t_expect_err($$SELECT set_shop_admin_secret('s_a','abcdef',NULL)$$, '42501', 'anon can call set_shop_admin_secret');

-- ---- B. amounts of a recorded sale cannot be rewritten through the API (by staff or owner) ----
SELECT public.t_as('00000000-0000-0000-0000-0000000000c0');
SELECT public.t_expect_err($$UPDATE pos_transactions SET total = 1 WHERE id = 'a1'$$, '42501', 'staff rewrote sale total');
SELECT public.t_expect_err($$UPDATE pos_transactions SET status = 'cancelled' WHERE id = 'a1'$$, '42501', 'staff cancelled a sale directly');
SELECT public.t_expect_err($$UPDATE pos_transactions SET receipt = 'R-HACK' WHERE id = 'a1'$$, '42501', 'staff changed receipt number');
SELECT public.t_as('00000000-0000-0000-0000-0000000000a0');
SELECT public.t_expect_err($$UPDATE pos_transactions SET qty = 99 WHERE id = 'a1'$$, '42501', 'owner rewrote sale qty directly');
-- an offline-queue retry re-upserts identical values: must keep working
INSERT INTO pos_transactions (id, receipt, service, qty, unit_price, total, shop_id, date)
SELECT id, receipt, service, qty, unit_price, total, shop_id, date FROM pos_transactions WHERE id = 'a1'
ON CONFLICT (id) DO UPDATE SET receipt = EXCLUDED.receipt, qty = EXCLUDED.qty, total = EXCLUDED.total, unit_price = EXCLUDED.unit_price, date = EXCLUDED.date;
UPDATE pos_transactions SET notes = 'note ok', customer = 'Jane' WHERE id = 'a1';
SELECT public.t_db();
SELECT public.t_eq((SELECT total FROM pos_transactions WHERE id='a1'), 100::numeric, 'total unchanged after blocked attempts');

-- ---- C. admin secret lifecycle ----
SELECT public.t_as('00000000-0000-0000-0000-0000000000c0');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-A-1',NULL,NULL,'whatever')->>'status'), 'not_configured', 'delete before any secret is configured');
SELECT public.t_eq((SELECT set_shop_admin_secret('s_a','secret-staff')->>'status'), 'forbidden', 'staff set the admin secret');
SELECT public.t_as('00000000-0000-0000-0000-0000000000b0');
SELECT public.t_eq((SELECT set_shop_admin_secret('s_a','secret-b')->>'status'), 'forbidden', 'owner of another shop set this shop secret');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-A-1',NULL,NULL,'x')->>'status'), 'forbidden', 'non-member called delete');
SELECT public.t_as('00000000-0000-0000-0000-0000000000a0');
SELECT public.t_eq((SELECT set_shop_admin_secret('s_a','abc')->>'status'), 'weak', 'weak secret accepted');
SELECT public.t_eq((SELECT set_shop_admin_secret('s_a','correct horse')->>'status'), 'ok', 'owner could not set secret');
SELECT public.t_eq((SELECT (shop_admin_secret_status('s_a')->>'configured')::boolean), true, 'status says not configured');
SELECT public.t_eq((SELECT set_shop_admin_secret('s_a','another-one')->>'status'), 'invalid', 'secret changed without current');
SELECT public.t_eq((SELECT set_shop_admin_secret('s_a','another-one','correct horse')->>'status'), 'ok', 'secret change with current failed');
SELECT public.t_db();
SELECT public.t_eq((SELECT secret_hash <> 'another-one' AND secret_hash LIKE '$2%' FROM shop_admin_credentials WHERE shop_id='s_a'), true, 'secret not stored as bcrypt hash');

-- ---- D. delete: wrong secret, throttle/lock, correct secret, audit snapshot ----
SELECT public.t_as('00000000-0000-0000-0000-0000000000c0');            -- a cashier typing the admin password at the till
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-A-1',NULL,'test','wrong-1')->>'status'), 'invalid', 'wrong secret accepted');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-A-1',NULL,'test','wrong-2')->>'status'), 'invalid', 'wrong secret accepted (2)');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-A-1',NULL,'test',NULL)->>'status'), 'invalid', 'NULL secret accepted');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-A-1',NULL,'test','')->>'status'), 'invalid', 'empty secret accepted');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-A-1',NULL,'test','wrong-5')->>'status'), 'invalid', 'wrong secret accepted (5)');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-A-1',NULL,'test','another-one')->>'status'), 'locked', 'correct secret accepted while locked');
SELECT public.t_db();
SELECT public.t_eq((SELECT count(*)::int FROM pos_transactions WHERE id='a1'), 1, 'sale deleted by a failed/locked attempt');
UPDATE shop_admin_credentials SET locked_until = now() - interval '1 minute' WHERE shop_id = 's_a';   -- time passes
SELECT public.t_as('00000000-0000-0000-0000-0000000000c0');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-A-1',NULL,'customer dispute','another-one')->>'status'), 'ok', 'correct secret rejected after lock expired');
SELECT public.t_db();
SELECT public.t_eq((SELECT count(*)::int FROM pos_transactions WHERE id='a1'), 0, 'sale not deleted');
SELECT public.t_eq((SELECT count(*)::int FROM pos_audit_log WHERE action='TRANSACTION_DELETED' AND entity_ref='R-A-1' AND reason='customer dispute' AND (snapshot->>'total')::numeric = 100), 1, 'audit row with full snapshot missing');
SELECT public.t_eq((SELECT failed_attempts FROM shop_admin_credentials WHERE shop_id='s_a'), 0, 'failed attempts not reset after success');

-- ---- E. tenant isolation + duplicate receipts + idempotency ----
SELECT public.t_as('00000000-0000-0000-0000-0000000000a0');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-B-1',NULL,NULL,'another-one')->>'deleted'), '0', 'deleted by receipt of another shop');
SELECT public.t_db();
SELECT public.t_eq((SELECT count(*)::int FROM pos_transactions WHERE id='b1'), 1, 'shop B sale was deleted via shop A');
SELECT public.t_as('00000000-0000-0000-0000-0000000000a0');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-DUP', now(), NULL,'another-one')->>'deleted'), '1', 'duplicate receipt: expected exactly one row deleted');
SELECT public.t_db();
SELECT public.t_eq((SELECT id FROM pos_transactions WHERE receipt='R-DUP'), 'd1', 'wrong duplicate removed');
SELECT public.t_as('00000000-0000-0000-0000-0000000000a0');
SELECT public.t_eq((SELECT admin_delete_transaction('s_a','R-A-1',NULL,NULL,'another-one')), '{"status":"ok","deleted":0}'::jsonb, 'repeat delete is not idempotent-safe');

-- ---- F. expired subscription cannot delete; audit log is append-only even for its owner ----
SELECT public.t_db();
INSERT INTO shop_admin_credentials (shop_id, secret_hash) VALUES ('s_x', extensions.crypt('xsecret1', extensions.gen_salt('bf', 4)));
SELECT public.t_as('00000000-0000-0000-0000-0000000000d0');
SELECT public.t_eq((SELECT admin_delete_transaction('s_x','R-X-1',NULL,NULL,'xsecret1')->>'status'), 'subscription_inactive', 'expired shop could delete');
SELECT public.t_db();
SELECT public.t_expect_err($$UPDATE pos_audit_log SET reason = 'edited'$$, '42501', 'audit row edited by table owner');
SELECT public.t_expect_err($$DELETE FROM pos_audit_log$$, '42501', 'audit rows deleted by table owner');
SELECT public.t_as('00000000-0000-0000-0000-0000000000c0');
SELECT public.t_eq((SELECT count(*)::int FROM pos_audit_log), 0, 'staff can read the audit log');
SELECT public.t_as('00000000-0000-0000-0000-0000000000a0');
SELECT public.t_eq((SELECT count(*)::int FROM pos_audit_log WHERE shop_id='s_a') >= 3, true, 'owner cannot read own audit log');
SELECT public.t_eq((SELECT count(*)::int FROM pos_audit_log WHERE shop_id<>'s_a'), 0, 'owner can read another shop audit log');

DO $$ BEGIN RAISE NOTICE 'ALL ADMIN-DELETE CHECKS PASSED'; END $$;
ROLLBACK;
