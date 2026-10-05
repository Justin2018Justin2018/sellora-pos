-- v7 checks: audited void. One transaction, ends in ROLLBACK; the final NOTICE proves every check passed.
BEGIN;
CREATE FUNCTION public.t_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  IF p_uid IS NULL THEN SET LOCAL ROLE anon; PERFORM set_config('request.jwt.claim.sub', '', true);
  ELSE SET LOCAL ROLE authenticated; PERFORM set_config('request.jwt.claim.sub', p_uid::text, true); END IF;
END $$;
CREATE FUNCTION public.t_db() RETURNS void LANGUAGE plpgsql AS $$ BEGIN RESET ROLE; END $$;
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
INSERT INTO pos_transactions (id, receipt, service, qty, unit_price, total, shop_id, date, notes) VALUES
  ('a1','R-A-1','print',2,50,100,'s_a', now(), NULL),
  ('b1','R-B-1','print',1,70,70,'s_b', now(), NULL),
  ('d1','R-DUP','print',1,10,10,'s_a', now() - interval '1 day', NULL),
  ('d2','R-DUP','print',1,20,20,'s_a', now(), 'keep'),
  ('x1','R-X-1','print',1,5,5,'s_x', now(), NULL);

SELECT public.t_as(NULL);
SELECT public.t_expect_err($$SELECT admin_void_transaction('s_a','R-A-1',NULL,'dispute')$$, '42501', 'anon can void');

SELECT public.t_as('00000000-0000-0000-0000-0000000000c0');
SELECT public.t_eq((SELECT admin_void_transaction('s_a','R-A-1',NULL,'dispute')->>'status'), 'forbidden', 'staff voided a sale');
SELECT public.t_as('00000000-0000-0000-0000-0000000000b0');
SELECT public.t_eq((SELECT admin_void_transaction('s_a','R-A-1',NULL,'dispute')->>'status'), 'forbidden', 'other shop owner voided a sale');

SELECT public.t_as('00000000-0000-0000-0000-0000000000a0');
SELECT public.t_eq((SELECT admin_void_transaction('s_a','R-A-1',NULL,NULL)->>'status'), 'bad_request', 'void without a reason accepted');
SELECT public.t_eq((SELECT admin_void_transaction('s_a','R-A-1',NULL,'ab')->>'status'), 'bad_request', 'void with a 2-char reason accepted');
SELECT public.t_eq((SELECT admin_void_transaction('s_a','',NULL,'dispute')->>'status'), 'bad_request', 'empty receipt accepted');
SELECT public.t_eq((SELECT admin_void_transaction('s_a','R-B-1',NULL,'dispute')->>'voided'), '0', 'voided a row of another shop');
SELECT public.t_eq((SELECT admin_void_transaction('s_a','R-A-1',NULL,'customer dispute')->>'voided'), '1', 'owner void did not void exactly one row');
SELECT public.t_eq((SELECT admin_void_transaction('s_a','R-A-1',NULL,'customer dispute')->>'voided'), '0', 'second void is not a no-op');
SELECT public.t_eq((SELECT admin_void_transaction('s_a','R-DUP', now(), 'dup receipt')->>'voided'), '1', 'duplicate receipt: expected exactly one row voided');

SELECT public.t_db();
SELECT public.t_eq((SELECT status FROM pos_transactions WHERE id='a1'), 'cancelled', 'status not cancelled');
SELECT public.t_eq((SELECT total FROM pos_transactions WHERE id='a1'), 100::numeric, 'void changed the amount');
SELECT public.t_eq((SELECT notes FROM pos_transactions WHERE id='a1'), 'Cancelled: customer dispute', 'note not appended');
SELECT public.t_eq((SELECT status FROM pos_transactions WHERE id='d1'), 'completed', 'older duplicate-receipt sale was voided too');
SELECT public.t_eq((SELECT status FROM pos_transactions WHERE id='d2'), 'cancelled', 'matching duplicate-receipt sale not voided');
SELECT public.t_eq((SELECT notes FROM pos_transactions WHERE id='d2'), 'keep | Cancelled: dup receipt', 'existing note lost');
SELECT public.t_eq((SELECT count(*) FROM pos_audit_log WHERE action='TRANSACTION_VOIDED' AND shop_id='s_a')::int, 2, 'audit rows');
SELECT public.t_eq((SELECT snapshot->>'status' FROM pos_audit_log WHERE action='TRANSACTION_VOIDED' AND entity_ref='R-A-1'), 'completed', 'audit snapshot should hold the PRE-void row');

SELECT public.t_as('00000000-0000-0000-0000-0000000000d0');
SELECT public.t_eq((SELECT admin_void_transaction('s_x','R-X-1',NULL,'expired shop')->>'status'), 'subscription_inactive', 'expired shop could void');
SELECT public.t_db();
SELECT public.t_eq((SELECT status FROM pos_transactions WHERE id='x1'), 'completed', 'expired shop sale changed');

DO $$ BEGIN RAISE NOTICE 'ALL ADMIN-VOID CHECKS PASSED'; END $$;
ROLLBACK;
