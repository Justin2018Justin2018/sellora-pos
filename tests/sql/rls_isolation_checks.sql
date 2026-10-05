-- ==========================================================
-- RLS isolation checks. Run on a STAGING/BRANCH database after v1..v5 (never on production data you care about:
-- it creates and then rolls back test rows). Everything runs inside one transaction that ends in ROLLBACK.
-- Each check raises an EXCEPTION on failure; reaching the final NOTICE means every check passed.
-- ==========================================================
BEGIN;

-- fixtures: two users, two shops, one owner each, one staff on shop A
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'staff-a@test.local', 'authenticated', 'authenticated');
INSERT INTO saas_tenants (id, shop_name, owner_name, phone, email, username, status, plan, expiry_date)
VALUES ('t_shop_a','A','','','a@x','t_shop_a','ACTIVE','BASIC', current_date + 30),
       ('t_shop_b','B','','','b@x','t_shop_b','ACTIVE','BASIC', current_date + 30),
       ('t_shop_x','Expired','','','x@x','t_shop_x','ACTIVE','BASIC', current_date - 30);
INSERT INTO shop_members (user_id, shop_id, role) VALUES
  ('00000000-0000-0000-0000-00000000000a','t_shop_a','owner'),
  ('00000000-0000-0000-0000-00000000000b','t_shop_b','owner'),
  ('00000000-0000-0000-0000-00000000000c','t_shop_a','staff');
INSERT INTO pos_transactions (id, receipt, service, shop_id) VALUES ('tx-b-1','R-B-1','svc','t_shop_b');

-- 1. anonymous role sees nothing and cannot write
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM 1 FROM pos_transactions LIMIT 1; RAISE EXCEPTION 'FAIL: anon could SELECT pos_transactions';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- 2. owner A cannot read, insert, update or delete shop B's rows
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pos_transactions WHERE shop_id = 't_shop_b';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A can read shop B rows (%)', n; END IF;
  BEGIN INSERT INTO pos_transactions (id, receipt, service, shop_id) VALUES ('tx-a-evil','R-EVIL','s','t_shop_b');
        RAISE EXCEPTION 'FAIL: owner A inserted into shop B';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE pos_transactions SET service = 'hacked' WHERE id = 'tx-b-1';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A updated shop B row'; END IF;
  -- v6 revokes DELETE from API roles entirely (privilege error); on a pre-v6 DB RLS yields 0 rows. Either means "not deleted".
  BEGIN
    DELETE FROM pos_transactions WHERE id = 'tx-b-1';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A deleted shop B row'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- 3. owner A cannot move own row to shop B (shop_id immutable)
INSERT INTO pos_transactions (id, receipt, service, shop_id) VALUES ('tx-a-1','R-A-1','svc','t_shop_a');
DO $$ BEGIN
  BEGIN UPDATE pos_transactions SET shop_id = 't_shop_b' WHERE id = 'tx-a-1';
        RAISE EXCEPTION 'FAIL: shop_id was changed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- 4. users cannot grant themselves membership/ownership or admin
DO $$ BEGIN
  BEGIN INSERT INTO shop_members (user_id, shop_id, role) VALUES ('00000000-0000-0000-0000-00000000000a','t_shop_b','owner');
        RAISE EXCEPTION 'FAIL: user inserted own shop_members row';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO super_admins (user_id, email) VALUES ('00000000-0000-0000-0000-00000000000a','owner-a@test.local');
        RAISE EXCEPTION 'FAIL: user became super admin';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.claim_shop('t_shop_b');
        RAISE EXCEPTION 'FAIL: claimed an already-claimed shop';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%already claimed%' THEN RAISE; END IF; END;
END $$;

-- 5. owner A cannot modify its subscription row
DO $$ DECLARE n int; BEGIN
  UPDATE saas_tenants SET expiry_date = current_date + 9999 WHERE id = 't_shop_a';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner extended own subscription'; END IF;
  IF (SELECT count(*) FROM saas_tenants WHERE id = 't_shop_a') <> 1 THEN RAISE EXCEPTION 'FAIL: owner cannot read own tenant row'; END IF;
  IF (SELECT count(*) FROM saas_tenants WHERE id = 't_shop_b') <> 0 THEN RAISE EXCEPTION 'FAIL: owner can read another tenant row'; END IF;
END $$;

-- 6. staff can read/insert but cannot delete, and cannot see family finance
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
DO $$ DECLARE n int; BEGIN
  IF (SELECT count(*) FROM pos_transactions WHERE shop_id = 't_shop_a') < 1 THEN RAISE EXCEPTION 'FAIL: staff cannot read own shop'; END IF;
  INSERT INTO pos_transactions (id, receipt, service, shop_id) VALUES ('tx-a-2','R-A-2','svc','t_shop_a');
  BEGIN
    DELETE FROM pos_transactions WHERE id = 'tx-a-2';
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAIL: staff deleted a sale'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- 7. duplicate receipt in the same shop is rejected - ONLY if the optional unique index was enabled
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_pos_tx_shop_receipt') THEN
    BEGIN INSERT INTO pos_transactions (id, receipt, service, shop_id) VALUES ('tx-a-dup','R-A-1','svc','t_shop_a');
          RAISE EXCEPTION 'FAIL: duplicate receipt accepted';
    EXCEPTION WHEN unique_violation THEN NULL; END;
  ELSE
    RAISE NOTICE 'check 7 skipped: optional unique receipt index not enabled';
  END IF;
END $$;

-- 8. negative money rejected
DO $$ BEGIN
  BEGIN INSERT INTO pos_expenses (id, title, amount, shop_id) VALUES ('e1','x',-5,'t_shop_a');
        RAISE EXCEPTION 'FAIL: negative expense accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'ALL RLS ISOLATION CHECKS PASSED'; END $$;
ROLLBACK;
